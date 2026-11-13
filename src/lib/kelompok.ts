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
  { kode: "ELEARNING", label: "E-learning", pedoman: JUMLAH_KELOMPOK_PEDOMAN },
  { kode: "SEMINAR", label: "Bimbingan & seminar", pedoman: JUMLAH_KELOMPOK_PEDOMAN },
  { kode: "STULA", label: "Studi lapangan", pedoman: null },
  { kode: "MANDIRI", label: "Belajar mandiri", pedoman: null },
];

/**
 * Kelompok yang dibimbing coach dan menjadi ruang coaching serta kelompok seminar RAP & LAP (EB-046).
 * Sebelumnya coach melekat pada kelompok ELEARNING; kelompok e-learning kini dibagi acak tanpa coach (EB-047).
 */
export const JENIS_KELOMPOK_COACH: JenisKelompok = "SEMINAR";
export const pakaiCoach = (jenis: string) => jenis === JENIS_KELOMPOK_COACH;
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
    (a, b) =>
      (a.instansi ?? "")
        .trim()
        .toLowerCase()
        .localeCompare((b.instansi ?? "").trim().toLowerCase()) || a.nomor - b.nomor,
  );
  return new Map(urut.map((p, i) => [p.id, (i % n) + 1]));
}

/** Peringatan susunan kelompok (tidak memblokir). `anggota` = jumlah peserta aktif per kelompok. */
export function periksaKelompok(anggota: number[], tanpaKelompok: number, pedoman: number | null = JUMLAH_KELOMPOK_PEDOMAN): string[] {
  const out: string[] = [];
  if (!anggota.length) return tanpaKelompok ? ["Kelompok belum dibentuk."] : [];
  if (pedoman !== null && anggota.length !== pedoman) out.push(`Pedoman menetapkan ${pedoman} kelompok kecil (e-learning & pembimbingan coach); saat ini ${anggota.length}.`);
  if (tanpaKelompok) out.push(`${tanpaKelompok} peserta aktif belum masuk kelompok.`);
  const kosong = anggota.filter((x) => x === 0).length;
  if (kosong) out.push(`${kosong} kelompok belum punya anggota.`);
  const isi = anggota.filter((x) => x > 0);
  if (isi.length > 1 && Math.max(...isi) - Math.min(...isi) > 1) out.push(`Jumlah anggota tidak merata (${Math.min(...isi)}–${Math.max(...isi)} orang).`);
  return out;
}

// --- Revisi kelompok (EB-047, EB-048, EB-050) ------------------------------------------------

type CalonAnggota = { id: string; nomor: number; nama?: string; jabatan?: string | null; instansi?: string | null };

/** Pengacak deterministik (mulberry32) supaya hasil "acak" bisa diulang dalam uji. */
function pengacak(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kelompok e-learning dibagi ACAK (EB-047), tetap merata (selisih anggota paling banyak 1). */
export function bagiAcak(peserta: CalonAnggota[], jumlah: number, benih: number = Date.now()): Map<string, number> {
  const n = Math.max(1, Math.floor(jumlah));
  const acak = pengacak(benih);
  const urut = [...peserta].sort((a, b) => a.nomor - b.nomor);
  for (let i = urut.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [urut[i], urut[j]] = [urut[j], urut[i]];
  }
  return new Map(urut.map((p, i) => [p.id, (i % n) + 1]));
}

/** "Kabupaten Sumedang" / "Kota Cirebon" dari teks instansi atau jabatan; null bila tidak tertulis. */
export function kabupatenDari(...teks: (string | null | undefined)[]): string | null {
  for (const t of teks) {
    const m = /\b(Kabupaten|Kab\.|Pemkab|Kota|Pemkot)\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)*)/.exec(t ?? "");
    if (m) return `${m[1] === "Kota" || m[1] === "Pemkot" ? "Kota" : "Kabupaten"} ${m[2].trim()}`;
  }
  return null;
}

const kunci = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

/**
 * Kelompok bimbingan & seminar (EB-048): disusun per instansi (pemerintah daerah) lalu kabupaten/kota, sehingga peserta
 * seinstansi dan sewilayah berkumpul. Urut kabupaten, lalu instansi, lalu nomor; dipotong berurutan menjadi `jumlah`
 * kelompok yang merata (selisih paling banyak 1).
 */
export function bagiInstansiKabupaten(peserta: CalonAnggota[], jumlah: number): Map<string, number> {
  const n = Math.max(1, Math.floor(jumlah));
  const urut = [...peserta].sort(
    (a, b) =>
      kunci(kabupatenDari(a.instansi, a.jabatan) ?? "~").localeCompare(kunci(kabupatenDari(b.instansi, b.jabatan) ?? "~")) ||
      kunci(a.instansi).localeCompare(kunci(b.instansi)) ||
      a.nomor - b.nomor,
  );
  const dasar = Math.floor(urut.length / n);
  const lebih = urut.length % n;
  const hasil = new Map<string, number>();
  let i = 0;
  for (let k = 1; k <= n; k++) {
    const isi = dasar + (k <= lebih ? 1 : 0);
    for (let j = 0; j < isi; j++) hasil.set(urut[i++].id, k);
  }
  return hasil;
}

