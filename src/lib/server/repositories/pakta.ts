import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { KOTA_SURAT } from "@/lib/aplikasi";
import { namaProgram } from "@/lib/kurikulum";
import { pangkatGolongan } from "@/lib/dokumen";
import { isoTanggal } from "@/lib/tanggal";
import { teksPaktaIntegritas, type ProgramFormulir } from "@/lib/formulir-penyelenggaraan";

/**
 * Formulir 1 (Pakta Integritas) satu peserta, disalin dari repositories/formulir-penyelenggaraan.ts aplikasi lama:
 * identitas dari data peserta; pangkat (gol) dari profil registrasi atau Data Pegawai (NIP).
 */
export type PaktaRecord = {
  diklat: { id: string; nama: string; program: string; mulai: string; selesai: string | null };
  tempat: string;
  isi: ReturnType<typeof teksPaktaIntegritas>;
};

export async function getPakta(pesertaId: string): Promise<PaktaRecord> {
  const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true, nama: true, nip: true, jabatan: true, instansi: true } });
  if (!p) throw new NotFoundError("Peserta tidak ditemukan");
  const t = await prisma.training.findUnique({ where: { id: p.trainingId }, select: { id: true, name: true, jenisPelatihan: true, angkatan: true, startDate: true, endDate: true } });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  if (t.jenisPelatihan !== "PKA" && t.jenisPelatihan !== "PKP") throw new ValidationError("Pakta integritas Formulir 1 hanya untuk PKA/PKP");
  let pangkat = "";
  if (p.nip) {
    const prof = await prisma.profilPeserta.findUnique({ where: { nip: p.nip }, select: { golongan: true } });
    if (prof?.golongan) pangkat = prof.golongan;
    else {
      const pg = await prisma.pegawai.findFirst({ where: { nip: p.nip }, select: { pangkat: true, golRuang: true } });
      const pgl = pg ? pangkatGolongan(pg.pangkat, pg.golRuang) : "";
      pangkat = pgl === "-" ? "" : pgl;
    }
  }
  return {
    diklat: { id: t.id, nama: t.name, program: namaProgram(t.jenisPelatihan, t.angkatan) || t.name, mulai: isoTanggal(t.startDate), selesai: t.endDate ? isoTanggal(t.endDate) : null },
    tempat: KOTA_SURAT,
    isi: teksPaktaIntegritas(t.jenisPelatihan as ProgramFormulir, { nama: p.nama, nip: p.nip ?? "", pangkatGolongan: pangkat, jabatan: p.jabatan ?? "", instansi: p.instansi ?? "" }),
  };
}

/** Peserta pemilik akun (untuk cetak pakta oleh peserta sendiri). */
export async function pesertaMilikAkun(pesertaId: string, email: string): Promise<boolean> {
  const r = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { akun: { select: { email: true } } } });
  return !!r?.akun && r.akun.email === email;
}

export async function trainingPeserta(pesertaId: string): Promise<string> {
  const r = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true } });
  if (!r) throw new NotFoundError("Peserta tidak ditemukan");
  return r.trainingId;
}
