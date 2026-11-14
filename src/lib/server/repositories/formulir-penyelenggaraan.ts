import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import { isoTanggal } from "@/lib/tanggal";
import { EVALUASI, labelEvaluasi } from "@/lib/penilaian";
import type { JenisEvaluasi } from "@/lib/kurikulum";
import { namaProgram } from "@/lib/kurikulum";
import { pangkatGolongan } from "@/lib/dokumen";
import { KOTA_SURAT } from "@/lib/aplikasi";
import {
  FORMULIR_2,
  barisFormulir15,
  isKodeButirFormulir2,
  ringkasPemantauan,
  teksPaktaIntegritas,
  type BarisRemedial,
  type IsianPemantauan,
  type ProgramFormulir,
} from "@/lib/formulir-penyelenggaraan";

/**
 * Formulir penyelenggaraan PKA/PKP (Pedoman KepKa LAN 2/2023, Anak Lampiran 1) — keputusan 14 Okt 2026:
 *   Formulir 1  (pakta integritas)  : isian identitas peserta, dicetak lalu ditandatangani bermaterai;
 *   Formulir 2  (pemantauan persiapan): isian penyelenggara per butir, tabel `pemantauan_persiapan`;
 *   Formulir 15 (laporan remedial)   : dari hasil penilaian + pelaksanaan, tabel `pelaksanaan_remedial`.
 * Logika & teks: src/lib/formulir-penyelenggaraan.ts.
 */

type InfoDiklat = { id: string; name: string; jenisPelatihan: string | null; angkatan: string | null; startDate: Date; endDate: Date | null };

async function diklat(trainingId: string): Promise<InfoDiklat> {
  const t: InfoDiklat | null = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true, name: true, jenisPelatihan: true, angkatan: true, startDate: true, endDate: true },
  });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  return t;
}

export type InfoDiklatRecord = { id: string; nama: string; program: string; mulai: string; selesai: string | null };
const infoDiklat = (t: InfoDiklat): InfoDiklatRecord => ({
  id: t.id,
  nama: t.name,
  program: namaProgram(t.jenisPelatihan, t.angkatan) || t.name,
  mulai: isoTanggal(t.startDate),
  selesai: t.endDate ? isoTanggal(t.endDate) : null,
});

// ------------------------------------------------------------------ FORMULIR 2

export type ButirPemantauanRecord = { kode: string; teks: string; jangkaWaktu: string; penanggungJawab: string; selesai: boolean; diubahOleh: string | null };
export type PemantauanRecord = {
  diklat: InfoDiklatRecord;
  bagian: { kode: string; judul: string; butir: ButirPemantauanRecord[] }[];
  ringkas: ReturnType<typeof ringkasPemantauan>;
};

type BarisPemantauan = { kode: string; jangkaWaktu: string | null; penanggungJawab: string | null; selesai: boolean; diubahOleh: string | null };

export async function getPemantauan(trainingId: string): Promise<PemantauanRecord> {
  const t = await diklat(trainingId);
  const rows: BarisPemantauan[] = await prisma.pemantauanPersiapan.findMany({
    where: { trainingId },
    select: { kode: true, jangkaWaktu: true, penanggungJawab: true, selesai: true, diubahOleh: true },
  });
  const peta = new Map(rows.map((r) => [r.kode, r]));
  return {
    diklat: infoDiklat(t),
    bagian: FORMULIR_2.map((s) => ({
      kode: s.kode,
      judul: s.judul,
      butir: s.butir.map((x) => {
        const r = peta.get(x.kode);
        return { kode: x.kode, teks: x.teks, jangkaWaktu: r?.jangkaWaktu ?? "", penanggungJawab: r?.penanggungJawab ?? "", selesai: r?.selesai ?? false, diubahOleh: r?.diubahOleh ?? null };
      }),
    })),
    ringkas: ringkasPemantauan(rows.map((r) => ({ kode: r.kode, selesai: r.selesai }))),
  };
}

