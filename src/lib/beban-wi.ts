/**
 * Halaman Beban JP Widyaiswara — logika MURNI (diuji di uji/murni.test.ts): status beban,
 * pengelompokan per jenjang, saring & urut, ringkasan angka di atas.
 */
import { adaBatasJp } from "@/lib/kapasitas";
import { JENJANG_WI, type JenjangWi } from "@/lib/dokumen";

export type PeriodeBeban = "bulan" | "tahun" | "semua";

export type BebanWiRecord = {
  id: string;
  /** Nomor urut resmi Kepegawaian (pegawai.no); null = belum ada. */
  no: number | null;
  nama: string;
  jabatan: string;
  jenjang: JenjangWi | null;
  /** Status pegawai apa adanya ("AKTIF", "CUTI", …). */
  status: string;
  cuti: boolean;
  /** Batas JP PER BULAN yang berlaku (khusus WI atau batas jenjang); null = belum diatur. */
  jpMaksimal: number | null;
  sumberBatas: "wi" | "jenjang" | null;
  /** Semua penugasan disetujui (sepanjang waktu, info). */
  jpTotal: number;
  /** Penugasan disetujui pada diklat yang mulai di BULAN terpilih — dasar aturan batas. */
  jpBulan: number;
  /** Penugasan disetujui pada diklat yang MULAI dalam periode (periode "semua" = jpTotal). */
  jpPeriode: number;
  penugasanPeriode: number;
  /** JP sesi mengajar yang sudah dicatat dalam periode. */
  jpSesi: number;
};

export type StatusBeban = "lewat" | "dekat" | "aman" | "tanpa-batas";

/** Batas "mendekati": 80% kapasitas. */
export const AMBANG_DEKAT = 0.8;

/**
 * Status terhadap batas JP per bulan — panggil dengan JP BULAN itu (`jpBulan`), aturan yang
 * sama dengan pengajuan penugasan.
 */
export function statusBeban(jpBulan: number, jpMaksimal: number | null | undefined): StatusBeban {
  if (!adaBatasJp(jpMaksimal)) return "tanpa-batas";
  if (jpBulan > jpMaksimal) return "lewat";
  if (jpBulan >= jpMaksimal * AMBANG_DEKAT) return "dekat";
  return "aman";
}

/**
 * Panjang bar 0..1. Periode "bulan" dengan batas: terhadap batas bulanan. Selain itu: terhadap JP
 * tertinggi di daftar (perbandingan antar-WI).
 */
export function panjangBar(w: BebanWiRecord, periode: PeriodeBeban, jpTertinggi: number): number {
  if (periode === "bulan" && adaBatasJp(w.jpMaksimal)) return Math.min(1, w.jpPeriode / w.jpMaksimal);
  return jpTertinggi > 0 ? Math.min(1, w.jpPeriode / jpTertinggi) : 0;
}

const URUTAN_JENJANG: (JenjangWi | null)[] = ["utama", "madya", "muda", "pertama", null];

export function labelJenjang(j: JenjangWi | null): string {
  return JENJANG_WI.find((x) => x.kode === j)?.label ?? "Lainnya";
}

export type UrutBeban = "jenjang" | "tertinggi" | "terendah" | "nama";

export type SaringBeban = { cari: string; jenjang: JenjangWi | "semua"; urut: UrutBeban };

export function saringUrut(list: BebanWiRecord[], s: SaringBeban): BebanWiRecord[] {
  const q = s.cari.trim().toLowerCase();
  const hasil = list.filter(
    (w) => (s.jenjang === "semua" || w.jenjang === s.jenjang) && (!q || w.nama.toLowerCase().includes(q)),
  );
  const nama = (a: BebanWiRecord, b: BebanWiRecord) => a.nama.localeCompare(b.nama, "id");
  // Urutan resmi Kepegawaian (daftar urut) — yang belum bernomor di belakang.
  const resmi = (a: BebanWiRecord, b: BebanWiRecord) => (a.no ?? 1e9) - (b.no ?? 1e9) || nama(a, b);
  if (s.urut === "tertinggi") return hasil.sort((a, b) => b.jpPeriode - a.jpPeriode || resmi(a, b));
  if (s.urut === "terendah") return hasil.sort((a, b) => a.jpPeriode - b.jpPeriode || resmi(a, b));
  if (s.urut === "nama") return hasil.sort(nama);
  return hasil.sort((a, b) => URUTAN_JENJANG.indexOf(a.jenjang) - URUTAN_JENJANG.indexOf(b.jenjang) || resmi(a, b));
}

/** Kelompok per jenjang (Utama → Pertama → Lainnya), hanya yang berisi. */
export function kelompokJenjang(list: BebanWiRecord[]): { jenjang: JenjangWi | null; label: string; isi: BebanWiRecord[] }[] {
  return URUTAN_JENJANG.map((j) => ({ jenjang: j, label: labelJenjang(j), isi: list.filter((w) => w.jenjang === j) })).filter(
    (k) => k.isi.length > 0,
  );
}

export type RingkasanBeban = { aktif: number; totalJp: number; rataRata: number; lewatBatas: number; belumDitugaskan: number };

export function ringkasBeban(list: BebanWiRecord[]): RingkasanBeban {
  const aktif = list.filter((w) => !w.cuti);
  const totalJp = list.reduce((a, w) => a + w.jpPeriode, 0);
  return {
    aktif: aktif.length,
    totalJp,
    rataRata: aktif.length ? Math.round((totalJp / aktif.length) * 10) / 10 : 0,
    lewatBatas: list.filter((w) => statusBeban(w.jpBulan, w.jpMaksimal) === "lewat").length,
    belumDitugaskan: aktif.filter((w) => w.penugasanPeriode === 0).length,
  };
}

/** Inisial untuk avatar: dua huruf pertama kata nama (tanpa gelar depan seperti Dr./Drs.). */
export function inisial(nama: string): string {
  const kata = nama
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter((k) => k && !/^(dr|drs|dra|ir|prof|h|hj)\.?$/i.test(k));
  return ((kata[0]?.[0] ?? "") + (kata[1]?.[0] ?? kata[0]?.[1] ?? "")).toUpperCase() || "?";
}

/** Rona avatar tetap per orang (0..359). */
export function ronaNama(nama: string): number {
  let h = 0;
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
