import "server-only";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { JABATAN_KEPALA, KOTA_SURAT } from "@/lib/aplikasi";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { statusMenutupAkun } from "@/lib/plt";
import { getPengaturanDokumen, kepalaBalaiTerisi, pangkatDariNip, penerimaDari, type PenerimaSurat } from "@/lib/server/repositories/dokumen";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import type { Penandatangan } from "@/lib/tata-naskah";
import {
  KODE_UNIT_BAWAAN,
  KODE_UNIT_KEPEGAWAIAN,
  bawaanNaskah,
  jenisNaskah,
  pasangKalimatTanggal,
  kerangkaLaporan,
  labelJenisCuti,
  labelJenisNaskah,
  dasarPerjalananDinas,
  periksaIsi,
  rapikanIsi,
  rapikanRentang,
  susunNomor,
  type DataDiklatSurat,
  type IsiNaskah,
  type JenisNaskah,
  type RentangTanggal,
  type RingkasanDiklat,
  type SifatSurat,
  type SumberAgenda,
} from "@/lib/persuratan";
import { PENOMOR, termasuk, type Pengguna } from "@/lib/server/akses-persuratan";
import { hariMengajarDi, wajibTanpaBentrok } from "@/lib/server/repositories/bentrok-tugas";
import { getSuratMasuk } from "@/lib/server/repositories/surat-masuk";
import { pemberiIzinUntuk } from "@/lib/server/repositories/cuti";
import { wajibPenandatanganSah } from "@/lib/server/repositories/penandatangan";
import { tanggalPanjang } from "@/lib/dokumen";
import type { NaskahInput } from "@/lib/server/skema-persuratan";

/**
 * Naskah dinas keluar + buku agenda & penomoran surat keluar (CATATAN-SURAT-MENYURAT.md).
 * Hak akses dicek di route (src/lib/server/akses-persuratan.ts); di sini aturan data.
 */

// ------------------------------------------------------------------ NASKAH

export type NaskahRecord = {
  id: string;
  jenis: JenisNaskah;
  label: string;
  trainingId: string | null;
  trainingName: string | null;
  hal: string;
  tanggal: string;
  tempat: string;
  sifat: string;
  keamanan: string;
  lampiranTeks: string;
  kepada: string[];
  tembusan: string[];
  pegawaiIds: string[];
  /** Surat tugas: rentang tanggal tugas (hari kalender). */
  tanggalTugas: RentangTanggal[];
  /** Penerima surat tugas umum (data pegawai saat dibaca). */
  penerima: PenerimaSurat[];
  isi: IsiNaskah;
  ttdJabatan: string;
  ttdNama: string;
  ttdNip: string;
  /** Blok tanda tangan siap cetak (pangkat dari Data Pegawai lewat NIP). */
  ttd: Penandatangan;
  nomor: string | null;
  /** Nota usulan asal (surat tugas dari nota); null bila bukan dari nota. */
  notaId: string | null;
  /** Surat tugas yang dibuat dari nota ini (hanya saat satu naskah diambil). */
  suratTugasDariNota: { id: string; nomor: string | null }[];
  dibuatOleh: string;
  updatedAt: string;
};

type BarisNaskah = {
  id: string;
  jenis: string;
  trainingId: string | null;
  training: { name: string } | null;
  hal: string;
  tanggal: Date;
  tempat: string;
  sifat: string;
  keamanan: string;
  lampiranTeks: string;
  kepada: string[];
  tembusan: string[];
  pegawaiIds: string[];
  tanggalTugas: unknown;
  isi: unknown;
  ttdJabatan: string;
  ttdNama: string;
  ttdNip: string;
  nomor: string | null;
  notaId: string | null;
  dibuatOleh: string;
  updatedAt: Date;
};

const SERTA = { training: { select: { name: true } } } as const;

