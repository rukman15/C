import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { isoTanggal } from "@/lib/tanggal";
import { rapikanJabatanSurat, rapikanNamaSurat, type Penandatangan } from "@/lib/tata-naskah";
import { rapikanRentang, type RentangTanggal } from "@/lib/persuratan";
import { hariMengajarDi, wajibTanpaBentrok } from "@/lib/server/repositories/bentrok-tugas";
import { wajibPenandatanganSah } from "@/lib/server/repositories/penandatangan";
import { JABATAN_KEPALA, KOTA_SURAT } from "@/lib/aplikasi";
import { getJabatanProfile } from "@/lib/jabatanProfiles";
import { statusMenutupAkun } from "@/lib/plt";
import {
  PENANDATANGAN_BAWAAN,
  pangkatGolongan,
  rentangBulan,
  untukBawaan,
  type JenjangWi,
} from "@/lib/dokumen";

/**
 * Dokumen penugasan WI (tahap C): surat tugas mengajar dan rekap JP bulanan.
 * Hak akses diperiksa di route (lihat src/lib/server/akses-diklat.ts).
 */

// ------------------------------------------------------------------ PENGATURAN

export type PengaturanDokumenRecord = {
  jpMinimal: Record<JenjangWi, number | null>;
  koordinatorWi: { nama: string; nip: string };
  kabagTu: { nama: string; nip: string };
  kepalaBalai: { nama: string; nip: string };
  /** Perjalanan dinas: PPK penerbit SPD, nomor SP DIPA tahun berjalan, akun (MAK) perjalanan dinas. */
  perjalanan: { ppkNama: string; ppkNip: string; dipaTeks: string; akunPerjalanan: string };
  diubahOleh: string | null;
  updatedAt: string | null;
};

type BarisPengaturan = {
  jpMinimalPertama: number | null;
  jpMinimalMuda: number | null;
  jpMinimalMadya: number | null;
  jpMinimalUtama: number | null;
  koordinatorWiNama: string | null;
  koordinatorWiNip: string | null;
  kabagTuNama: string | null;
  kabagTuNip: string | null;
  kepalaBalaiNama: string | null;
  kepalaBalaiNip: string | null;
  ppkNama?: string | null;
  ppkNip?: string | null;
  dipaTeks?: string | null;
  akunPerjalanan?: string | null;
  diubahOleh: string | null;
  updatedAt: Date | null;
};

