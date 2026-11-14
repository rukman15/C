import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { isoTanggal } from "@/lib/tanggal";
import { JABATAN_KEPALA, KOTA_SURAT } from "@/lib/aplikasi";
import { pangkatGolongan } from "@/lib/dokumen";
import { getPengaturanDokumen, pangkatDariNip, ttdKepalaBalai } from "@/lib/server/repositories/dokumen";
import { getJabatanProfile } from "@/lib/jabatanProfiles";
import {
  LABEL_STATUS_CUTI,
  PEMBERI_IZIN,
  beririsan,
  kelompokJabatanCuti,
  labelJenisCuti,
  pemberiIzinCuti,
  periksaCuti,
  type DataCutiSurat,
  type JenisCuti,
  type PemberiIzinCuti,
  type StatusCuti,
} from "@/lib/persuratan";
import { PEMUTUS_CUTI, PENGELOLA_CUTI, termasuk, type Pengguna } from "@/lib/server/akses-persuratan";
import type { Penandatangan } from "@/lib/tata-naskah";

/**
 * Cuti pegawai -> Nota Dinas permohonan (Kabag TU → Kepala Balai) + Surat Izin Cuti ditandatangani
 * Kepala Balai bila kewenangannya ada di balai (Permendagri 81/2018 Ps. 11 ayat 4; selain itu hanya nota
 * dinas — izin dari pusat), satu nomor urut (CATATAN-SURAT-MENYURAT.md D3). Cuti sakit: rincian medis tidak disimpan.
 * Cuti DISETUJUI dipakai untuk menolak penugasan WI pada periode yang beririsan.
 */

export type CutiRecord = {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  pegawaiJabatan: string;
  jenis: JenisCuti;
  label: string;
  mulai: string;
  selesai: string;
  lamaHari: number;
  alasan: string | null;
  status: StatusCuti;
  labelStatus: string;
  alasanTolak: string | null;
  diputuskanOleh: string | null;
  nomorNotaDinas: string | null;
  nomorSuratIzin: string | null;
  tanggalSurat: string | null;
  diajukanOleh: string;
  createdAt: string;
  /** Pejabat pemberi izin (Permendagri 81/2018); bukan Kepala Balai = izin dari pusat, balai hanya membuat nota dinas. */
  pemberiIzin: PemberiIzinCuti;
};

type Baris = {
  id: string;
  pegawaiId: string;
  pegawai: { nama: string; jabatan: string | null };
  jenis: string;
  mulai: Date;
  selesai: Date;
  lamaHari: number;
  alasan: string | null;
  status: string;
  alasanTolak: string | null;
  diputuskanOleh: string | null;
  nomorNotaDinas: string | null;
  nomorSuratIzin: string | null;
  tanggalSurat: Date | null;
  diajukanOleh: string;
  createdAt: Date;
};

type CutiDasar = { jenis: string; lamaHari: number; mulai: Date; selesai: Date };

const SERTA = { pegawai: { select: { nama: true, jabatan: true } } } as const;

const keRecord = (r: Baris): CutiRecord => ({
  id: r.id,
  pegawaiId: r.pegawaiId,
  pegawaiNama: r.pegawai.nama,
  pegawaiJabatan: r.pegawai.jabatan ?? "",
  jenis: r.jenis as JenisCuti,
  label: labelJenisCuti(r.jenis),
  mulai: isoTanggal(r.mulai),
  selesai: isoTanggal(r.selesai),
  lamaHari: r.lamaHari,
  alasan: r.alasan,
  status: r.status as StatusCuti,
  labelStatus: LABEL_STATUS_CUTI[r.status as StatusCuti] ?? r.status,
  alasanTolak: r.alasanTolak,
  diputuskanOleh: r.diputuskanOleh,
  nomorNotaDinas: r.nomorNotaDinas,
  nomorSuratIzin: r.nomorSuratIzin,
  tanggalSurat: r.tanggalSurat ? isoTanggal(r.tanggalSurat) : null,
  diajukanOleh: r.diajukanOleh,
  createdAt: r.createdAt.toISOString(),
  pemberiIzin: hitungPemberi(r, r.pegawai.jabatan),
});

