import "server-only";
import { ForbiddenError } from "@/lib/server/errors";
import { aksesDiklat, pembacaSemua, wajibKelolaTraining, type AksesDiklat } from "@/lib/server/akses";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError } from "@/lib/server/errors";
import type { UserRole } from "@/lib/roles";

/**
 * Hak atas dokumen penugasan WI (tahap C).
 *  - Surat tugas: dibaca pengelola diklat (Ketua Diklat/admin, anggota tim pemegang) dan
 *    Kepala Balai / Kabag TU; dibuat, diubah, dihapus pengelola diklat.
 *  - Rekap JP tatap muka bulanan: PEMBACA_REKAP_JP dan Koordinator WI.
 *    KARKEN dibuat manual oleh WI di luar aplikasi (keputusan 23 Okt 2026).
 */
export const PEMBACA_SURAT: UserRole[] = ["kepala-balai", "kabag-tu"];
export const PEMBACA_REKAP_JP: UserRole[] = ["admin", "ketua-diklat", "kepala-balai", "kabag-tu", "kepegawaian"];

export async function wajibBacaSurat(trainingId: string): Promise<AksesDiklat> {
  const a = await aksesDiklat();
  if (!pembacaSemua(a, PEMBACA_SURAT)) await wajibKelolaTraining(a, trainingId);
  return a;
}

/** Boleh membaca SATU surat tugas: pembaca surat, pengelola diklatnya, atau penerima surat itu sendiri. */
export function bolehBacaSurat(a: AksesDiklat, surat: { pegawaiIds: string[]; timKerjaId: string | null }): boolean {
  return (
    pembacaSemua(a, PEMBACA_SURAT) ||
    bolehKelolaDiklat(a, surat.timKerjaId) ||
    (!!a.pegawaiId && surat.pegawaiIds.includes(a.pegawaiId))
  );
}

export async function wajibBacaSuratId(suratId: string): Promise<AksesDiklat> {
  const a = await aksesDiklat();
  const s: { pegawaiIds: string[]; training: { timKerjaId: string | null } } | null = await prisma.suratTugas.findUnique({
    where: { id: suratId },
    select: { pegawaiIds: true, training: { select: { timKerjaId: true } } },
  });
  if (!s) throw new NotFoundError("Surat tugas tidak ditemukan");
  if (!bolehBacaSurat(a, { pegawaiIds: s.pegawaiIds, timKerjaId: s.training.timKerjaId })) throw new ForbiddenError();
  return a;
}

export async function wajibKelolaSurat(trainingId: string): Promise<AksesDiklat> {
  const a = await aksesDiklat();
  await wajibKelolaTraining(a, trainingId);
  return a;
}