async function keNaskah(r: BarisNaskah, lengkap = true): Promise<NaskahRecord> {
  const jabatan = r.ttdJabatan.split("\n");
  return {
    id: r.id,
    jenis: r.jenis as JenisNaskah,
    label: labelJenisNaskah(r.jenis),
    trainingId: r.trainingId,
    trainingName: r.training?.name ?? null,
    hal: r.hal,
    tanggal: isoTanggal(r.tanggal),
    tempat: r.tempat,
    sifat: r.sifat,
    keamanan: r.keamanan,
    lampiranTeks: r.lampiranTeks,
    kepada: r.kepada,
    tembusan: r.tembusan,
    pegawaiIds: r.pegawaiIds,
    tanggalTugas: rapikanRentang(r.tanggalTugas),
    penerima: lengkap ? await penerimaDari(r.pegawaiIds) : [],
    isi: rapikanIsi(r.isi),
    ttdJabatan: r.ttdJabatan,
    ttdNama: r.ttdNama,
    ttdNip: r.ttdNip,
    ttd: { jabatan, nama: r.ttdNama, nip: r.ttdNip, pangkat: lengkap ? await pangkatDariNip(r.ttdNip) : "" },
    nomor: r.nomor,
    notaId: r.notaId,
    suratTugasDariNota: lengkap ? await prisma.naskahDinas.findMany({ where: { notaId: r.id }, select: { id: true, nomor: true }, orderBy: { tanggal: "asc" } }) : [],
    dibuatOleh: r.dibuatOleh,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Daftar naskah (tanpa data penerima & pangkat — cukup untuk tabel). */
export async function listNaskah(f: { jenis?: string | null; tahun?: number | null; trainingId?: string | null }): Promise<NaskahRecord[]> {
  const where: Record<string, unknown> = {};
  if (f.jenis) where.jenis = f.jenis;
  if (f.trainingId) where.trainingId = f.trainingId;
  if (f.tahun) where.tanggal = { gte: new Date(Date.UTC(f.tahun, 0, 1)), lt: new Date(Date.UTC(f.tahun + 1, 0, 1)) };
  const rows: BarisNaskah[] = await prisma.naskahDinas.findMany({ where, include: SERTA, orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }], take: 500 });
  return Promise.all(rows.map((r) => keNaskah(r, false)));
}

export async function getNaskah(id: string): Promise<NaskahRecord> {
  const r: BarisNaskah | null = await prisma.naskahDinas.findUnique({ where: { id }, include: SERTA });
  if (!r) throw new NotFoundError("Naskah tidak ditemukan");
  return keNaskah(r);
}

async function dataTulis(input: NaskahInput, naskahId: string | null = null) {
  const jenis = input.jenis as JenisNaskah;
  const def = jenisNaskah(jenis)!;
  const isi = rapikanIsi(input.isi);
  const pegawaiIds = def.pegawai ? [...new Set(input.pegawaiIds)] : [];
  if (pegawaiIds.length) {
    const ada: { id: string }[] = await prisma.pegawai.findMany({ where: { id: { in: pegawaiIds } }, select: { id: true } });
    if (ada.length !== pegawaiIds.length) throw new ValidationError("Ada pegawai yang tidak ditemukan");
  }
  const kepada = input.kepada.filter(Boolean);
  const galat = periksaIsi(jenis, isi, { hal: input.hal, kepada, penerimaPegawai: pegawaiIds.length });
  if (galat.length) throw new ValidationError(galat.join("; "));
  // Surat tugas: tanggal tugas wajib; pegawai yang bentrok (cuti, surat tugas bernomor) ditolak.
  const tanggalTugas = def.bentuk === "surat-tugas" ? rapikanRentang(input.tanggalTugas) : [];
  if (def.bentuk === "surat-tugas") {
    if (!tanggalTugas.length) throw new ValidationError("Isi tanggal tugas (minimal satu tanggal)");
    await wajibTanpaBentrok(pegawaiIds, tanggalTugas, { konteks: "umum", naskahId });
  }
  // Surat tugas dari nota usulan: nota harus ada dan memang nota usulan.
  let notaId: string | null = null;
  if (def.bentuk === "surat-tugas" && input.notaId) {
    const nota: { jenis: string } | null = await prisma.naskahDinas.findUnique({ where: { id: input.notaId }, select: { jenis: true } });
    if (!nota || nota.jenis !== "NOTA_USULAN") throw new ValidationError("Nota usulan tidak ditemukan");
    notaId = input.notaId;
  }
  await wajibPenandatanganSah(jenis, input.tanggal, { jabatan: input.ttdJabatan.split("\n"), nama: input.ttdNama, nip: input.ttdNip });
  const trainingId = input.trainingId || null;
  if (def.diklat && !trainingId) throw new ValidationError(`${def.label} harus dikaitkan dengan jadwal diklat`);
  if (trainingId) {
    const t: { id: string } | null = await prisma.training.findUnique({ where: { id: trainingId }, select: { id: true } });
    if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  }
  return {
    jenis,
    trainingId,
    hal: input.hal,
    tanggal: new Date(`${input.tanggal.slice(0, 10)}T00:00:00Z`),
    tempat: input.tempat?.trim() || KOTA_SURAT,
    sifat: input.sifat,
    keamanan: input.keamanan,
    lampiranTeks: input.lampiranTeks,
    kepada,
    tembusan: input.tembusan.filter(Boolean),
    pegawaiIds,
    tanggalTugas: tanggalTugas as unknown as Prisma.InputJsonValue,
    notaId,
    isi: isi as unknown as Prisma.InputJsonValue,
    ttdJabatan: input.ttdJabatan,
    ttdNama: input.ttdNama,
    ttdNip: input.ttdNip.replace(/\s+/g, ""),
  };
}