const hitungPemberi = (r: CutiDasar, jabatan: string | null) =>
  pemberiIzinCuti(
    { jenis: r.jenis, lamaHari: r.lamaHari, mulai: isoTanggal(r.mulai), selesai: isoTanggal(r.selesai) },
    kelompokJabatanCuti(jabatan, getJabatanProfile(jabatan).id === "pimpinan-unit"),
  );

/** Pengelola melihat semua (opsional per status); pegawai lain hanya cutinya sendiri. */
export async function listCuti(p: Pengguna, f: { status?: string | null; tahun?: number | null }): Promise<CutiRecord[]> {
  const where: Record<string, unknown> = {};
  if (!termasuk(p, PENGELOLA_CUTI)) {
    if (!p.pegawaiId) return [];
    where.pegawaiId = p.pegawaiId;
  }
  if (f.status) where.status = f.status;
  if (f.tahun) where.mulai = { gte: new Date(Date.UTC(f.tahun, 0, 1)), lt: new Date(Date.UTC(f.tahun + 1, 0, 1)) };
  const rows: Baris[] = await prisma.cutiPegawai.findMany({ where, include: SERTA, orderBy: [{ mulai: "desc" }, { createdAt: "desc" }], take: 500 });
  return rows.map(keRecord);
}

async function baris(id: string): Promise<Baris> {
  const r: Baris | null = await prisma.cutiPegawai.findUnique({ where: { id }, include: SERTA });
  if (!r) throw new NotFoundError("Pengajuan cuti tidak ditemukan");
  return r;
}

function wajibBaca(p: Pengguna, r: { pegawaiId: string }) {
  if (!termasuk(p, PENGELOLA_CUTI) && r.pegawaiId !== p.pegawaiId) throw new ForbiddenError();
}

export async function getCuti(id: string, p: Pengguna): Promise<CutiRecord> {
  const r = await baris(id);
  wajibBaca(p, r);
  return keRecord(r);
}

const tgl = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * Membuat surat cuti (keputusan 28 Okt 2026: cuti TIDAK diajukan/diputuskan di aplikasi — aplikasi hanya
 * membuat Nota Dinas + Surat Izin). Dibuat Kepegawaian/TU/Kepala Balai; baris langsung DISETUJUI (cuti yang
 * berlaku), sehingga tetap dipakai untuk cek bentrok penugasan & surat tugas. Nomor diketik pembuat surat.
 */
export async function buatSuratCuti(
  i: {
    pegawaiId?: string | null;
    jenis: string;
    mulai: string;
    selesai: string;
    lamaHari: number;
    alasan?: string | null;
    nomorNotaDinas?: string | null;
    nomorSuratIzin?: string | null;
  },
  p: Pengguna,
): Promise<CutiRecord> {
  if (!termasuk(p, PENGELOLA_CUTI)) throw new ForbiddenError("Surat cuti dibuat oleh Kepegawaian/TU.");
  const pegawaiId = i.pegawaiId || p.pegawaiId;
  if (!pegawaiId) throw new ValidationError("Pilih pegawai");
  const galat = periksaCuti(i);
  if (galat.length) throw new ValidationError(galat.join("; "));
  const peg: { id: string } | null = await prisma.pegawai.findUnique({ where: { id: pegawaiId }, select: { id: true } });
  if (!peg) throw new NotFoundError("Pegawai tidak ditemukan");
  const lain: { mulai: Date; selesai: Date }[] = await prisma.cutiPegawai.findMany({
    where: { pegawaiId, status: { in: ["DIAJUKAN", "DISETUJUI"] } },
    select: { mulai: true, selesai: true },
  });
  if (lain.some((c) => beririsan({ mulai: isoTanggal(c.mulai), selesai: isoTanggal(c.selesai) }, i))) {
    throw new ConflictError("Sudah ada cuti pegawai ini pada tanggal yang beririsan");
  }
  const r: Baris = await prisma.cutiPegawai.create({
    data: {
      pegawaiId,
      jenis: i.jenis,
      mulai: tgl(i.mulai),
      selesai: tgl(i.selesai),
      lamaHari: i.lamaHari,
      // Cuti sakit: alasan medis tidak disimpan (data kesehatan).
      alasan: i.jenis === "SAKIT" ? null : i.alasan?.trim() || null,
      diajukanOleh: p.email,
      status: "DISETUJUI",
      diputuskanOleh: p.email,
      diputuskanPada: new Date(),
      nomorNotaDinas: i.nomorNotaDinas?.trim() || null,
      nomorSuratIzin: i.nomorSuratIzin?.trim() || null,
    },
    include: SERTA,
  });
  return keRecord(r);
}

