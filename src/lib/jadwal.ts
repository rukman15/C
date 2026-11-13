/**
 * Bentuk data halaman Jadwal Diklat dan hitungan tampilannya (murni, tanpa import server).
 * Data sama dengan /api/jadwal aplikasi lama (JadwalRecord).
 */
import { selisihHariIso, tambahHariIso } from "@/lib/tanggal";

export type StatusDiklat = "Berjalan" | "Terjadwal" | "Selesai";

export type JadwalDiklat = {
  id: string;
  name: string;
  category: string;
  participants: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  tempat: string;
  status: StatusDiklat;
};

export type SesiMengajar = { id: string; tanggal: string; kegiatan: string; jp: number; tempat: string };

export type JadwalMengajar = {
  id: string;
  trainingId: string;
  trainingName: string;
  startDate: string;
  endDate?: string;
  tempat: string;
  jp: number;
  status: "menunggu" | "disetujui";
  mataPelatihanNama?: string;
  adaPenilaian: boolean;
  jpSesi: number;
  sesi: SesiMengajar[];
};

export type DataJadwal = {
  diklat: JadwalDiklat[];
  /** null bila akun tidak tertaut pegawai. */
  mengajar: JadwalMengajar[] | null;
};

/** Tanggal terakhir diklat (tanpa tanggal selesai = satu hari). */
export function akhirDiklat(d: { startDate: string; endDate?: string }): string {
  return d.endDate && d.endDate >= d.startDate ? d.endDate : d.startDate;
}

export function lamaHari(d: { startDate: string; endDate?: string }): number {
  return selisihHariIso(d.startDate, akhirDiklat(d)) + 1;
}

/**
 * Keterangan waktu relatif terhadap `hariIni`: "Hari ke-3 dari 10", "Mulai besok",
 * "Mulai 5 hari lagi", "Selesai 2 hari lalu". `persen` = kemajuan 0..100 (hanya untuk yang berjalan).
 */
export function kemajuan(d: { startDate: string; endDate?: string }, hariIni: string): { label: string; persen: number | null } {
  const akhir = akhirDiklat(d);
  const total = lamaHari(d);
  if (hariIni < d.startDate) {
    const n = selisihHariIso(hariIni, d.startDate);
    return { label: n === 1 ? "Mulai besok" : `Mulai ${n} hari lagi`, persen: null };
  }
  if (hariIni > akhir) {
    const n = selisihHariIso(akhir, hariIni);
    return { label: n === 1 ? "Selesai kemarin" : `Selesai ${n} hari lalu`, persen: null };
  }
  const ke = selisihHariIso(d.startDate, hariIni) + 1;
  return { label: total === 1 ? "Hari ini" : `Hari ke-${ke} dari ${total}`, persen: Math.round((ke / total) * 100) };
}

/** Diklat yang berlangsung pada tanggal `iso`. */
export function diklatPadaTanggal<T extends { startDate: string; endDate?: string }>(daftar: T[], iso: string): T[] {
  return daftar.filter((d) => d.startDate <= iso && iso <= akhirDiklat(d));
}

/** "2026-11" -> 42 tanggal (6 minggu, Senin pertama) yang menutup bulan itu. */
export function gridBulan(tahun: number, bulan1: number): string[] {
  const pertama = `${tahun}-${String(bulan1).padStart(2, "0")}-01`;
  // getUTCDay: 0 Minggu .. 6 Sabtu -> geser supaya Senin = 0.
  const hari = new Date(`${pertama}T00:00:00Z`).getUTCDay();
  const mulai = tambahHariIso(pertama, -((hari + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => tambahHariIso(mulai, i));
}

/**
 * Susun diklat satu minggu (7 tanggal) ke jalur, supaya satu diklat tetap di baris yang sama
 * sepanjang minggu. Hasil: per hari, larik jalur berisi diklat atau null (jalur kosong).
 */
export function jalurMinggu<T extends { id: string; startDate: string; endDate?: string }>(daftar: T[], minggu: string[]): (T | null)[][] {
  const awal = minggu[0]!;
  const akhir = minggu[minggu.length - 1]!;
  const kena = daftar
    .filter((d) => d.startDate <= akhir && akhirDiklat(d) >= awal)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || lamaHari(b) - lamaHari(a) || a.id.localeCompare(b.id));
  const jalur: T[][] = [];
  for (const d of kena) {
    const bebas = jalur.find((isi) => isi.every((x) => akhirDiklat(x) < d.startDate || akhirDiklat(d) < x.startDate));
    if (bebas) bebas.push(d);
    else jalur.push([d]);
  }
  return minggu.map((iso) => jalur.map((isi) => isi.find((d) => d.startDate <= iso && iso <= akhirDiklat(d)) ?? null));
}

export function geserBulan(tahun: number, bulan1: number, n: number): { tahun: number; bulan: number } {
  const total = tahun * 12 + (bulan1 - 1) + n;
  return { tahun: Math.floor(total / 12), bulan: (total % 12) + 1 };
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const bagian = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });

/** "3 Nov 2026", "3–7 Nov 2026", "28 Okt – 2 Nov 2026", "29 Des 2026 – 2 Jan 2027". */
export function periodeTeks(mulai: string, selesai?: string): string {
  const a = bagian(mulai);
  if (!selesai || selesai <= mulai) return `${a.d} ${BULAN_PENDEK[a.m - 1]} ${a.y}`;
  const b = bagian(selesai);
  if (a.y !== b.y) return `${a.d} ${BULAN_PENDEK[a.m - 1]} ${a.y} – ${b.d} ${BULAN_PENDEK[b.m - 1]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${BULAN_PENDEK[a.m - 1]} – ${b.d} ${BULAN_PENDEK[b.m - 1]} ${b.y}`;
  return `${a.d}–${b.d} ${BULAN_PENDEK[a.m - 1]} ${a.y}`;
}

/** Tanggal dan bulan pendek untuk blok tanggal kartu: { tgl: "3", bln: "Nov" }. */
export function blokTanggal(iso: string): { tgl: string; bln: string } {
  const a = bagian(iso);
  return { tgl: String(a.d), bln: BULAN_PENDEK[a.m - 1] ?? "" };
}

/** "YYYY-MM-DD" <-> Date tengah malam waktu setempat (untuk pemilih tanggal). */
export function dariIso(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function keIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Pencarian sederhana: setiap kata harus muncul di nama, tempat, atau kategori. */
export function cocokCari(d: { name: string; tempat: string }, kategoriLabel: string, cari: string): boolean {
  const teks = `${d.name} ${d.tempat} ${kategoriLabel}`.toLowerCase();
  return cari
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((k) => teks.includes(k));
}
