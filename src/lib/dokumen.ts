/**
 * Dokumen penugasan WI (tahap C) — logika MURNI, diuji di uji/murni.test.ts.
 * Surat tugas mengikuti Permendagri 18/2024 (susunan & format di src/lib/tata-naskah.ts).
 * KARKEN dibuat manual oleh WI di luar aplikasi (keputusan 23 Okt 2026).
 */
import { JABATAN_KEPALA, NAMA_LEMBAGA } from "@/lib/aplikasi";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "198405292008012001" -> "19840529 200801 2 001" (format NIP di naskah dinas). Selain 18 angka: apa adanya. */
export function nipBerspasi(nip: string | null | undefined): string {
  const n = (nip ?? "").replace(/\D/g, "");
  if (n.length !== 18) return (nip ?? "").trim();
  return `${n.slice(0, 8)} ${n.slice(8, 14)} ${n.slice(14, 15)} ${n.slice(15)}`;
}

/** Nama pangkat PNS menurut golongan ruang (PP 99/2000). Golongan menentukan, nama mengikuti. */
export const PANGKAT_GOLONGAN: Record<string, string> = {
  "I/a": "Juru Muda", "I/b": "Juru Muda Tingkat I", "I/c": "Juru", "I/d": "Juru Tingkat I",
  "II/a": "Pengatur Muda", "II/b": "Pengatur Muda Tingkat I", "II/c": "Pengatur", "II/d": "Pengatur Tingkat I",
  "III/a": "Penata Muda", "III/b": "Penata Muda Tingkat I", "III/c": "Penata", "III/d": "Penata Tingkat I",
  "IV/a": "Pembina", "IV/b": "Pembina Tingkat I", "IV/c": "Pembina Utama Muda", "IV/d": "Pembina Utama Madya", "IV/e": "Pembina Utama",
};

/** "iv/d " -> "IV/d"; selain golongan PNS -> null (mis. golongan PPPK "IX"). */
export function golonganPns(gol: string | null | undefined): string | null {
  const m = (gol ?? "").trim().match(/^(I{1,3}|IV)\s*\/\s*([a-e])$/i);
  return m ? `${m[1].toUpperCase()}/${m[2].toLowerCase()}` : null;
}

/**
 * Isian "Pangkat/gol" surat tugas: "Pembina Utama Madya (IV/d)". Nama pangkat diturunkan dari golongan
 * (data HR kadang salah tulis, mis. IV/d tertulis "Pembina Utama Muda"). Tanpa golongan PNS (PPPK,
 * non-ASN): pangkat apa adanya bila ada, selain itu "-" (seperti contoh surat kantor).
 */
export function pangkatGolongan(pangkat: string | null | undefined, golRuang: string | null | undefined): string {
  const g = golonganPns(golRuang);
  if (g) return `${PANGKAT_GOLONGAN[g]} (${g})`;
  const p = (pangkat ?? "").trim();
  if (!p) return "-";
  if (p.includes("(")) return p;
  return p.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()).replace(/ i$/, " I");
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** Angka -> kata ("dua", "dua belas", "dua puluh satu"). 0..999.999. */
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "nol";
  const t = (x: number): string => {
    if (x < 12) return SATUAN[x];
    if (x < 20) return `${SATUAN[x - 10]} belas`;
    if (x < 100) return `${SATUAN[Math.floor(x / 10)]} puluh${x % 10 ? " " + SATUAN[x % 10] : ""}`;
    if (x < 200) return `seratus${x % 100 ? " " + t(x % 100) : ""}`;
    if (x < 1000) return `${SATUAN[Math.floor(x / 100)]} ratus${x % 100 ? " " + t(x % 100) : ""}`;
    if (x < 2000) return `seribu${x % 1000 ? " " + t(x % 1000) : ""}`;
    return `${t(Math.floor(x / 1000))} ribu${x % 1000 ? " " + t(x % 1000) : ""}`;
  };
  return t(n);
}

/** "2026-08-27" -> { t: 27, b: 8, y: 2026 } (tanpa zona waktu). */
function pecah(iso: string) {
  const [y, b, t] = iso.slice(0, 10).split("-").map(Number);
  return { y, b, t };
}

