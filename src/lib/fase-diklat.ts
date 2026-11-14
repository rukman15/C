/**
 * Timeline fase PKA/PKP untuk SEMUA yang terlibat (peserta, WI pengampu/coach/penguji, penyelenggara &
 * evaluator, pimpinan) — logika MURNI, diuji di uji/murni.test.ts. Tahap aktif memakai `tahapAktif`
 * (beranda-peserta.ts) supaya sama dengan bilah tahapan peserta; tanggal tiap tahap = PERKIRAAN dari sebaran
 * hari kurikulum yang dipetakan ke tanggal mulai–selesai jadwal.
 */
import { tambahHari } from "@/lib/sesi";

/** Keterlibatan seseorang pada satu diklat. */
export type PeranDiklat = "peserta" | "pengampu" | "coach" | "penguji" | "penyelenggara" | "pemantau";
export const LABEL_PERAN_DIKLAT: Record<PeranDiklat, string> = {
  peserta: "Peserta",
  pengampu: "Pengampu",
  coach: "Coach",
  penguji: "Penguji",
  penyelenggara: "Penyelenggara",
  pemantau: "Pemantau",
};
export const URUTAN_PERAN: PeranDiklat[] = ["peserta", "pengampu", "coach", "penguji", "penyelenggara", "pemantau"];

const HARI_MS = 86_400_000;
const keMs = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);

/**
 * Perkiraan rentang tanggal tiap tahap: hari kurikulum tiap tahap dipetakan proporsional ke jumlah hari kalender
 * jadwal (mulai–selesai). Tahap tanpa hari tetap dapat satu hari. Tanpa tanggal selesai → semua null.
 */
export function rentangTahap(tahap: { hari?: number }[], mulai: string, selesai: string | null | undefined): ({ mulai: string; selesai: string } | null)[] {
  if (!selesai || !tahap.length) return tahap.map(() => null);
  const totalKal = Math.max(Math.round((keMs(selesai) - keMs(mulai)) / HARI_MS) + 1, 1);
  const totalKur = tahap.reduce((s, t) => s + Math.max(t.hari ?? 0, 0), 0);
  if (totalKur <= 0) return tahap.map(() => null);
  // Batas tiap tahap pada skala kalender: floor(kumulatif × hari kalender ÷ hari kurikulum) — bilangan bulat supaya
  // tidak meleset karena pecahan desimal. Tahap berakhir sehari sebelum tahap berikutnya mulai (tanpa celah/tumpang).
  const batas: number[] = [0];
  let kum = 0;
  for (const t of tahap) {
    kum += Math.max(t.hari ?? 0, 0);
    batas.push(Math.floor((kum * totalKal) / totalKur));
  }
  return tahap.map((_, i) => {
    const awal = batas[i];
    const akhir = i === tahap.length - 1 ? totalKal - 1 : Math.max(batas[i + 1] - 1, awal);
    return { mulai: tambahHari(mulai, awal), selesai: tambahHari(mulai, akhir) };
  });
}

/** Sisa hari sampai tanggal (0 = hari ini); negatif bila sudah lewat. */
export const sisaHari = (tanggal: string, hariIni: string) => Math.round((keMs(tanggal) - keMs(hariIni)) / HARI_MS);

/** Urut diklat di timeline: berjalan dulu (mulai terbaru), lalu terjadwal (paling dekat), lalu selesai. */
export function urutkanFase<T extends { status: string; mulai: string }>(list: T[]): T[] {
  const kunci = (s: string) => (s === "Berjalan" ? 0 : s === "Terjadwal" ? 1 : 2);
  return [...list].sort((a, b) => kunci(a.status) - kunci(b.status) || (a.status === "Terjadwal" ? a.mulai.localeCompare(b.mulai) : b.mulai.localeCompare(a.mulai)));
}
