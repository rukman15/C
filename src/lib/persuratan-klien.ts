/** Bentuk data yang dipakai halaman persuratan di peramban (sama dengan aplikasi lama). */
import type { HakPersuratan } from "@/lib/server/hak-persuratan";

export type { HakPersuratan };

export type PilihanKlien = {
  hak: HakPersuratan;
  pegawaiId: string | null;
  pegawai: { id: string; nama: string; nip: string; jabatan: string }[];
  diklat: { id: string; name: string; startDate: string }[];
};

/** Teks banyak baris -> daftar (baris kosong dibuang). */
export const keDaftar = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