/** "2026-08-27" -> "27 Agustus 2026". */
export function tanggalPanjang(iso: string): string {
  const { y, b, t } = pecah(iso);
  return `${t} ${BULAN[b - 1]} ${y}`;
}

/** Periode surat: "27 s.d. 28 Agustus 2026", "30 September s.d. 2 Oktober 2026", satu hari: "27 Agustus 2026". */
export function periodeSurat(mulai: string, selesai?: string | null): string {
  const a = pecah(mulai);
  if (!selesai || selesai.slice(0, 10) === mulai.slice(0, 10)) return tanggalPanjang(mulai);
  const z = pecah(selesai);
  if (a.y !== z.y) return `${tanggalPanjang(mulai)} s.d. ${tanggalPanjang(selesai)}`;
  if (a.b !== z.b) return `${a.t} ${BULAN[a.b - 1]} s.d. ${tanggalPanjang(selesai)}`;
  return `${a.t} s.d. ${tanggalPanjang(selesai)}`;
}

/** Banyaknya hari kalender mulai..selesai (inklusif). */
export function jumlahHari(mulai: string, selesai?: string | null): number {
  if (!selesai) return 1;
  const ms = Date.UTC(pecah(selesai).y, pecah(selesai).b - 1, pecah(selesai).t) - Date.UTC(pecah(mulai).y, pecah(mulai).b - 1, pecah(mulai).t);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Butir "Untuk" bawaan surat tugas mengajar (dapat diubah sebelum disimpan). */
export function untukBawaan(d: {
  namaDiklat: string;
  modePelatihan?: string | null;
  tempat?: string | null;
  mulai: string;
  selesai?: string | null;
}): string[] {
  const mode = d.modePelatihan === "BLENDED" ? " secara blended learning" : d.modePelatihan === "KLASIKAL" ? " secara klasikal" : "";
  const tempat = d.tempat?.trim() ? `, di ${d.tempat.trim()}` : "";
  const n = jumlahHari(d.mulai, d.selesai);
  return [
    `Melaksanakan Tugas dalam rangka Menjadi Tenaga Pengajar pada ${d.namaDiklat.trim()}${mode}${tempat} selama ${n} (${terbilang(n)}) hari pada tanggal ${periodeSurat(d.mulai, d.selesai)}`,
    `Melaporkan hasil pelaksanaan tugas ini kepada Kepala ${NAMA_LEMBAGA}.`,
  ];
}

export const PENANDATANGAN_BAWAAN = JABATAN_KEPALA.join("\n");

// ------------------------------------------------------------------ JENJANG & BULAN

export type JenjangWi = "pertama" | "muda" | "madya" | "utama";
export const JENJANG_WI: { kode: JenjangWi; label: string }[] = [
  { kode: "pertama", label: "Ahli Pertama" },
  { kode: "muda", label: "Ahli Muda" },
  { kode: "madya", label: "Ahli Madya" },
  { kode: "utama", label: "Ahli Utama" },
];

/** "WIDYAISWARA AHLI MADYA" -> "madya". Bukan WI / tak dikenali -> null. */
export function jenjangWi(jabatan: string | null | undefined): JenjangWi | null {
  const j = (jabatan ?? "").toLowerCase();
  if (!j.includes("widyaiswara")) return null;
  for (const k of ["pertama", "muda", "madya", "utama"] as const) if (j.includes(k)) return k;
  return null;
}

/** "2026-09" sah? */
export function isBulan(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** "2026-09" -> "September 2026". */
export function labelBulan(bulan: string): string {
  const [y, b] = bulan.split("-").map(Number);
  return `${BULAN[b - 1]} ${y}`;
}

/** Rentang tanggal satu bulan: [awal, awalBulanBerikut) sebagai "YYYY-MM-DD". */
export function rentangBulan(bulan: string): { awal: string; akhirEksklusif: string } {
  const [y, b] = bulan.split("-").map(Number);
  const ny = b === 12 ? y + 1 : y;
  const nb = b === 12 ? 1 : b + 1;
  return { awal: `${bulan}-01`, akhirEksklusif: `${ny}-${String(nb).padStart(2, "0")}-01` };
}

/** Bulan sebelum/sesudah: geserBulan("2026-01", -1) = "2025-12". */
export function geserBulan(bulan: string, n: number): string {
  const [y, b] = bulan.split("-").map(Number);
  const i = y * 12 + (b - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
