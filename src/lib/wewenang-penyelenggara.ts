/**
 * Wewenang Admin Penyelenggara (EB-034, keputusan Hamzah 5 Nov 2026): Super Admin (akun `admin`)
 * menunjuk pegawai mana pun dan memilih wewenangnya. Logika MURNI, diuji di uji/murni.test.ts.
 *
 * Wewenang berlaku untuk SEMUA diklat. Untuk "kelola diklat" (bertindak seperti Ketua Diklat untuk
 * diklat tertentu) tetap memakai Tim Kerja berwenang "tugaskan-wi" (src/lib/tim-kerja.ts).
 */
export const WEWENANG_ATUR_PENUGASAN = "atur-penugasan";
export const WEWENANG_LIHAT_NILAI = "lihat-nilai";
export const WEWENANG_UBAH_NILAI = "ubah-nilai";

export const WEWENANG_PENYELENGGARA: { kode: string; label: string; keterangan: string }[] = [
  {
    kode: WEWENANG_ATUR_PENUGASAN,
    label: "Atur penugasan angkatan",
    keterangan: "Menugaskan coach, mentor, penguji, dan pendamping studi lapangan pada diklat PKA/PKP, serta menyetujui usulan mentor dari peserta.",
  },
  {
    kode: WEWENANG_LIHAT_NILAI,
    label: "Lihat nilai",
    keterangan: "Membuka lembar penilaian dan rekap kelulusan semua peserta, tanpa mengubah.",
  },
  {
    kode: WEWENANG_UBAH_NILAI,
    label: "Ubah nilai",
    keterangan: "Mengisi dan mengubah nilai seperti Ketua Diklat (termasuk melihat nilai).",
  },
];

const KODE = new Set(WEWENANG_PENYELENGGARA.map((w) => w.kode));

export function isKodeWewenang(v: unknown): v is string {
  return typeof v === "string" && KODE.has(v);
}

/** Punya wewenang ini? "ubah-nilai" sudah termasuk "lihat-nilai". */
export function punyaWewenang(daftar: readonly string[] | null | undefined, kode: string): boolean {
  if (!daftar) return false;
  if (daftar.includes(kode)) return true;
  return kode === WEWENANG_LIHAT_NILAI && daftar.includes(WEWENANG_UBAH_NILAI);
}

/** Rapikan isian wewenang: buang duplikat, urut seperti daftar. Hasil: daftar rapi atau pesan galat. */
export function rapikanWewenang(isian: unknown): { ok: true; wewenang: string[] } | { ok: false; pesan: string } {
  if (!Array.isArray(isian) || isian.length === 0) return { ok: false, pesan: "Pilih minimal satu wewenang." };
  const asing = isian.filter((k) => !isKodeWewenang(k));
  if (asing.length) return { ok: false, pesan: `Wewenang tidak dikenal: ${asing.map(String).join(", ")}` };
  return { ok: true, wewenang: WEWENANG_PENYELENGGARA.map((w) => w.kode).filter((k) => isian.includes(k)) };
}

export function labelWewenang(kode: string): string {
  return WEWENANG_PENYELENGGARA.find((w) => w.kode === kode)?.label ?? kode;
}