function keRecord(r: BarisPengaturan): PengaturanDokumenRecord {
  return {
    jpMinimal: { pertama: r.jpMinimalPertama, muda: r.jpMinimalMuda, madya: r.jpMinimalMadya, utama: r.jpMinimalUtama },
    koordinatorWi: { nama: r.koordinatorWiNama ?? "", nip: r.koordinatorWiNip ?? "" },
    kabagTu: { nama: r.kabagTuNama ?? "", nip: r.kabagTuNip ?? "" },
    kepalaBalai: { nama: r.kepalaBalaiNama ?? "", nip: r.kepalaBalaiNip ?? "" },
    perjalanan: { ppkNama: r.ppkNama ?? "", ppkNip: r.ppkNip ?? "", dipaTeks: r.dipaTeks ?? "", akunPerjalanan: r.akunPerjalanan ?? "" },
    diubahOleh: r.diubahOleh,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

export async function getPengaturanDokumen(): Promise<PengaturanDokumenRecord> {
  const r: BarisPengaturan = await prisma.pengaturanDokumen.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  return keRecord(r);
}

export type PengaturanDokumenInput = {
  /** Isian KARKEN lama — opsional: tidak dikirim = nilai lama dipertahankan. */
  jpMinimal?: Record<JenjangWi, number | null>;
  koordinatorWi?: { nama: string; nip: string };
  kabagTu: { nama: string; nip: string };
  kepalaBalai: { nama: string; nip: string };
  /** Opsional: tidak dikirim = nilai lama dipertahankan. */
  perjalanan?: { ppkNama: string; ppkNip: string; dipaTeks: string; akunPerjalanan: string };
};

export async function simpanPengaturanDokumen(i: PengaturanDokumenInput, email: string): Promise<PengaturanDokumenRecord> {
  const isi = {
    ...(i.jpMinimal
      ? {
          jpMinimalPertama: i.jpMinimal.pertama,
          jpMinimalMuda: i.jpMinimal.muda,
          jpMinimalMadya: i.jpMinimal.madya,
          jpMinimalUtama: i.jpMinimal.utama,
        }
      : {}),
    ...(i.koordinatorWi
      ? { koordinatorWiNama: i.koordinatorWi.nama.trim() || null, koordinatorWiNip: i.koordinatorWi.nip.trim() || null }
      : {}),
    kabagTuNama: i.kabagTu.nama.trim() || null,
    kabagTuNip: i.kabagTu.nip.trim() || null,
    kepalaBalaiNama: i.kepalaBalai.nama.trim() || null,
    kepalaBalaiNip: i.kepalaBalai.nip.trim() || null,
    ...(i.perjalanan
      ? {
          ppkNama: i.perjalanan.ppkNama.trim() || null,
          ppkNip: i.perjalanan.ppkNip.replace(/\s+/g, "") || null,
          dipaTeks: i.perjalanan.dipaTeks.trim() || null,
          akunPerjalanan: i.perjalanan.akunPerjalanan.trim() || null,
        }
      : {}),
    diubahOleh: email,
  };
  const r: BarisPengaturan = await prisma.pengaturanDokumen.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...isi },
    update: isi,
  });
  return keRecord(r);
}

// ------------------------------------------------------------------ SURAT TUGAS

export type PenerimaSurat = { pegawaiId: string; nama: string; pangkat: string; nip: string; jabatan: string };

export type SuratTugasRecord = {
  id: string;
  trainingId: string;
  trainingName: string;
  nomor: string | null;
  tanggal: string; // YYYY-MM-DD
  tempat: string;
  dasar: string[];
  untuk: string[];
  penandatangan: string;
  /** Rentang tanggal tugas (kosong di data lama = tanggal diklat). Dasar cek bentrok & SPD. */
  tanggalTugas: RentangTanggal[];
  /** Nama & NIP penanda tangan tersimpan; kosong = Kepala Balai (Pengaturan Dokumen). */
  ttdNama: string;
  ttdNip: string;
  /** Blok tanda tangan (Permendagri 18/2024 Ps. 35 ayat 2): jabatan dari `penandatangan`, nama & NIP
   *  tersimpan (atau Kepala Balai dari Pengaturan Dokumen), pangkat dari Data Pegawai lewat NIP. */
  ttd: Penandatangan;
  penerima: PenerimaSurat[];
  dibuatOleh: string;
  updatedAt: string;
};

export type SuratTugasInput = {
  nomor?: string | null;
  tanggal: string;
  tempat?: string | null;
  dasar: string[];
  untuk: string[];
  pegawaiIds: string[];
  penandatangan?: string | null;
  ttdNama?: string | null;
  ttdNip?: string | null;
  tanggalTugas?: RentangTanggal[];
};

type BarisSurat = {
  id: string;
  trainingId: string;
  nomor: string | null;
  tanggal: Date;
  tempat: string;
  dasar: string[];
  untuk: string[];
  pegawaiIds: string[];
  penandatangan: string;
  ttdNama: string;
  ttdNip: string;
  tanggalTugas: unknown;
  dibuatOleh: string;
  updatedAt: Date;
  training: { name: string; startDate: Date; endDate: Date | null };
};

/** Rentang tugas surat mengajar: isian sendiri, atau seluruh periode diklat bila kosong (data lama). */
const rentangSurat = (r: { tanggalTugas: unknown; training: { startDate: Date; endDate: Date | null } }): RentangTanggal[] => {
  const sendiri = rapikanRentang(r.tanggalTugas);
  return sendiri.length ? sendiri : [{ mulai: isoTanggal(r.training.startDate), selesai: isoTanggal(r.training.endDate ?? r.training.startDate) }];
};