export async function buatNaskah(input: NaskahInput, email: string): Promise<NaskahRecord> {
  const data = await dataTulis(input);
  const r: BarisNaskah = await prisma.naskahDinas.create({ data: { ...data, nomor: input.nomor?.trim() || null, dibuatOleh: email }, include: SERTA });
  return keNaskah(r);
}

type Pemilik = { dibuatOleh: string; nomor: string | null };

/** Konsep boleh diubah/dihapus penyusunnya atau TU (PENOMOR). */
function wajibPemilik(r: Pemilik, p: Pengguna) {
  if (r.dibuatOleh !== p.email && !termasuk(p, PENOMOR)) throw new ForbiddenError("Naskah ini hanya bisa diubah penyusunnya atau TU.");
}

export async function ubahNaskah(id: string, input: NaskahInput, p: Pengguna): Promise<NaskahRecord> {
  const lama: (Pemilik & { jenis: string }) | null = await prisma.naskahDinas.findUnique({ where: { id }, select: { dibuatOleh: true, nomor: true, jenis: true } });
  if (!lama) throw new NotFoundError("Naskah tidak ditemukan");
  wajibPemilik(lama, p);
  if (lama.jenis !== input.jenis) throw new ValidationError("Jenis naskah tidak bisa diubah");
  const data = await dataTulis(input, id);
  // Nomor dari agenda tidak berubah lewat isian; nomor ketik manual boleh selama belum tercatat di agenda.
  const diAgenda = await prisma.agendaSurat.count({ where: { sumber: "naskah", sumberId: id } });
  const nomor = diAgenda ? lama.nomor : input.nomor?.trim() || null;
  const r: BarisNaskah = await prisma.naskahDinas.update({ where: { id }, data: { ...data, nomor }, include: SERTA });
  return keNaskah(r);
}

export async function hapusNaskah(id: string, p: Pengguna): Promise<void> {
  const lama: Pemilik | null = await prisma.naskahDinas.findUnique({ where: { id }, select: { dibuatOleh: true, nomor: true } });
  if (!lama) throw new NotFoundError("Naskah tidak ditemukan");
  wajibPemilik(lama, p);
  if (await prisma.agendaSurat.count({ where: { sumber: "naskah", sumberId: id } }))
    throw new ConflictError("Naskah sudah bernomor di buku agenda dan tidak bisa dihapus.");
  await prisma.naskahDinas.deleteMany({ where: { id } });
}

// ------------------------------------------------------------------ ISIAN BAWAAN

type BarisDiklat = { id: string; name: string; startDate: Date; endDate: Date | null; tempat: string; angkatan: string | null; participants: number };

