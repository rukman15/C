import type { UserRole } from "@/lib/roles";

/**
 * Penugasan sementara (Plt/Plh) & aturan status akun — logika murni (diuji di
 * uji/murni.test.ts). Tanggal dibandingkan sebagai teks "YYYY-MM-DD" (tanggal
 * kalender WIB), jadi tidak tergeser zona waktu.
 *
 * Plt (Pelaksana Tugas): jabatan definitif kosong (mis. pejabat pindah/promosi).
 * Plh (Pelaksana Harian): pejabat definitif berhalangan sementara (cuti, dinas luar).
 */
export const JENIS_SEMENTARA = ["PLT", "PLH"] as const;
export type JenisSementara = (typeof JENIS_SEMENTARA)[number];
export const LABEL_JENIS: Record<JenisSementara, string> = { PLT: "Plt.", PLH: "Plh." };

/** Peran yang boleh diberikan lewat Plt/Plh — bukan admin (akses teknis) dan bukan peserta. */
export const PERAN_SEMENTARA: UserRole[] = [
  "kepala-balai",
  "kabag-tu",
  "kepegawaian",
  "keuangan",
  "ketua-diklat",
  "pamdal",
];

/**
 * Peran yang hanya boleh diberikan lewat Plt/Plh oleh ADMIN (bukan kepegawaian):
 * mencegah kepegawaian memberi dirinya — langsung atau lewat orang perantara —
 * hak pimpinan/kepegawaian/keuangan.
 */
export const PERAN_SEMENTARA_KHUSUS_ADMIN: UserRole[] = ["kepala-balai", "kabag-tu", "kepegawaian", "keuangan"];
/** Peran yang pada satu waktu hanya dipegang satu orang (bentrok dicek per peran, bukan hanya teks jabatan). */
export const PERAN_TUNGGAL: UserRole[] = ["kepala-balai", "kabag-tu"];

export type StatusSementara = "AKAN_DATANG" | "BERLAKU" | "SELESAI" | "DICABUT";
export const LABEL_STATUS_SEMENTARA: Record<StatusSementara, string> = {
  AKAN_DATANG: "Akan datang",
  BERLAKU: "Berlaku",
  SELESAI: "Selesai",
  DICABUT: "Dicabut",
};

export type PenugasanSementaraRingkas = {
  jenis: string;
  jabatan: string;
  mulai: string; // YYYY-MM-DD
  selesai: string; // YYYY-MM-DD
  dicabut: boolean;
};

export function statusSementara(p: PenugasanSementaraRingkas, hariIni: string): StatusSementara {
  if (p.dicabut) return "DICABUT";
  if (hariIni < p.mulai) return "AKAN_DATANG";
  if (hariIni > p.selesai) return "SELESAI";
  return "BERLAKU";
}

/** "Plt. Kepala Bagian Tata Usaha" */
export function labelSebagai(p: { jenis: string; jabatan: string }): string {
  const awalan = LABEL_JENIS[p.jenis as JenisSementara] ?? `${p.jenis}.`;
  return `${awalan} ${p.jabatan.trim()}`;
}

/** Dua rentang tanggal (inklusif) beririsan? */
export function rentangBeririsan(a: { mulai: string; selesai: string }, b: { mulai: string; selesai: string }): boolean {
  return a.mulai <= b.selesai && b.mulai <= a.selesai;
}

/**
 * Status pegawai yang berarti orangnya sudah tidak bekerja di balai: akunnya
 * dinonaktifkan otomatis dan Plt/Plh-nya dicabut. CUTI, DIPERBANTUKAN, dll.
 * tidak menutup akun.
 */
const POLA_TUTUP = /\b(NONAKTIF|NON AKTIF|PINDAH|MUTASI|PENSIUN|BERHENTI|DIBERHENTIKAN|MENINGGAL|WAFAT|KELUAR)\b/;
export function statusMenutupAkun(status: string | null | undefined): boolean {
  if (!status) return false;
  return POLA_TUTUP.test(status.toUpperCase().replace(/[-_]/g, " "));
}

/** Pilihan status baku di formulir pegawai. */
export const STATUS_PEGAWAI_BAKU = ["AKTIF", "CUTI", "PINDAH", "PENSIUN", "BERHENTI", "NONAKTIF"];