/** Isi/ubah nomor surat cuti (diketik pembuat surat). Pengelola cuti. */
export async function isiNomorCuti(id: string, n: { nomorNotaDinas: string | null; nomorSuratIzin: string | null }, p: Pengguna): Promise<CutiRecord> {
  if (!termasuk(p, PENGELOLA_CUTI)) throw new ForbiddenError("Nomor surat cuti diisi Kepegawaian/TU.");
  await baris(id);
  await prisma.cutiPegawai.updateMany({
    where: { id },
    data: { nomorNotaDinas: n.nomorNotaDinas?.trim() || null, nomorSuratIzin: n.nomorSuratIzin?.trim() || null },
  });
  return keRecord(await baris(id));
}

/** Hapus surat cuti yang salah dibuat. Pengelola cuti. */
export async function hapusCuti(id: string, p: Pengguna): Promise<void> {
  if (!termasuk(p, PENGELOLA_CUTI)) throw new ForbiddenError("Surat cuti dihapus Kepegawaian/TU.");
  await baris(id);
  await prisma.cutiPegawai.deleteMany({ where: { id } });
}

/**
 * Setujui / tolak (PEMUTUS_CUTI), atau batalkan — hanya untuk pengajuan LAMA yang masih "DIAJUKAN"
 * (dibuat sebelum 28 Okt 2026). Surat cuti baru langsung berlaku.
 */
export async function putuskanCuti(id: string, k: { aksi: "setujui" } | { aksi: "tolak"; alasanTolak: string } | { aksi: "batal" }, p: Pengguna): Promise<CutiRecord> {
  const r = await baris(id);
  if (k.aksi === "batal") {
    if (r.pegawaiId !== p.pegawaiId && r.diajukanOleh !== p.email && !termasuk(p, PENGELOLA_CUTI)) throw new ForbiddenError();
    if (r.status !== "DIAJUKAN") throw new ConflictError(`Cuti ini sudah ${LABEL_STATUS_CUTI[r.status as StatusCuti]?.toLowerCase() ?? r.status}`);
    await prisma.cutiPegawai.updateMany({ where: { id, status: "DIAJUKAN" }, data: { status: "DIBATALKAN" } });
    return keRecord(await baris(id));
  }
  if (!termasuk(p, PEMUTUS_CUTI)) throw new ForbiddenError("Cuti disetujui/ditolak Kabag TU atau Kepala Balai.");
  if (r.pegawaiId === p.pegawaiId) throw new ForbiddenError("Tidak bisa memutuskan cuti sendiri.");
  const { count } = await prisma.cutiPegawai.updateMany({
    where: { id, status: "DIAJUKAN" },
    data: {
      status: k.aksi === "setujui" ? "DISETUJUI" : "DITOLAK",
      alasanTolak: k.aksi === "tolak" ? k.alasanTolak.trim() : null,
      diputuskanOleh: p.email,
      diputuskanPada: new Date(),
    },
  });
  if (count === 0) throw new ConflictError("Cuti ini sudah diputuskan atau dibatalkan");
  return keRecord(await baris(id));
}

/** Cuti DISETUJUI seorang pegawai yang beririsan dengan periode (untuk penugasan WI). */
export async function cutiDisetujuiBeririsan(pegawaiId: string, periode: { mulai: string; selesai: string }): Promise<CutiRecord[]> {
  const rows: Baris[] = await prisma.cutiPegawai.findMany({
    where: { pegawaiId, status: "DISETUJUI", mulai: { lte: tgl(periode.selesai) }, selesai: { gte: tgl(periode.mulai) } },
    include: SERTA,
  });
  return rows.map(keRecord);
}

