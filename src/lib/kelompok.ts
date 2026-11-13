/**
 * Kelompok kecil peserta PKA/PKP (KepKa LAN 2/K.1/PDP.07/2023 BAB III, gambaran umum
 * jadwal tiap program): e-learning blended/distance learning dilaksanakan "di dalam
 * 4 (empat) kelompok kecil", dan pembimbingan aksi perubahan "dibagi ke dalam 4 (empat)
 * kelompok, yang masing-masing kelompok dibimbing oleh 1 (satu) Coach".
 * Logika murni — diuji di uji/murni.test.ts.
 */
import { getJenjang } from "@/lib/kurikulum";

/** Jumlah kelompok menurut pedoman untuk PKA & PKP (semua mode). */
export const JUMLAH_KELOMPOK_PEDOMAN = 4;
export const JUMLAH_KELOMPOK_MAKS = 12;
export const NAMA_KELOMPOK_MAKS = 60;

/**
 * Jenis kelompok (keputusan 14 Okt 2026, CATATAN-KEPUTUSAN-14OKT.md B.10): satu peserta boleh
 * berada di kelompok berbeda untuk tiap jenis kegiatan. `pedoman` = jumlah kelompok menurut
 * Pedoman (hanya e-learning/pembimbingan coach yang ditetapkan: 4); null = bebas.
 * Kelompok lama (sebelum ada jenis) dianggap ELEARNING.
 */
export type JenisKelompok = "ELEARNING" | "STULA" | "MANDIRI" | "SEMINAR";
export const JENIS_KELOMPOK: { kode: JenisKelompok; label: string; pedoman: number | null }[] = [
  { kode: "ELEARNING", label: "E-learning & pembimbingan coach", pedoman: JUMLAH_KELOMPOK_PEDOMAN },
  { kode: "STULA", label: "Studi lapangan", pedoman: null },
  { kode: "MANDIRI", label: "Belajar mandiri", pedoman: null },
  { kode: "SEMINAR", label: "Seminar aksi perubahan", pedoman: null },
];
export const JENIS_KELOMPOK_BAWAAN: JenisKelompok = "ELEARNING";
export const isJenisKelompok = (v: unknown): v is JenisKelompok => JENIS_KELOMPOK.some((j) => j.kode === v);
export const labelJenisKelompok = (kode: string) => JENIS_KELOMPOK.find((j) => j.kode === kode)?.label ?? kode;

/** Kelompok hanya untuk program kurikulum LAN (PKA/PKP). */
export const pakaiKelompok = (jenisPelatihan: string | null | undefined) => !!getJenjang(jenisPelatihan);

export const labelKelompok = (k: { nomor: number; nama?: string | null }) => (k.nama?.trim() ? `Kelompok ${k.nomor} — ${k.nama.trim()}` : `Kelompok ${k.nomor}`);

/**
 * Bagi peserta ke `jumlah` kelompok, merata (selisih anggota paling banyak 1) dan
 * menyebar instansi: urut instansi lalu nomor, kemudian dibagikan bergiliran —
 * peserta seinstansi jatuh ke kelompok berbeda. Hasil: id peserta → nomor kelompok (1..jumlah).
 */
export function bagiKelompok(peserta: { id: string; nomor: number; instansi?: string | null }[], jumlah: number): Map<string, number> {
  const n = Math.max(1, Math.floor(jumlah));
  const urut = [...peserta].sort(
    (a, b) => (a.instansi ?? "").trim().toLowerCase().localeCompare((b.instansi ?? "").trim().toLowerCase()) || a.nomor - b.nomor,
  );
  return new Map(urut.map((p, i) => [p.id, (i % n) + 1]));
}

/** Peringatan susunan kelompok (tidak memblokir). `anggota` = jumlah peserta aktif per kelompok. */
export function periksaKelompok(anggota: number[], tanpaKelompok: number, pedoman: number | null = JUMLAH_KELOMPOK_PEDOMAN): string[] {
  const out: string[] = [];
  if (!anggota.length) return tanpaKelompok ? ["Kelompok belum dibentuk."] : [];
  if (pedoman !== null && anggota.length !== pedoman)
    out.push(`Pedoman menetapkan ${pedoman} kelompok kecil (e-learning & pembimbingan coach); saat ini ${anggota.length}.`);
  if (tanpaKelompok) out.push(`${tanpaKelompok} peserta aktif belum masuk kelompok.`);
  const kosong = anggota.filter((x) => x === 0).length;
  if (kosong) out.push(`${kosong} kelompok belum punya anggota.`);
  const isi = anggota.filter((x) => x > 0);
  if (isi.length > 1 && Math.max(...isi) - Math.min(...isi) > 1) out.push(`Jumlah anggota tidak merata (${Math.min(...isi)}–${Math.max(...isi)} orang).`);
  return out;
}