async function dataDiklat(trainingId: string): Promise<{ d: DataDiklatSurat; pesertaAktif: { nama: string; nip: string; jabatan: string; instansi: string }[] }> {
  const t: BarisDiklat | null = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true, name: true, startDate: true, endDate: true, tempat: true, angkatan: true, participants: true },
  });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  const peserta: { nama: string; nip: string | null; jabatan: string | null; instansi: string | null }[] = await prisma.peserta.findMany({
    where: { trainingId, status: "AKTIF" },
    select: { nama: true, nip: true, jabatan: true, instansi: true },
    orderBy: { nomor: "asc" },
  });
  return {
    d: {
      nama: t.name,
      mulai: isoTanggal(t.startDate),
      selesai: t.endDate ? isoTanggal(t.endDate) : null,
      tempat: t.tempat,
      angkatan: t.angkatan,
      jumlahPeserta: peserta.length || t.participants,
    },
    pesertaAktif: peserta.map((p) => ({ nama: p.nama, nip: p.nip ?? "", jabatan: p.jabatan ?? "", instansi: p.instansi ?? "" })),
  };
}

/** Ringkasan data diklat untuk laporan penyelenggaraan. */
export async function ringkasanDiklat(trainingId: string, email: string): Promise<RingkasanDiklat> {
  const [peserta, sesi, wi, responden] = await Promise.all([
    prisma.peserta.findMany({ where: { trainingId }, select: { status: true } }) as Promise<{ status: string }[]>,
    prisma.sesiPembelajaran.findMany({ where: { trainingId }, select: { jp: true } }) as Promise<{ jp: number }[]>,
    prisma.penugasanApproval.findMany({ where: { trainingId, status: "disetujui" }, include: { instructor: true } }) as Promise<{ instructor: { nama: string } }[]>,
    prisma.evaluasiPengajar.findMany({ where: { trainingId }, select: { pesertaId: true } }) as Promise<{ pesertaId: string }[]>,
  ]);
  let lulus: number | null = null;
  let tidakLulus: number | null = null;
  let ditunda: number | null = null;
  try {
    const lembar = await getLembarPenilaian(trainingId, { peran: "PENYELENGGARA", email });
    const aktif = lembar.peserta.filter((p) => p.status === "AKTIF" && p.hasil);
    if (aktif.length && aktif.every((p) => p.hasil!.status !== "BELUM_LENGKAP")) {
      lulus = aktif.filter((p) => p.hasil!.status === "LULUS").length;
      tidakLulus = aktif.filter((p) => p.hasil!.status === "TIDAK_LULUS").length;
      ditunda = aktif.filter((p) => p.hasil!.status === "DITUNDA").length;
    }
  } catch {
    // diklat tanpa kurikulum/penilaian: bagian kelulusan dibiarkan kosong
  }
  return {
    pesertaAktif: peserta.filter((p) => p.status === "AKTIF").length,
    pesertaKeluar: peserta.filter((p) => p.status !== "AKTIF").length,
    lulus,
    tidakLulus,
    ditunda,
    sesi: sesi.length,
    jp: sesi.reduce((n, s) => n + s.jp, 0),
    pengajar: [...new Set(wi.map((w) => w.instructor.nama))],
    evaluasiPengajarResponden: new Set(responden.map((r) => r.pesertaId)).size,
  };
}

export type BawaanNaskahRecord = {
  jenis: JenisNaskah;
  trainingId: string | null;
  hal: string;
  kepada: string[];
  sifat: SifatSurat;
  lampiranTeks: string;
  tempat: string;
  isi: IsiNaskah;
  ttdJabatan: string;
  ttdNama: string;
  ttdNip: string;
  pegawaiIds: string[];
  tanggalTugas: RentangTanggal[];
  notaId: string | null;
};