export async function penerimaDari(ids: string[]): Promise<PenerimaSurat[]> {
  if (ids.length === 0) return [];
  const rows: { id: string; nama: string; nip: string | null; pangkat: string | null; golRuang: string | null; jabatan: string | null }[] =
    await prisma.pegawai.findMany({
      where: { id: { in: ids } },
      select: { id: true, nama: true, nip: true, pangkat: true, golRuang: true, jabatan: true },
    });
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({
      pegawaiId: r.id,
      nama: rapikanNamaSurat(r.nama),
      pangkat: pangkatGolongan(r.pangkat, r.golRuang),
      nip: r.nip?.trim() || "-",
      jabatan: r.jabatan?.trim() ? rapikanJabatanSurat(r.jabatan) : "-",
    }));
}

/** Pangkat (golongan) pegawai ber-NIP itu, mis. "Pembina Tingkat I (IV/b)"; tidak ketemu → "". */
export async function pangkatDariNip(nip: string): Promise<string> {
  const n = nip.replace(/\D/g, "");
  if (!n) return "";
  const rows: { pangkat: string | null; golRuang: string | null }[] = await prisma.pegawai.findMany({
    where: { nip: { in: [...new Set([n, nip.trim()])] } },
    select: { pangkat: true, golRuang: true },
  });
  const r = rows[0];
  if (!r) return "";
  const pg = pangkatGolongan(r.pangkat, r.golRuang);
  return pg === "-" ? "" : pg;
}

/**
 * Nama & NIP Kepala Balai untuk penanda tangan: dari Pengaturan Dokumen bila diisi; bila
 * kosong, dari Data Pegawai (pegawai aktif berjabatan Kepala Balai — profil "pimpinan-unit").
 */
export async function kepalaBalaiTerisi(atur?: PengaturanDokumenRecord): Promise<{ nama: string; nip: string }> {
  const kb = (atur ?? (await getPengaturanDokumen())).kepalaBalai;
  if (kb.nama.trim()) return kb;
  const calon: { nama: string; nip: string | null; jabatan: string | null; status: string | null }[] = await prisma.pegawai.findMany({
    where: { jabatan: { not: null } },
    select: { nama: true, nip: true, jabatan: true, status: true },
  });
  const kepala = calon.find((p) => !statusMenutupAkun(p.status) && getJabatanProfile(p.jabatan).id === "pimpinan-unit");
  return kepala ? { nama: rapikanNamaSurat(kepala.nama), nip: kepala.nip ?? "" } : kb;
}

/** Nama, NIP, pangkat Kepala Balai (Pengaturan Dokumen, atau Data Pegawai bila kosong). */
async function dataKepalaBalai(): Promise<Omit<Penandatangan, "jabatan">> {
  const kb = await kepalaBalaiTerisi();
  return { nama: kb.nama, nip: kb.nip, pangkat: await pangkatDariNip(kb.nip) };
}

/** Penanda tangan surat atas nama Kepala Balai: nama & NIP dari Pengaturan Dokumen. */
export async function ttdKepalaBalai(jabatan: string[]): Promise<Penandatangan> {
  return { jabatan, ...(await dataKepalaBalai()) };
}

