/**
 * Wewenang tim kerja yang dikenali aplikasi (logika MURNI, diuji di uji/murni.test.ts).
 * `TimKerja.wewenang` tetap daftar kode bebas; kode di sini yang benar-benar dipakai.
 */
export const WEWENANG_TUGASKAN_WI = "tugaskan-wi";

export const WEWENANG_DIKENAL: { kode: string; label: string; keterangan: string }[] = [
  {
    kode: WEWENANG_TUGASKAN_WI,
    label: "Kelola diklat & ajukan WI",
    keterangan:
      "Semua anggota tim (ketua & anggota) boleh menambah dan mengubah jadwal diklat milik tim, serta mengajukan dan membatalkan pengajuan WI-nya.",
  },
];

export type TimDiklat = { id: string; nama: string };

/** Peran yang mengelola SEMUA jadwal diklat tanpa melihat tim. */
export const PERAN_DIKLAT_GLOBAL = ["admin", "ketua-diklat"] as const;

export function kelolaGlobal(role: string | null | undefined): boolean {
  return !!role && (PERAN_DIKLAT_GLOBAL as readonly string[]).includes(role);
}

/** Boleh mengelola (ubah jadwal, ajukan/batalkan WI) diklat milik tim ini? */
export function bolehKelolaDiklat(
  akses: { role: string | null | undefined; timIds: string[] },
  timKerjaId: string | null | undefined,
): boolean {
  return kelolaGlobal(akses.role) || (!!timKerjaId && akses.timIds.includes(timKerjaId));
}

/**
 * Tim tujuan saat menambah/mengubah jadwal. `undefined` = tidak diubah (hanya saat mengubah).
 * Pengelola global boleh tim mana pun atau tanpa tim; anggota tim hanya ke timnya sendiri dan
 * tidak boleh mengosongkannya (jadwal akan lepas dari jangkauannya).
 * Hasil: null = boleh, string = pesan penolakan.
 */
export function periksaTimTujuan(
  akses: { role: string | null | undefined; timIds: string[] },
  timKerjaId: string | null | undefined,
): string | null {
  if (kelolaGlobal(akses.role)) return null;
  if (timKerjaId === undefined) return null;
  if (timKerjaId === null || timKerjaId === "") return "Pilih tim kerja pemegang diklat ini.";
  if (!akses.timIds.includes(timKerjaId)) return "Anda hanya bisa memilih tim kerja Anda sendiri.";
  return null;
}