/** Isian awal naskah baru: teks bawaan per jenis + data diklat + penanda tangan Kepala Balai. */
export async function bawaanNaskahBaru(
  jenis: JenisNaskah,
  trainingId: string | null,
  p: Pengguna,
  suratMasukId: string | null = null,
  notaId: string | null = null,
): Promise<BawaanNaskahRecord> {
  const def = jenisNaskah(jenis)!;
  // Surat tugas dari nota usulan: diklat, penerima, dan tanggal diambil dari nota & sesi studi lapangan.
  let nota: { jenis: string; nomor: string | null; hal: string; tanggal: Date; trainingId: string | null; pegawaiIds: string[] } | null = null;
  if (notaId) {
    nota = await prisma.naskahDinas.findUnique({
      where: { id: notaId },
      select: { jenis: true, nomor: true, hal: true, tanggal: true, trainingId: true, pegawaiIds: true },
    });
    if (!nota || nota.jenis !== "NOTA_USULAN") throw new NotFoundError("Nota usulan tidak ditemukan");
  }
  const diklatId = nota?.trainingId ?? trainingId;
  if (def.diklat && !diklatId) throw new ValidationError(`Pilih jadwal diklat untuk ${def.label}`);
  const dd = diklatId ? await dataDiklat(diklatId) : null;
  const b = bawaanNaskah(jenis, dd?.d ?? null, dd?.pesertaAktif ?? []);
  if (jenis === "LAPORAN" && diklatId && dd) b.isi.bagian = kerangkaLaporan(dd.d, await ringkasanDiklat(diklatId, p.email));
  const atur = await getPengaturanDokumen();
  let pegawaiIds: string[] = [];
  let tanggalTugas: RentangTanggal[] = [];
  if (jenis === "SURAT_TUGAS") {
    b.isi.dasar = dasarPerjalananDinas(atur.perjalanan.dipaTeks, Number(isoTanggal(awalHariWib()).slice(0, 4)));
    // Dari disposisi surat masuk: dasar = surat itu, penerima = pegawai yang didisposisi pimpinan.
    if (suratMasukId) {
      const sm = await getSuratMasuk(suratMasukId, p);
      b.isi.dasar.unshift(`Surat ${sm.asal} Nomor ${sm.nomorSurat}${sm.tanggalSurat ? ` tanggal ${tanggalPanjang(sm.tanggalSurat)}` : ""} hal ${sm.hal};`);
      pegawaiIds = [...new Set(sm.disposisi.map((d) => d.kepadaPegawaiId))];
      b.isi.untuk[0] = `Dalam rangka ${sm.hal}`;
    }
    // Dari nota usulan: penerima = pegawai yang diusulkan; tanggal = rentang sesi LAPANGAN angkatan.
    if (nota) {
      const sesi: { tanggal: Date }[] = diklatId
        ? await prisma.sesiPembelajaran.findMany({ where: { trainingId: diklatId, bentuk: "LAPANGAN" }, select: { tanggal: true }, orderBy: { tanggal: "asc" } })
        : [];
      pegawaiIds = [...nota.pegawaiIds];
      tanggalTugas = sesi.length ? [{ mulai: isoTanggal(sesi[0].tanggal), selesai: isoTanggal(sesi[sesi.length - 1].tanggal) }] : [];
      b.isi.dasar.unshift(`Nota Dinas ${nota.nomor ? `Nomor ${nota.nomor} ` : ""}tanggal ${tanggalPanjang(isoTanggal(nota.tanggal))} hal ${nota.hal};`);
      if (dd) b.isi.untuk[0] = `Mengikuti ${dd.d.nama}${dd.d.angkatan ? ` Angkatan ${dd.d.angkatan}` : ""}`;
      b.isi.untuk[0] = pasangKalimatTanggal(b.isi.untuk[0], tanggalTugas);
    }
  }
  const kb = await kepalaBalaiTerisi(atur);
  // Nota usulan ditandatangani Ketua Tim Diklat (bukan Kepala Balai): nama & NIP diisi penyusun.
  const notaUsulan = jenis === "NOTA_USULAN";
  return {
    jenis,
    ...b,
    trainingId: diklatId,
    tempat: KOTA_SURAT,
    ttdJabatan: notaUsulan ? "Ketua Tim Diklat" : JABATAN_KEPALA.join("\n"),
    ttdNama: notaUsulan ? "" : kb.nama,
    ttdNip: notaUsulan ? "" : kb.nip,
    pegawaiIds,
    tanggalTugas,
    notaId: nota ? notaId : null,
  };
}

// ------------------------------------------------------------------ AGENDA & PENOMORAN

export type AgendaRecord = {
  id: string;
  tahun: number;
  nomorUrut: number;
  nomor: string;
  kodeKlasifikasi: string;
  kodeUnit: string;
  jenis: string;
  hal: string;
  tanggal: string;
  sumber: string;
  sumberId: string | null;
  dicatatOleh: string;
};

type BarisAgenda = Omit<AgendaRecord, "tanggal"> & { tanggal: Date };
const keAgenda = (r: BarisAgenda): AgendaRecord => ({ ...r, tanggal: isoTanggal(r.tanggal) });

