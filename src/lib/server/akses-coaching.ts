import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { getActiveSession } from "@/lib/server/auth";
import { aksesDiklat, pembacaSemua, type AksesDiklat } from "@/lib/server/akses";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { labelKelompok, pakaiKelompok } from "@/lib/kelompok";
import type { PeranCoaching } from "@/lib/coaching";
import type { UserRole } from "@/lib/roles";

/**
 * Hak atas Ruang Coaching (src/lib/coaching.ts). Peran dihitung tiap permintaan, urutan:
 *  1. coach         — `kelompok_peserta.coachPegawaiId` = pegawai akun ini
 *  2. penyelenggara — boleh mengelola jadwal diklatnya (admin, Ketua Diklat, anggota tim pemegang)
 *  3. peserta       — peserta AKTIF jadwal itu (akun tertaut) yang menjadi anggota kelompok ini
 *  4. pembaca       — Kepala Balai, Kabag TU, Koordinator WI (lihat saja)
 * Selain itu: 404 (tidak membocorkan bahwa ruang itu ada).
 */
export const PEMBACA_COACHING: UserRole[] = ["kepala-balai", "kabag-tu"];

export type KelompokRuang = {
  id: string;
  trainingId: string;
  nomor: number;
  label: string;
  coachNama: string | null;
  coachPegawaiId: string | null;
  tautan: string | null;
};
export type TrainingRuang = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  timKerjaId: string | null;
};
export type AksesRuang = {
  peran: PeranCoaching;
  akunId: string;
  email: string;
  nama: string;
  pegawaiId: string | null;
  /** Diisi bila peran = peserta. */
  pesertaId: string | null;
  kelompok: KelompokRuang;
  training: TrainingRuang;
};

export type IdentitasAkun = { akses: AksesDiklat; akunId: string; nama: string };

export async function identitasAkun(): Promise<IdentitasAkun> {
  const akses = await aksesDiklat();
  const akun: { id: string; name: string } | null = await prisma.akun.findUnique({ where: { email: akses.email }, select: { id: true, name: true } });
  if (!akun) throw new NotFoundError("Akun tidak ditemukan");
  // Nama dari sesi bila ada (sama dengan yang tampil di kepala halaman), selain itu dari akun.
  return { akses, akunId: akun.id, nama: (await getActiveSession())?.name ?? akun.name };
}

/** Peserta AKTIF milik akun ini pada satu jadwal yang menjadi anggota kelompok itu. */
async function pesertaAnggota(akunId: string, trainingId: string, kelompokId: string): Promise<string | null> {
  const milik: { id: string }[] = await prisma.peserta.findMany({ where: { akunId, trainingId, status: "AKTIF" }, select: { id: true } });
  if (!milik.length) return null;
  const a: { pesertaId: string } | null = await prisma.anggotaKelompok.findFirst({
    where: { kelompokId, pesertaId: { in: milik.map((m) => m.id) } },
    select: { pesertaId: true },
  });
  return a?.pesertaId ?? null;
}

export function peranDari(
  i: IdentitasAkun,
  k: { coachPegawaiId: string | null },
  t: { timKerjaId: string | null },
  pesertaId: string | null,
): PeranCoaching | null {
  if (i.akses.pegawaiId && k.coachPegawaiId === i.akses.pegawaiId) return "coach";
  if (bolehKelolaDiklat(i.akses, t.timKerjaId)) return "penyelenggara";
  if (pesertaId) return "peserta";
  if (pembacaSemua(i.akses, PEMBACA_COACHING)) return "pembaca";
  return null;
}

const TIDAK_ADA = "Ruang coaching tidak ditemukan";

export async function aksesRuangCoaching(kelompokId: string): Promise<AksesRuang> {
  const i = await identitasAkun();
  const k: {
    id: string;
    trainingId: string;
    jenis: string;
    nomor: number;
    nama: string | null;
    coachNama: string | null;
    coachPegawaiId: string | null;
    tautan: string | null;
  } | null = await prisma.kelompokPeserta.findUnique({ where: { id: kelompokId } });
  if (!k || k.jenis !== "ELEARNING") throw new NotFoundError(TIDAK_ADA);
  const t: (TrainingRuang & { jenisPelatihan: string | null }) | null = await prisma.training.findUnique({
    where: { id: k.trainingId },
    select: { id: true, name: true, status: true, startDate: true, endDate: true, timKerjaId: true, jenisPelatihan: true },
  });
  if (!t || !pakaiKelompok(t.jenisPelatihan)) throw new NotFoundError(TIDAK_ADA);
  const pesertaId = await pesertaAnggota(i.akunId, t.id, k.id);
  const peran = peranDari(i, k, t, pesertaId);
  if (!peran) throw new NotFoundError(TIDAK_ADA);
  return {
    peran,
    akunId: i.akunId,
    email: i.akses.email,
    nama: i.nama,
    pegawaiId: i.akses.pegawaiId,
    pesertaId: peran === "peserta" ? pesertaId : null,
    kelompok: { id: k.id, trainingId: k.trainingId, nomor: k.nomor, label: labelKelompok(k), coachNama: k.coachNama, coachPegawaiId: k.coachPegawaiId, tautan: k.tautan },
    training: { id: t.id, name: t.name, status: t.status, startDate: t.startDate, endDate: t.endDate, timKerjaId: t.timKerjaId },
  };
}

/** Pemilik pustaka video: Widyaiswara atau pengelola diklat (admin/Ketua Diklat) yang tertaut ke data pegawai. */
export async function pemilikPustaka(): Promise<{ pegawaiId: string; email: string; role: UserRole }> {
  const a = await aksesDiklat();
  if (a.role !== "widyaiswara" && !a.global) throw new ForbiddenError("Pustaka video untuk Widyaiswara dan Ketua Diklat.");
  if (!a.pegawaiId) throw new ValidationError("Akun ini belum tertaut ke data pegawai, jadi belum punya pustaka video.");
  return { pegawaiId: a.pegawaiId, email: a.email, role: a.role };
}