/** Simpan beberapa butir sekaligus (yang dikirim saja). */
export async function simpanPemantauan(trainingId: string, isian: IsianPemantauan[], email: string): Promise<PemantauanRecord> {
  await diklat(trainingId);
  const salah = isian.filter((x) => !isKodeButirFormulir2(x.kode)).map((x) => x.kode);
  if (salah.length) throw new ValidationError(`Butir tidak dikenal: ${salah.join(", ")}`);
  for (const x of isian) {
    const data = { jangkaWaktu: x.jangkaWaktu?.trim() || null, penanggungJawab: x.penanggungJawab?.trim() || null, selesai: x.selesai, diubahOleh: email };
    await prisma.pemantauanPersiapan.upsert({
      where: { trainingId_kode: { trainingId, kode: x.kode } },
      update: data,
      create: { trainingId, kode: x.kode, ...data },
    });
  }
  return getPemantauan(trainingId);
}

// ------------------------------------------------------------------ FORMULIR 15

export type RemedialPesertaRecord = {
  pesertaId: string;
  nomor: number;
  nama: string;
  nip: string | null;
  instansi: string | null;
  /** Status akhir sekarang (setelah remedial bila sudah dinilai). */
  status: string;
  baris: (BarisRemedial & { jenis: JenisEvaluasi })[];
  perluKeputusanTim: boolean;
};
export type RemedialJadwalRecord = { diklat: InfoDiklatRecord; peserta: RemedialPesertaRecord[] };

type BarisPelaksanaan = { pesertaId: string; jenisEvaluasi: string; tanggal: Date | null; waktu: string | null; teknis: string | null; catatan: string | null };

/**
 * Peserta yang hasil evaluasi akhir PERTAMA-nya ditunda (ada evaluasi kurang baik) — dasar Formulir 15.
 * Nilai remedial dari lembar penilaian (kode REMEDIAL-…); waktu/tanggal/teknis/catatan dari `pelaksanaan_remedial`.
 */
export async function getRemedialJadwal(trainingId: string, email: string): Promise<RemedialJadwalRecord> {
  const t = await diklat(trainingId);
  const lembar = await getLembarPenilaian(trainingId, { peran: "PENYELENGGARA", email });
  const calon = lembar.peserta.filter((p) => p.status === "AKTIF" && p.hasil?.statusAwal === "DITUNDA");
  const rows: BarisPelaksanaan[] = calon.length
    ? await prisma.pelaksanaanRemedial.findMany({
        where: { pesertaId: { in: calon.map((p) => p.id) } },
        select: { pesertaId: true, jenisEvaluasi: true, tanggal: true, waktu: true, teknis: true, catatan: true },
      })
    : [];
  const peta = new Map(rows.map((r) => [`${r.pesertaId}|${r.jenisEvaluasi}`, r]));
  return {
    diklat: infoDiklat(t),
    peserta: calon.map((p) => {
      const kurang = p.hasil!.evaluasi.filter((e) => e.kualifikasiAwal === "KURANG_BAIK");
      const baris = barisFormulir15(
        kurang.map((e) => {
          const r = peta.get(`${p.id}|${e.kode}`);
          return {
            label: labelEvaluasi(e.kode),
            bisaRemedial: EVALUASI.find((x) => x.kode === e.kode)?.remedial ?? false,
            pelaksanaan: { waktu: r?.waktu ?? null, tanggal: r?.tanggal ? isoTanggal(r.tanggal) : null, teknis: r?.teknis ?? null, nilai: e.remedial, catatan: r?.catatan ?? null },
          };
        }),
      );
      return {
        pesertaId: p.id,
        nomor: p.nomor,
        nama: p.nama,
        nip: p.nip ?? null,
        instansi: p.instansi ?? null,
        status: p.hasil!.status,
        baris: baris.map((b, i) => ({ ...b, jenis: kurang[i].kode })),
        perluKeputusanTim: p.hasil!.perluKeputusanTim,
      };
    }),
  };
}