export async function listAgenda(tahun: number): Promise<{ tahun: number; terakhir: number; baris: AgendaRecord[] }> {
  const rows: BarisAgenda[] = await prisma.agendaSurat.findMany({
    where: { tahun },
    select: { id: true, tahun: true, nomorUrut: true, nomor: true, kodeKlasifikasi: true, kodeUnit: true, jenis: true, hal: true, tanggal: true, sumber: true, sumberId: true, dicatatOleh: true },
    orderBy: [{ nomorUrut: "desc" }, { kodeUnit: "asc" }],
  });
  const p: { terakhir: number } | null = await prisma.penghitungNomorSurat.findUnique({ where: { id: String(tahun) }, select: { terakhir: true } });
  return { tahun, terakhir: p?.terakhir ?? 0, baris: rows.map(keAgenda) };
}

/** Nomor urut berikutnya untuk tahun itu — dinaikkan atomik (UPDATE … SET terakhir = terakhir + 1). */
async function nomorUrutBerikut(tahun: number): Promise<number> {
  const id = String(tahun);
  for (let coba = 0; coba < 2; coba++) {
    try {
      const r: { terakhir: number } = await prisma.penghitungNomorSurat.upsert({
        where: { id },
        update: { terakhir: { increment: 1 } },
        create: { id, terakhir: 1 },
        select: { terakhir: true },
      });
      return r.terakhir;
    } catch (e) {
      // Dua permintaan pertama di tahun baru bersamaan: salah satu kalah membuat baris -> ulangi sebagai update.
      if (kodePrisma(e) !== "P2002" || coba > 0) throw e;
    }
  }
  throw new ConflictError("Nomor surat gagal dibuat, coba lagi.");
}

/** Atur nomor terakhir (awal pemakaian aplikasi: lanjutkan buku agenda lama). Tidak boleh mundur. */
export async function aturPenghitung(tahun: number, terakhir: number): Promise<{ tahun: number; terakhir: number }> {
  const maks: { nomorUrut: number } | null = await prisma.agendaSurat.findFirst({ where: { tahun }, orderBy: { nomorUrut: "desc" }, select: { nomorUrut: true } });
  if (maks && terakhir < maks.nomorUrut) throw new ValidationError(`Nomor terakhir tidak boleh kurang dari nomor yang sudah dipakai (${maks.nomorUrut})`);
  const id = String(tahun);
  await prisma.penghitungNomorSurat.upsert({ where: { id }, update: { terakhir }, create: { id, terakhir } });
  return { tahun, terakhir };
}

type SumberData = { hal: string; jenis: string; tanggal: string; sudah: boolean; /** Cuti: Surat Izin diterbitkan balai (perlu nomor kedua). */ izinDiBalai?: boolean };