/**
 * Kategori instansi untuk studi lapangan (EB-050). Kata kunci dicocokkan berurutan; yang pertama cocok dipakai.
 * Daftar lengkap belum ditetapkan: admin bisa mengubah kategori tiap peserta dan kelompok.
 */
export const KATEGORI_INSTANSI: { kode: string; label: string; kata: string[] }[] = [
  { kode: "KECAMATAN", label: "Kecamatan", kata: ["kecamatan", "camat", "kelurahan"] },
  { kode: "KESEHATAN", label: "Kesehatan/RSUD", kata: ["rumah sakit", "rsud", "rsd ", "puskesmas", "kesehatan", "dinkes"] },
  { kode: "KOMINFO", label: "Kominfo", kata: ["komunikasi", "informatika", "kominfo", "persandian", "statistik"] },
  {
    kode: "EKONOMI",
    label: "Disnaker/Perindag/Koperasi & UKM",
    kata: ["tenaga kerja", "transmigrasi", "perindustrian", "perdagangan", "koperasi", "usaha mikro", "ukm", "penanaman modal"],
  },
  { kode: "PERENCANAAN", label: "Perencanaan (Bappeda)", kata: ["perencanaan pembangunan", "bappeda", "bapperida", "penelitian dan pengembangan", "riset"] },
  { kode: "KEUANGAN", label: "Keuangan & pendapatan", kata: ["keuangan", "pendapatan", "aset"] },
  { kode: "KEPEGAWAIAN", label: "Kepegawaian", kata: ["kepegawaian", "sumber daya manusia", "bkpsdm"] },
  { kode: "PU", label: "PU/Perumahan", kata: ["pekerjaan umum", "tata ruang", "perumahan", "permukiman", "pertanahan"] },
  { kode: "PERTANIAN", label: "Pertanian & pangan", kata: ["pertanian", "pangan", "perikanan", "peternakan", "kehutanan"] },
  { kode: "PENDIDIKAN", label: "Pendidikan & kebudayaan", kata: ["pendidikan", "kebudayaan", "pariwisata", "pemuda"] },
  { kode: "KEPENDUDUKAN", label: "Kependudukan & capil", kata: ["kependudukan", "pencatatan sipil"] },
  { kode: "SOSIAL", label: "Sosial & pemberdayaan", kata: ["sosial", "pemberdayaan", "perempuan", "anak", "keluarga berencana"] },
  { kode: "PERHUBUNGAN", label: "Perhubungan", kata: ["perhubungan"] },
  { kode: "SETDA", label: "Setda/Inspektorat", kata: ["sekretariat daerah", "setda", "inspektorat", "dprd"] },
  { kode: "LAINNYA", label: "Lainnya", kata: [] },
];
export const labelKategori = (kode: string | null | undefined) => KATEGORI_INSTANSI.find((k) => k.kode === kode)?.label ?? kode ?? "";

/** Tebak kategori dari jabatan dan instansi peserta (jabatan sering memuat nama dinas lengkap). */
export function tebakKategori(jabatan?: string | null, instansi?: string | null): string {
  const t = ` ${kunci(jabatan)} ${kunci(instansi)} `;
  return KATEGORI_INSTANSI.find((k) => k.kata.some((w) => t.includes(w)))?.kode ?? "LAINNYA";
}

/**
 * Kelompok studi lapangan per kategori instansi (EB-050): satu kategori tidak dipecah; kategori dimasukkan mulai dari
 * yang terbesar ke kelompok yang anggotanya paling sedikit. Hasil: nomor kelompok per peserta dan daftar kode kategori
 * per kelompok (untuk mengisi kolom kategori kelompok).
 */
export function bagiPerKategori(peserta: (CalonAnggota & { kategori: string })[], jumlah: number): { nomor: Map<string, number>; kategori: Map<number, string[]> } {
  const n = Math.max(1, Math.floor(jumlah));
  const perKat = new Map<string, (CalonAnggota & { kategori: string })[]>();
  for (const p of [...peserta].sort((a, b) => a.nomor - b.nomor)) perKat.set(p.kategori, [...(perKat.get(p.kategori) ?? []), p]);
  const isi = Array.from({ length: n }, () => 0);
  const nomor = new Map<string, number>();
  const kategori = new Map<number, string[]>();
  const urut = [...perKat.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [kode, anggota] of urut) {
    const k = isi.indexOf(Math.min(...isi));
    isi[k] += anggota.length;
    for (const p of anggota) nomor.set(p.id, k + 1);
    kategori.set(k + 1, [...(kategori.get(k + 1) ?? []), kode]);
  }
  return { nomor, kategori };
}
