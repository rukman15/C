/**
 * Satu aturan untuk "kapasitas JP Widyaiswara sudah diisi atau belum", dipakai
 * server dan client.
 *
 * Sebelumnya tiap tempat punya tafsir sendiri untuk angka 0: grafik beban JP
 * menganggap 0 = "belum diisi", sedangkan pengajuan penugasan dan Ringkasan
 * Lembaga menganggap 0 = batas nol (sehingga WI itu langsung dihitung
 * "melebihi kapasitas"). Sekarang seragam: kapasitas dianggap ADA hanya kalau
 * angkanya lebih dari 0. Kosong (null/undefined) atau 0 = belum diisi, dan WI
 * tersebut tidak ikut hitungan melebihi kapasitas.
 */
export function adaBatasJp(jpMaksimal: number | null | undefined): jpMaksimal is number {
  return typeof jpMaksimal === "number" && jpMaksimal > 0;
}

/** true kalau `jpTerpakai` (+ `jpTambahan`) melewati kapasitas yang sudah diisi. */
export function melebihiKapasitas(
  jpTerpakai: number,
  jpMaksimal: number | null | undefined,
  jpTambahan = 0,
): boolean {
  return adaBatasJp(jpMaksimal) && jpTerpakai + jpTambahan > jpMaksimal;
}

// ------------------------------------------------------------------ batas JP WI per bulan

/**
 * Batas JP Widyaiswara berlaku PER BULAN dan diisi manual oleh admin (halaman Aturan JP):
 *   1. batas khusus WI (`pegawai.jpMaksimal`) bila terisi (> 0);
 *   2. selain itu batas jenjangnya (Pertama/Muda/Madya/Utama) di `pengaturan_jp`;
 *   3. keduanya kosong = belum diatur (tanpa batas, tidak pernah "melebihi").
 * JP yang dibandingkan = penugasan DISETUJUI pada diklat yang MULAI di bulan yang sama.
 */
export type SumberBatas = "wi" | "jenjang";

export type BatasJenjang = { pertama: number | null; muda: number | null; madya: number | null; utama: number | null };

export const BATAS_JENJANG_KOSONG: BatasJenjang = { pertama: null, muda: null, madya: null, utama: null };

export function batasEfektif(
  batasSendiri: number | null | undefined,
  jenjang: keyof BatasJenjang | null | undefined,
  batasJenjang: BatasJenjang,
): { batas: number | null; sumber: SumberBatas | null } {
  if (adaBatasJp(batasSendiri)) return { batas: batasSendiri, sumber: "wi" };
  const b = jenjang ? batasJenjang[jenjang] : null;
  if (adaBatasJp(b)) return { batas: b, sumber: "jenjang" };
  return { batas: null, sumber: null };
}

/** "YYYY-MM" dari tanggal diklat (disimpan tengah malam UTC, lihat $lib/tanggal.ts). */
export function bulanDari(tanggal: Date | string): string {
  return (typeof tanggal === "string" ? tanggal : tanggal.toISOString()).slice(0, 7);
}

/**
 * Apakah satu jadwal diklat masih bisa diajukan WI baru (LMS tahap 1 — satu
 * pelatihan boleh diampu banyak WI). Dipakai server (daftar "Tugaskan WI") dan
 * halaman rincian diklat, supaya keduanya tidak bisa berbeda.
 *   - program berkurikulum (PKP/PKA): selalu, tiap mata pelatihan punya pengampu sendiri;
 *   - diklat lain dengan "JP dibutuhkan" terisi: selama JP yang sudah DISETUJUI belum mencapainya;
 *   - diklat lain tanpa "JP dibutuhkan": selama belum ada WI disetujui (tidak ada angka pembanding).
 * Pengajuan yang masih menunggu belum dihitung.
 */
export function masihButuhWi(
  t: { jenisPelatihan?: string | null; jpDibutuhkan?: number | null },
  wiDisetujui: number,
  jpDisetujui: number,
): boolean {
  if (t.jenisPelatihan) return true;
  const butuh = t.jpDibutuhkan ?? 0;
  if (butuh > 0) return jpDisetujui < butuh;
  return wiDisetujui === 0;
}