async function keSurat(r: BarisSurat, kb?: Omit<Penandatangan, "jabatan">): Promise<SuratTugasRecord> {
  return {
    id: r.id,
    trainingId: r.trainingId,
    trainingName: r.training.name,
    nomor: r.nomor,
    tanggal: isoTanggal(r.tanggal),
    tempat: r.tempat,
    dasar: r.dasar,
    untuk: r.untuk,
    penandatangan: r.penandatangan,
    tanggalTugas: rentangSurat(r),
    ttdNama: r.ttdNama ?? "",
    ttdNip: r.ttdNip ?? "",
    ttd: {
      jabatan: r.penandatangan.split("\n"),
      ...(r.ttdNama?.trim() || r.ttdNip?.trim()
        ? { nama: r.ttdNama.trim(), nip: r.ttdNip.trim(), pangkat: await pangkatDariNip(r.ttdNip) }
        : (kb ?? (await dataKepalaBalai()))),
    },
    penerima: await penerimaDari(r.pegawaiIds),
    dibuatOleh: r.dibuatOleh,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SERTA = { training: { select: { name: true, startDate: true, endDate: true } } } as const;

/** WI yang penugasannya DISETUJUI pada diklat ini — calon penerima surat tugas (urut nama). */
export async function kandidatPenerima(trainingId: string): Promise<PenerimaSurat[]> {
  const rows: { instructorId: string }[] = await prisma.penugasanApproval.findMany({
    where: { trainingId, status: "disetujui" },
    select: { instructorId: true },
  });
  const ids = [...new Set(rows.map((r) => r.instructorId))];
  // Urutan resmi Kepegawaian (daftar urut) — juga urutan penerima di surat tugas.
  const urut: { id: string }[] = await prisma.pegawai.findMany({ where: { id: { in: ids } }, select: { id: true }, orderBy: { no: "asc" } });
  return penerimaDari(urut.map((u) => u.id));
}

export type BawaanSuratRecord = {
  untuk: string[];
  tanggalTugas: RentangTanggal[];
  penandatangan: string;
  ttdNama: string;
  ttdNip: string;
  tempat: string;
  kandidat: PenerimaSurat[];
};

export async function bawaanSuratTugas(trainingId: string): Promise<BawaanSuratRecord> {
  const t = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!t) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  return {
    untuk: untukBawaan({
      namaDiklat: t.name,
      modePelatihan: t.modePelatihan,
      tempat: t.tempat,
      mulai: isoTanggal(t.startDate),
      selesai: t.endDate ? isoTanggal(t.endDate) : null,
    }),
    tanggalTugas: [{ mulai: isoTanggal(t.startDate), selesai: isoTanggal(t.endDate ?? t.startDate) }],
    penandatangan: PENANDATANGAN_BAWAAN,
    ...(await kepalaBalaiTerisi().then((kb) => ({ ttdNama: kb.nama, ttdNip: kb.nip }))),
    tempat: KOTA_SURAT,
    kandidat: await kandidatPenerima(trainingId),
  };
}

export async function listSuratTugas(trainingId: string): Promise<SuratTugasRecord[]> {
  const rows: BarisSurat[] = await prisma.suratTugas.findMany({
    where: { trainingId },
    orderBy: { createdAt: "asc" },
    include: SERTA,
  });
  const kb = await dataKepalaBalai(); // sekali untuk seluruh daftar
  return Promise.all(rows.map((r) => keSurat(r, kb)));
}

export async function getSuratTugas(id: string): Promise<SuratTugasRecord> {
  const r: BarisSurat | null = await prisma.suratTugas.findUnique({ where: { id }, include: SERTA });
  if (!r) throw new NotFoundError("Surat tugas tidak ditemukan");
  return keSurat(r);
}

export async function trainingSurat(id: string): Promise<string> {
  const r: { trainingId: string } | null = await prisma.suratTugas.findUnique({ where: { id }, select: { trainingId: true } });
  if (!r) throw new NotFoundError("Surat tugas tidak ditemukan");
  return r.trainingId;
}

const rapikan = (xs: string[]) => xs.map((x) => x.trim()).filter((x) => x.length > 0);

async function periksaIsian(trainingId: string, i: SuratTugasInput, suratTugasId: string | null = null) {
  const untuk = rapikan(i.untuk);
  if (untuk.length === 0) throw new ValidationError("Butir \"Untuk\" wajib diisi");
  const pegawaiIds = [...new Set(i.pegawaiIds)];
  if (pegawaiIds.length === 0) throw new ValidationError("Pilih minimal satu Widyaiswara");
  const boleh = new Set((await kandidatPenerima(trainingId)).map((k) => k.pegawaiId));
  const luar = pegawaiIds.filter((p) => !boleh.has(p));
  if (luar.length > 0) {
    throw new ValidationError("Penerima surat tugas harus Widyaiswara yang penugasannya sudah disetujui pada diklat ini");
  }
  const t: { startDate: Date; endDate: Date | null } | null = await prisma.training.findUnique({ where: { id: trainingId }, select: { startDate: true, endDate: true } });
  if (!t) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  const tanggalTugas = rapikanRentang(i.tanggalTugas ?? []);
  // Bentrok per tanggal dengan surat tugas lain & cuti disetujui (CATATAN-SURAT-MENYURAT.md G).
  // Tanpa tanggal tugas: tiap WI diperiksa pada hari mengajarnya sendiri di diklat ini; bila jadwal
  // sesinya belum ada, periode diklat dipakai sebagai perkiraan (tidak mencegah).
  if (tanggalTugas.length) {
    await wajibTanpaBentrok(pegawaiIds, tanggalTugas, { konteks: "mengajar", suratTugasId, trainingId });
  } else {
    for (const id of pegawaiIds) {
      const hari = await hariMengajarDi(id, trainingId);
      await wajibTanpaBentrok([id], hari.length ? hari : rentangSurat({ tanggalTugas, training: t }), {
        konteks: "mengajar",
        suratTugasId,
        trainingId,
        perkiraan: !hari.length,
      });
    }
  }
  // Penanda tangan sesuai kewenangan (Permendagri 18/2024): Kepala Balai, Plt./Plh., atau a.n. oleh Kabag TU.
  const penandatangan = i.penandatangan?.trim() || PENANDATANGAN_BAWAAN;
  const ttdNama = i.ttdNama?.trim() ?? "";
  const ttdNip = i.ttdNip?.replace(/\s+/g, "") ?? "";
  const kb = ttdNama || ttdNip ? null : await kepalaBalaiTerisi();
  await wajibPenandatanganSah("SURAT_TUGAS", i.tanggal, { jabatan: penandatangan.split("\n"), nama: kb?.nama ?? ttdNama, nip: kb?.nip ?? ttdNip });
  return {
    tanggalTugas,
    ttdNama,
    ttdNip,
    nomor: i.nomor?.trim() || null,
    tanggal: new Date(`${i.tanggal}T00:00:00.000Z`),
    tempat: i.tempat?.trim() || KOTA_SURAT,
    dasar: rapikan(i.dasar),
    untuk,
    pegawaiIds,
    penandatangan,
  };
}

export async function buatSuratTugas(trainingId: string, i: SuratTugasInput, email: string): Promise<SuratTugasRecord> {
  const t = await prisma.training.findUnique({ where: { id: trainingId }, select: { id: true } });
  if (!t) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  const isi = await periksaIsian(trainingId, i);
  const r: BarisSurat = await prisma.suratTugas.create({
    data: { trainingId, ...isi, dibuatOleh: email },
    include: SERTA,
  });
  return keSurat(r);
}

export async function ubahSuratTugas(id: string, i: SuratTugasInput): Promise<SuratTugasRecord> {
  const trainingId = await trainingSurat(id);
  const isi = await periksaIsian(trainingId, i, id);
  const r: BarisSurat = await prisma.suratTugas.update({ where: { id }, data: isi, include: SERTA });
  return keSurat(r);
}

export async function hapusSuratTugas(id: string): Promise<void> {
  await trainingSurat(id);
  await prisma.suratTugas.deleteMany({ where: { id } });
}

// ------------------------------------------------------------------ REKAP JP BULANAN

const awalUtc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export type RekapJpBarisRecord = {
  pegawaiId: string;
  nama: string;
  nip: string;
  jabatan: string;
  /** JP sesi mengajar yang dicatat pada penugasan disetujui dalam bulan itu. */
  tatapMuka: number;
};

/**
 * Rekap JP tatap muka bulanan semua Widyaiswara (unduh CSV). KARKEN sendiri dibuat manual oleh WI
 * di luar aplikasi sejak 23 Okt 2026 — konversi, JP minimal, dan verifikasi tidak lagi dihitung di sini.
 */
export async function rekapJpBulanan(bulan: string): Promise<RekapJpBarisRecord[]> {
  const { awal, akhirEksklusif } = rentangBulan(bulan);
  const [wi, sesi]: [
    { id: string; nama: string; nip: string | null; jabatan: string | null; status: string | null }[],
    { jp: number; penugasan: { instructorId: string } }[],
  ] = await Promise.all([
    prisma.pegawai.findMany({
      where: { jabatan: { contains: "widyaiswara", mode: "insensitive" } },
      select: { id: true, nama: true, nip: true, jabatan: true, status: true },
      // Urutan resmi Kepegawaian (daftar urut).
      orderBy: { no: "asc" },
    }),
    prisma.penugasanSesi.findMany({
      where: { tanggal: { gte: awalUtc(awal), lt: awalUtc(akhirEksklusif) }, penugasan: { status: "disetujui" } },
      select: { jp: true, penugasan: { select: { instructorId: true } } },
    }),
  ]);
  return wi
    .map((w) => ({
      pegawaiId: w.id,
      nama: w.nama,
      nip: w.nip ?? "",
      jabatan: w.jabatan ?? "",
      tatapMuka: sesi.filter((s) => s.penugasan.instructorId === w.id).reduce((a, s) => a + s.jp, 0),
      aktif: (w.status ?? "AKTIF") === "AKTIF",
    }))
    // WI nonaktif tetap tampil bila punya kegiatan bulan ini.
    .filter((r) => r.aktif || r.tatapMuka > 0)
    .map(({ aktif: _aktif, ...r }) => r);
}

// ------------------------------------------------------------------ DAFTAR SEMUA SURAT (menu Unduh Dokumen)

export type SuratTugasDaftarRecord = SuratTugasRecord & { timKerjaId: string | null; pegawaiIds: string[] };

/** Semua surat tugas (opsional satu tahun, menurut tanggal surat), terbaru dulu. Hak baca disaring di route. */
export async function listSemuaSuratTugas(tahun: number | null): Promise<SuratTugasDaftarRecord[]> {
  const rows: (BarisSurat & { training: { name: string; timKerjaId: string | null } })[] = await prisma.suratTugas.findMany({
    where: tahun ? { tanggal: { gte: awalUtc(`${tahun}-01-01`), lt: awalUtc(`${tahun + 1}-01-01`) } } : undefined,
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
    include: { training: { select: { name: true, timKerjaId: true, startDate: true, endDate: true } } },
  });
  // Satu kueri pegawai untuk semua surat.
  const semua = await penerimaDari([...new Set(rows.flatMap((r) => r.pegawaiIds))]);
  const peta = new Map(semua.map((p) => [p.pegawaiId, p]));
  const kb = await dataKepalaBalai();
  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    trainingId: r.trainingId,
    trainingName: r.training.name,
    nomor: r.nomor,
    tanggal: isoTanggal(r.tanggal),
    tempat: r.tempat,
    dasar: r.dasar,
    untuk: r.untuk,
    penandatangan: r.penandatangan,
    tanggalTugas: rentangSurat(r),
    ttdNama: r.ttdNama ?? "",
    ttdNip: r.ttdNip ?? "",
    ttd: {
      jabatan: r.penandatangan.split("\n"),
      ...(r.ttdNama?.trim() || r.ttdNip?.trim() ? { nama: r.ttdNama.trim(), nip: r.ttdNip.trim(), pangkat: await pangkatDariNip(r.ttdNip) } : kb),
    },
    penerima: r.pegawaiIds.map((id) => peta.get(id)).filter((p): p is PenerimaSurat => !!p),
    dibuatOleh: r.dibuatOleh,
    updatedAt: r.updatedAt.toISOString(),
    timKerjaId: r.training.timKerjaId,
    pegawaiIds: r.pegawaiIds,
  })));
}
