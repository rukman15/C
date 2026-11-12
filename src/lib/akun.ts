/**
 * Aturan akun yang dipakai server DAN halaman. Sengaja di luar `@/lib/server`,
 * karena modul di `@/lib/server/*` tidak boleh diimpor kode sisi browser.
 */

/** Panjang minimal kata sandi baru. */
export const PANJANG_SANDI_MIN = 8;

/** Halaman ganti kata sandi (tujuan pengalihan kalau kata sandi masih bawaan). */
export const HALAMAN_AKUN = "/dashboard/akun";
