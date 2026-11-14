import "server-only";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import type { UserRole } from "@/lib/roles";

/**
 * Hak atas modul persuratan (CATATAN-SURAT-MENYURAT.md). Admin selalu lolos (requireRole).
 *  - Naskah dinas: disusun & dibaca PENYUSUN_NASKAH; konsep diubah/dihapus penyusunnya atau PENOMOR.
 *  - Agenda & nomor surat keluar: PENOMOR (TU). Penghitung nomor awal tahun: PENOMOR.
 *  - Surat masuk: dicatat PENCATAT_SURAT_MASUK; dibaca PEMBACA_SURAT_MASUK + pegawai yang menerima
 *    disposisinya. Disposisi diberikan PEMBERI_DISPOSISI atau penerima disposisi (diteruskan).
 *  - Cuti: setiap pegawai mengajukan cutinya sendiri; PENGELOLA_CUTI mengajukan atas nama pegawai &
 *    melihat semua; PEMUTUS_CUTI menyetujui/menolak.
 *  - SPD: PEMBUAT_SPD membuat/mengubah; PEMBACA_SPD membaca & mengunduh.
 */
export const PENYUSUN_NASKAH: UserRole[] = ["kabag-tu", "kepegawaian", "ketua-diklat", "kepala-balai"];
export const PENOMOR: UserRole[] = ["kabag-tu", "kepegawaian"];
export const PENCATAT_SURAT_MASUK: UserRole[] = ["kabag-tu", "kepegawaian"];
export const PEMBACA_SURAT_MASUK: UserRole[] = ["kepala-balai", "kabag-tu", "kepegawaian"];
export const PEMBERI_DISPOSISI: UserRole[] = ["kepala-balai", "kabag-tu"];
export const PENGELOLA_CUTI: UserRole[] = ["kabag-tu", "kepegawaian", "kepala-balai"];
export const PEMUTUS_CUTI: UserRole[] = ["kabag-tu", "kepala-balai"];
/** SPD: disusun Keuangan/TU/Kepegawaian (konsep untuk ditandatangani PPK); dibaca juga Kepala Balai. */
export const PEMBUAT_SPD: UserRole[] = ["keuangan", "kabag-tu", "kepegawaian"];
export const PEMBACA_SPD: UserRole[] = [...PEMBUAT_SPD, "kepala-balai"];

export type Pengguna = { role: UserRole; email: string; pegawaiId: string | null };

/** Peran pengguna termasuk daftar (admin selalu termasuk). */
export const termasuk = (p: { role: UserRole }, daftar: UserRole[]) => p.role === "admin" || daftar.includes(p.role);

/** Pengguna login (peran apa pun bila `daftar` kosong). */
export async function pengguna(daftar: UserRole[] = []): Promise<Pengguna> {
  const { role } = await requireRole(daftar);
  const s = (await getActiveSession());
  if (!s) throw new UnauthorizedError();
  return { role, email: s.email, pegawaiId: s.pegawaiId ?? null };
}

/** Pengguna yang akunnya tertaut ke data pegawai (cuti, disposisi). */
export async function penggunaPegawai(): Promise<Pengguna & { pegawaiId: string }> {
  const p = await pengguna();
  if (!p.pegawaiId) throw new ForbiddenError("Akun ini belum tertaut ke data pegawai.");
  return { ...p, pegawaiId: p.pegawaiId };
}