export type IsianPelaksanaanRemedial = { pesertaId: string; jenisEvaluasi: string; tanggal?: string | null; waktu?: string | null; teknis?: string | null; catatan?: string | null };

export async function simpanPelaksanaanRemedial(trainingId: string, i: IsianPelaksanaanRemedial, email: string): Promise<RemedialJadwalRecord> {
  const jadwal = await getRemedialJadwal(trainingId, email);
  const p = jadwal.peserta.find((x) => x.pesertaId === i.pesertaId);
  if (!p) throw new ValidationError("Peserta ini tidak berstatus ditunda pada evaluasi akhir pertama");
  if (!p.baris.some((b) => b.jenis === i.jenisEvaluasi)) throw new ValidationError("Evaluasi ini tidak berkualifikasi kurang baik untuk peserta tersebut");
  const data = {
    tanggal: i.tanggal ? new Date(`${i.tanggal.slice(0, 10)}T00:00:00Z`) : null,
    waktu: i.waktu?.trim() || null,
    teknis: i.teknis?.trim() || null,
    catatan: i.catatan?.trim() || null,
    diubahOleh: email,
  };
  await prisma.pelaksanaanRemedial.upsert({
    where: { pesertaId_jenisEvaluasi: { pesertaId: i.pesertaId, jenisEvaluasi: i.jenisEvaluasi } },
    update: data,
    create: { pesertaId: i.pesertaId, jenisEvaluasi: i.jenisEvaluasi, ...data },
  });
  return getRemedialJadwal(trainingId, email);
}

// ------------------------------------------------------------------ FORMULIR 1

export type PaktaRecord = { diklat: InfoDiklatRecord; tempat: string; isi: ReturnType<typeof teksPaktaIntegritas> };

/** Isi Formulir 1 satu peserta: identitas dari data peserta; pangkat (gol) dari profil registrasi atau Data Pegawai (NIP). */
export async function getPakta(pesertaId: string): Promise<PaktaRecord> {
  const p: { trainingId: string; nama: string; nip: string | null; jabatan: string | null; instansi: string | null } | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { trainingId: true, nama: true, nip: true, jabatan: true, instansi: true },
  });
  if (!p) throw new NotFoundError("Peserta tidak ditemukan");
  const t = await diklat(p.trainingId);
  if (t.jenisPelatihan !== "PKA" && t.jenisPelatihan !== "PKP") throw new ValidationError("Pakta integritas Formulir 1 hanya untuk PKA/PKP");
  let pangkat = "";
  if (p.nip) {
    const prof: { golongan: string } | null = await prisma.profilPeserta.findUnique({ where: { nip: p.nip }, select: { golongan: true } });
    if (prof?.golongan) pangkat = prof.golongan;
    else {
      const pg: { pangkat: string | null; golRuang: string | null } | null = await prisma.pegawai.findFirst({ where: { nip: p.nip }, select: { pangkat: true, golRuang: true } });
      const pgl = pg ? pangkatGolongan(pg.pangkat, pg.golRuang) : "";
      pangkat = pgl === "-" ? "" : pgl;
    }
  }
  return {
    diklat: infoDiklat(t),
    tempat: KOTA_SURAT,
    isi: teksPaktaIntegritas(t.jenisPelatihan as ProgramFormulir, { nama: p.nama, nip: p.nip ?? "", pangkatGolongan: pangkat, jabatan: p.jabatan ?? "", instansi: p.instansi ?? "" }),
  };
}

/** Peserta pemilik akun (untuk cetak pakta oleh peserta sendiri). */
export async function pesertaMilikAkun(pesertaId: string, email: string): Promise<boolean> {
  const r: { akun: { email: string } | null } | null = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { akun: { select: { email: true } } } });
  return !!r?.akun && r.akun.email === email;
}

/** Jadwal milik peserta (untuk cek hak penyelenggara). */
export async function trainingPeserta(pesertaId: string): Promise<string> {
  const r: { trainingId: string } | null = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true } });
  if (!r) throw new NotFoundError("Peserta tidak ditemukan");
  return r.trainingId;
}