export type SuratCutiRecord = {
  cuti: CutiRecord;
  data: DataCutiSurat;
  tempat: string;
  tanggal: string;
  /** Pejabat yang berwenang memberi izin (Permendagri 81/2018). */
  pemberiIzin: PemberiIzinCuti;
  /** Nota dinas ditujukan langsung kepada pemberi izin (pemohon Kepala Balai → Kepala BPSDM). */
  kepadaPemberi: boolean;
  /** Nota dinas: Yth., Dari, Tembusan. */
  notaDinas: { yth: string; dari: string; tembusan: string[]; sifat: string; lampiran: string };
  ttdNotaDinas: Penandatangan;
  /** Surat izin ditandatangani Kepala Balai sendiri; null bila izin diberikan pejabat pusat. */
  ttdIzin: Penandatangan | null;
};

/** Pemberi izin cuti menurut jenis, lama, dan jabatan pemohon. */
export const pemberiIzinUntuk = (r: CutiDasar, jabatan: string | null): PemberiIzinCuti => hitungPemberi(r, jabatan);

/** Data cetak Nota Dinas + Surat Izin Cuti (hanya cuti DISETUJUI). */
export async function suratCuti(id: string, p: Pengguna): Promise<SuratCutiRecord> {
  const r = await baris(id);
  wajibBaca(p, r);
  if (r.status !== "DISETUJUI") throw new ConflictError("Surat cuti dibuat setelah cuti disetujui");
  const peg: { nama: string; nip: string | null; pangkat: string | null; golRuang: string | null; jabatan: string | null; jenisKepegawaian: string | null } | null =
    await prisma.pegawai.findUnique({ where: { id: r.pegawaiId }, select: { nama: true, nip: true, pangkat: true, golRuang: true, jabatan: true, jenisKepegawaian: true } });
  if (!peg) throw new NotFoundError("Pegawai tidak ditemukan");
  const pemberi = pemberiIzinUntuk(r, peg.jabatan);
  const pimpinan = getJabatanProfile(peg.jabatan).id === "pimpinan-unit";
  const kabag = (await getPengaturanDokumen()).kabagTu;
  const kepala = JABATAN_KEPALA.join(" ").replace(/,$/, "");
  const ttdKepala = await ttdKepalaBalai(JABATAN_KEPALA);
  const lampiran = r.jenis === "SAKIT" ? "1 (satu) berkas" : "-";
  // Cuti Kepala Balai: nota dinas dari Kepala Balai kepada Kepala BPSDM; selain itu Kabag TU → Kepala Balai.
  const nota = pimpinan
    ? { yth: PEMBERI_IZIN.KEPALA_BPSDM, dari: kepala, tembusan: [] as string[], ttd: ttdKepala }
    : {
        yth: kepala,
        dari: "Kepala Bagian Tata Usaha",
        tembusan: ["Kepala Subbagian SDM dan Umum"],
        ttd: { jabatan: ["Kepala Bagian Tata Usaha,"], nama: kabag.nama, nip: kabag.nip, pangkat: await pangkatDariNip(kabag.nip) },
      };
  return {
    cuti: keRecord(r),
    data: {
      jenis: r.jenis as JenisCuti,
      mulai: isoTanggal(r.mulai),
      selesai: isoTanggal(r.selesai),
      lamaHari: r.lamaHari,
      alasan: r.alasan,
      pegawai: { nama: peg.nama, nip: peg.nip ?? "", pangkat: pangkatGolongan(peg.pangkat, peg.golRuang), jabatan: peg.jabatan ?? "", jenisKepegawaian: peg.jenisKepegawaian ?? "" },
    },
    tempat: KOTA_SURAT,
    tanggal: r.tanggalSurat ? isoTanggal(r.tanggalSurat) : isoTanggal(r.createdAt),
    pemberiIzin: pemberi,
    kepadaPemberi: pimpinan && pemberi.kode === "KEPALA_BPSDM",
    notaDinas: { yth: nota.yth, dari: nota.dari, tembusan: nota.tembusan, sifat: "Penting", lampiran },
    ttdNotaDinas: nota.ttd,
    ttdIzin: pemberi.diBalai ? ttdKepala : null,
  };
}