async function dataSumber(sumber: SumberAgenda, id: string): Promise<SumberData> {
  switch (sumber) {
    case "naskah": {
      const r: { hal: string; jenis: string; tanggal: Date; id: string } | null = await prisma.naskahDinas.findUnique({ where: { id }, select: { id: true, hal: true, jenis: true, tanggal: true } });
      if (!r) throw new NotFoundError("Naskah tidak ditemukan");
      const sudah = (await prisma.agendaSurat.count({ where: { sumber, sumberId: id } })) > 0;
      return { hal: r.hal || labelJenisNaskah(r.jenis), jenis: labelJenisNaskah(r.jenis), tanggal: isoTanggal(r.tanggal), sudah };
    }
    case "surat-tugas": {
      const r: { tanggal: Date; training: { name: string } } | null = await prisma.suratTugas.findUnique({ where: { id }, select: { tanggal: true, training: { select: { name: true } } } });
      if (!r) throw new NotFoundError("Surat tugas tidak ditemukan");
      const sudah = (await prisma.agendaSurat.count({ where: { sumber, sumberId: id } })) > 0;
      return { hal: `Surat Tugas mengajar ${r.training.name}`, jenis: "Surat Tugas", tanggal: isoTanggal(r.tanggal), sudah };
    }
    case "surat-keterangan": {
      const r: { tanggal: Date; jenis: string; peserta: { nama: string } } | null = await prisma.suratKeterangan.findUnique({ where: { id }, select: { tanggal: true, jenis: true, peserta: { select: { nama: true } } } });
      if (!r) throw new NotFoundError("Surat keterangan tidak ditemukan");
      const sudah = (await prisma.agendaSurat.count({ where: { sumber, sumberId: id } })) > 0;
      return { hal: `Surat Keterangan ${r.jenis === "DITUNDA" ? "ditunda" : "tidak lulus"} a.n. ${r.peserta.nama}`, jenis: "Surat Keterangan", tanggal: isoTanggal(r.tanggal), sudah };
    }
    case "cuti": {
      const r: { jenis: string; lamaHari: number; mulai: Date; selesai: Date; status: string; tanggalSurat: Date | null; pegawai: { nama: string; jabatan: string | null } } | null =
        await prisma.cutiPegawai.findUnique({
          where: { id },
          select: { jenis: true, lamaHari: true, mulai: true, selesai: true, status: true, tanggalSurat: true, pegawai: { select: { nama: true, jabatan: true } } },
        });
      if (!r) throw new NotFoundError("Pengajuan cuti tidak ditemukan");
      if (r.status !== "DISETUJUI") throw new ConflictError("Nomor surat cuti diberikan setelah cuti disetujui");
      const sudah = (await prisma.agendaSurat.count({ where: { sumber, sumberId: id } })) > 0;
      const izinDiBalai = pemberiIzinUntuk(r, r.pegawai.jabatan).diBalai;
      return {
        hal: `${labelJenisCuti(r.jenis)} a.n. ${r.pegawai.nama}`,
        jenis: izinDiBalai ? "Nota Dinas & Surat Izin Cuti" : "Nota Dinas Cuti",
        tanggal: r.tanggalSurat ? isoTanggal(r.tanggalSurat) : isoTanggal(awalHariWib()),
        sudah,
        izinDiBalai,
      };
    }
    case "manual":
      throw new ValidationError("Sumber manual tidak punya naskah");
  }
}

/**
 * Beri nomor surat keluar (TU). Pemberian nomor dilakukan setelah naskah ditandatangani
 * (Permendagri 18/2024 Ps. 59). Satu seri nomor urut per tahun untuk semua surat keluar.
 * Cuti: nota dinas (…/kepeg) & surat izin (…/BBPKA-PDN II) berbagi nomor urut.
 */
