/**
 * Helper MURNI (tanpa import) untuk tanggal jadwal diklat — dipakai server
 * maupun client, jadi aturannya cuma satu tempat (pola sama dengan sesi.ts).
 *
 * Konvensi data: `Training.startDate`/`endDate` diisi dari <input type="date">
 * lewat `new Date("YYYY-MM-DD")`, jadi tersimpan sebagai TENGAH MALAM UTC dari
 * tanggal kalender itu. Karena itu "tanggal pelatihan" selalu dibaca dari bagian
 * UTC-nya, sedangkan "hari ini" diambil dari kalender WIB (UTC+7, Indonesia
 * tidak memakai DST) — supaya pukul 00.00–06.59 WIB tidak dianggap masih kemarin.
 */

export const HARI_MS = 86_400_000;
const WIB_MS = 7 * 60 * 60 * 1000;

export type StatusDiklat = "Terjadwal" | "Berjalan" | "Selesai";

/** Tengah malam UTC dari tanggal kalender (bagian UTC) sebuah Date. */
export function awalHariUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * "Hari ini" menurut kalender WIB, dinyatakan sebagai tengah malam UTC dari
 * tanggal itu — sehingga bisa langsung dibandingkan dengan tanggal pelatihan.
 * Contoh: 9 Okt 2026 pukul 05.00 WIB (= 8 Okt 22.00 UTC) -> 2026-10-09T00:00Z.
 */
export function awalHariWib(now: Date = new Date()): Date {
  return awalHariUtc(new Date(now.getTime() + WIB_MS));
}

/** "YYYY-MM-DD" dari bagian UTC sebuah Date. */
export function isoTanggal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Status pelatihan menurut tanggalnya:
 *   belum sampai tanggal mulai            -> "Terjadwal"
 *   tanggal mulai s.d. tanggal selesai    -> "Berjalan"
 *   sudah lewat tanggal selesai           -> "Selesai"
 * Tanpa tanggal selesai, pelatihan dianggap satu hari. Tanggal selesai yang
 * (keliru) lebih awal dari tanggal mulai diperlakukan sama dengan tanggal mulai.
 */
export function statusDariTanggal(
  startDate: Date,
  endDate: Date | null | undefined,
  now: Date = new Date(),
): StatusDiklat {
  const hariIni = awalHariWib(now).getTime();
  const mulai = awalHariUtc(startDate).getTime();
  const selesai = Math.max(mulai, awalHariUtc(endDate ?? startDate).getTime());
  if (hariIni < mulai) return "Terjadwal";
  if (hariIni > selesai) return "Selesai";
  return "Berjalan";
}

/** Valid kalau berformat "YYYY-MM-DD" dan tanggalnya memang ada di kalender. */
export function isTanggalIso(teks: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Menerima tanggal dari form/API: "YYYY-MM-DD" atau ISO lengkap yang bagian
 * tanggalnya valid ("2026-10-09T00:00:00.000Z"). Mengembalikan "YYYY-MM-DD"
 * atau null kalau tidak bisa dibaca sebagai tanggal.
 */
export function bacaTanggalIso(teks: string): string | null {
  const t = teks.trim();
  if (isTanggalIso(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t) && isTanggalIso(t.slice(0, 10)) && !Number.isNaN(Date.parse(t))) {
    return t.slice(0, 10);
  }
  return null;
}

/** "YYYY-MM-DD" ditambah `n` hari kalender (boleh negatif). */
export function tambahHariIso(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return isoTanggal(new Date(Date.UTC(y, m - 1, d) + n * HARI_MS));
}

/** Selisih hari kalender `b - a` untuk dua tanggal "YYYY-MM-DD". */
export function selisihHariIso(a: string, b: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / HARI_MS);
}

/** true kalau tanggal "YYYY-MM-DD" jatuh pada Sabtu atau Minggu. */
export function akhirPekanIso(iso: string): boolean {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return hari === 0 || hari === 6;
}