export async function beriNomor(
  input: { sumber: SumberAgenda; sumberId?: string | null; kodeKlasifikasi: string; kodeUnit?: string | null; hal?: string | null; jenis?: string | null; tanggal?: string | null },
  email: string,
): Promise<AgendaRecord[]> {
  let s: SumberData;
  if (input.sumber === "manual") {
    if (!input.hal?.trim()) throw new ValidationError("Hal surat wajib diisi");
    if (!input.tanggal) throw new ValidationError("Tanggal surat wajib diisi");
    s = { hal: input.hal.trim(), jenis: input.jenis?.trim() || "Surat", tanggal: input.tanggal.slice(0, 10), sudah: false };
  } else {
    if (!input.sumberId) throw new ValidationError("Pilih surat yang akan diberi nomor");
    s = await dataSumber(input.sumber, input.sumberId);
  }
  if (s.sudah) throw new ConflictError("Surat ini sudah punya nomor di buku agenda");
  // Surat tugas yang diberi nomor menjadi mengikat: cek ulang bentrok dengan surat bernomor lain & cuti.
  if (input.sumber === "naskah") {
    const n: { jenis: string; pegawaiIds: string[]; tanggalTugas: unknown } | null = await prisma.naskahDinas.findUnique({ where: { id: input.sumberId! }, select: { jenis: true, pegawaiIds: true, tanggalTugas: true } });
    if (n?.jenis === "SURAT_TUGAS") await wajibTanpaBentrok(n.pegawaiIds, rapikanRentang(n.tanggalTugas), { konteks: "umum", naskahId: input.sumberId });
  }
  if (input.sumber === "surat-tugas") {
    const st: { pegawaiIds: string[]; tanggalTugas: unknown; trainingId: string } | null = await prisma.suratTugas.findUnique({
      where: { id: input.sumberId! },
      select: { pegawaiIds: true, tanggalTugas: true, trainingId: true },
    });
    if (st) {
      const tgl = rapikanRentang(st.tanggalTugas);
      for (const id of st.pegawaiIds) {
        const hari = tgl.length ? tgl : await hariMengajarDi(id, st.trainingId);
        if (hari.length) await wajibTanpaBentrok([id], hari, { konteks: "mengajar", suratTugasId: input.sumberId, trainingId: st.trainingId });
      }
    }
  }
  const tahun = Number(s.tanggal.slice(0, 4));
  const urut = await nomorUrutBerikut(tahun);
  const kode = input.kodeKlasifikasi.trim();
  const unitUtama = input.kodeUnit?.trim() || KODE_UNIT_BAWAAN;
  const tanggal = new Date(`${s.tanggal}T00:00:00Z`);
  // Cuti: nota dinas …/kepeg; surat izin hanya bila izinnya diberikan Kepala Balai (Permendagri 81/2018).
  const units = input.sumber === "cuti" ? (s.izinDiBalai ? [KODE_UNIT_KEPEGAWAIAN, unitUtama] : [KODE_UNIT_KEPEGAWAIAN]) : [unitUtama];
  const dibuat: AgendaRecord[] = [];
  for (const unit of units) {
    const nomor = susunNomor(kode, urut, unit);
    const jenis = input.sumber === "cuti" ? (unit === KODE_UNIT_KEPEGAWAIAN ? "Nota Dinas Cuti" : "Surat Izin Cuti") : s.jenis;
    let r: BarisAgenda;
    try {
      r = await prisma.agendaSurat.create({
        data: { tahun, nomorUrut: urut, kodeKlasifikasi: kode, kodeUnit: unit, nomor, jenis, hal: s.hal, tanggal, sumber: input.sumber, sumberId: input.sumberId ?? null, dicatatOleh: email },
      });
    } catch (e) {
      // Surat yang sama diberi nomor bersamaan oleh dua orang: yang kalah ditolak (nomor urutnya terlewat).
      if (kodePrisma(e) === "P2002") throw new ConflictError("Surat ini baru saja diberi nomor oleh pengguna lain");
      throw e;
    }
    dibuat.push(keAgenda(r));
  }
  const nomorUtama = dibuat[dibuat.length - 1].nomor;
  switch (input.sumber) {
    case "naskah":
      await prisma.naskahDinas.update({ where: { id: input.sumberId! }, data: { nomor: nomorUtama } });
      break;
    case "surat-tugas":
      await prisma.suratTugas.update({ where: { id: input.sumberId! }, data: { nomor: nomorUtama } });
      break;
    case "surat-keterangan":
      await prisma.suratKeterangan.update({ where: { id: input.sumberId! }, data: { nomor: nomorUtama } });
      break;
    case "cuti":
      await prisma.cutiPegawai.update({ where: { id: input.sumberId! }, data: { nomorNotaDinas: dibuat[0].nomor, nomorSuratIzin: s.izinDiBalai ? nomorUtama : null, tanggalSurat: tanggal } });
      break;
  }
  return dibuat;
}

// ------------------------------------------------------------------ PILIHAN (isian form)

export type PilihanPersuratan = {
  pegawai: { id: string; nama: string; nip: string; jabatan: string }[];
  diklat: { id: string; name: string; startDate: string }[];
};

/** Daftar pegawai aktif & jadwal diklat untuk pilihan di form persuratan. */
export async function pilihanPersuratan(): Promise<PilihanPersuratan> {
  const [pegawai, diklat] = await Promise.all([
    prisma.pegawai.findMany({
      select: { id: true, nama: true, nip: true, jabatan: true, status: true },
      orderBy: [{ no: "asc" }, { nama: "asc" }],
    }) as Promise<{ id: string; nama: string; nip: string | null; jabatan: string | null; status: string | null }[]>,
    prisma.training.findMany({ select: { id: true, name: true, startDate: true }, orderBy: { startDate: "desc" }, take: 200 }) as Promise<{ id: string; name: string; startDate: Date }[]>,
  ]);
  return {
    pegawai: pegawai.filter((p) => !statusMenutupAkun(p.status)).map((p) => ({ id: p.id, nama: p.nama, nip: p.nip ?? "", jabatan: p.jabatan ?? "" })),
    diklat: diklat.map((t) => ({ id: t.id, name: t.name, startDate: isoTanggal(t.startDate) })),
  };
}
