/**
 * Evaluasi penyelenggaraan pelatihan oleh peserta — Formulir 23B KepKa LAN
 * 2/K.1/PDP.07/2023 (BAB III.E.4.b.2). Logika murni — diuji di uji/murni.test.ts.
 *
 * Satu isian per peserta per jadwal; skala 1–100 seperti Formulir 16–21, tetapi
 * kualifikasinya memakai keterangan formulir ini (Buruk … Sangat baik). Hasilnya
 * masukan untuk pimpinan lembaga, bukan bagian nilai peserta (Formulir 14).
 */
import { bulat2 } from "@/lib/penilaian";
import { getJenjang } from "@/lib/kurikulum";
import { periksaNilaiAspek, rataPerAspek, type AspekEvaluasi } from "@/lib/evaluasi";

/** `induk`: sub-butir bernomor di bawah satu aspek (mis. 2.e.1 "Pembelajaran mandiri"). */
export type Aspek23B = AspekEvaluasi & { induk?: string };
export type Kelompok23B = { no: number; nama: string; aspek: Aspek23B[] };

// Pembelajaran Lapangan (Studi Lapangan/VKN/Benchmarking) tidak selalu ada → boleh dikosongkan.
const LAPANGAN = "Pembelajaran Lapangan (Studi Lapangan/VKN/Benchmarking)";
const KEJELASAN = "Kejelasan informasi tentang tahapan pembelajaran";
const PEMANTAUAN = "Pemantauan penyelenggaraan pada tahapan pembelajaran";

export const FORMULIR_23B: Kelompok23B[] = [
  {
    no: 1,
    nama: "Layanan Registrasi dan Informasi",
    aspek: [
      { kode: "1a", nama: "Informasi pemanggilan peserta" },
      { kode: "1b", nama: "Kecepatan pelayanan registrasi" },
      { kode: "1c", nama: "Jadwal penyelenggaraan pelatihan" },
      { kode: "1d", nama: "Informasi tata tertib dan ketentuan pelatihan" },
    ],
  },
  {
    no: 2,
    nama: "Proses Pembelajaran",
    aspek: [
      { kode: "2a", nama: "Informasi pelaksanaan pelatihan" },
      { kode: "2b", nama: "Kelengkapan bahan ajar dan materi pelatihan" },
      { kode: "2c", nama: "Pemanfaatan teknologi dalam proses pembelajaran" },
      { kode: "2d", nama: "Pemanfaatan media komunikasi berbasis IT untuk mendukung pembimbingan" },
      { kode: "2e1", nama: "Pembelajaran mandiri", induk: KEJELASAN },
      { kode: "2e2", nama: "Distance learning", induk: KEJELASAN },
      { kode: "2e3", nama: LAPANGAN, induk: KEJELASAN, opsional: true },
      { kode: "2e4", nama: "Aktualisasi Kepemimpinan (Aksi Perubahan/Proyek Perubahan)", induk: KEJELASAN },
      { kode: "2e5", nama: "Tatap muka", induk: KEJELASAN },
      { kode: "2f1", nama: "Belajar mandiri", induk: PEMANTAUAN },
      { kode: "2f2", nama: "Distance learning", induk: PEMANTAUAN },
      { kode: "2f3", nama: "Aktualisasi Kepemimpinan", induk: PEMANTAUAN },
      { kode: "2f4", nama: "Tatap muka", induk: PEMANTAUAN },
    ],
  },
  {
    no: 3,
    nama: LAPANGAN,
    aspek: [
      { kode: "3a", nama: "Layanan transportasi dan akomodasi", opsional: true },
      { kode: "3b", nama: "Kesesuaian pemilihan lokus dengan tujuan pembelajaran", opsional: true },
      { kode: "3c", nama: "Kualitas narasumber", opsional: true },
      { kode: "3d", nama: "Kualitas pembimbing studi lapangan", opsional: true },
    ],
  },
  {
    no: 4,
    nama: "Kemanfaatan sharing knowledge pada saat seminar rancangan/seminar hasil Aktualisasi Kepemimpinan",
    aspek: [{ kode: "4", nama: "Kemanfaatan sharing knowledge pada seminar rancangan/hasil Aktualisasi Kepemimpinan" }],
  },
  {
    no: 5,
    nama: "Kesesuaian waktu dan alokasi seminar dengan jadwal",
    aspek: [{ kode: "5", nama: "Kesesuaian waktu dan alokasi seminar dengan jadwal" }],
  },
  {
    no: 6,
    nama: "Sarana dan Prasarana",
    aspek: [
      { kode: "6a", nama: "Kelengkapan informasi sarana dan prasarana selama penyelenggaraan pelatihan" },
      { kode: "6b", nama: "Ketersediaan dan kualitas asrama, ruang kelas, ruang makan, perpustakaan dan toilet" },
      { kode: "6c", nama: "Ketersediaan dan kualitas sarana pendukung pembelajaran (LCD/proyektor, flipchart, papan tulis, sound system, lighting)" },
      { kode: "6d", nama: "Ketersediaan dan kualitas sarana pembelajaran terkait teknologi informasi (Wi-Fi, e-learning, e-mailing list, dll.)" },
      { kode: "6e", nama: "Ketersediaan, kebersihan dan keberfungsian fasilitas (olahraga, kesehatan, tempat ibadah, sarana lainnya)" },
      { kode: "6f", nama: "Ketersediaan dan kualitas literatur di perpustakaan" },
      { kode: "6g", nama: "Sarana bagi penyandang disabilitas (lift, step lobby, toilet khusus)" },
      { kode: "6h", nama: "Ketersediaan ruang terbuka hijau" },
      { kode: "6i", nama: "Ketersediaan sarana pengaduan dan petugas yang menangani" },
      { kode: "6j", nama: "Keamanan lembaga pelatihan (satpam standby 24 jam, CCTV)" },
      { kode: "6k", nama: "Sarana pendukung lainnya (fasilitas kebutuhan pribadi peserta, ATM, fotokopi, dll.)" },
    ],
  },
  {
    no: 7,
    nama: "Konsumsi",
    aspek: [
      { kode: "7a", nama: "Kecukupan gizi dari menu yang dihidangkan" },
      { kode: "7b", nama: "Kecukupan hidangan konsumsi bagi seluruh peserta" },
      { kode: "7c", nama: "Kebersihan dalam penyajian makanan" },
      { kode: "7d", nama: "Ketepatan waktu penyajian makanan" },
      { kode: "7e", nama: "Variasi menu makanan yang disajikan" },
    ],
  },
  {
    no: 8,
    nama: "Pelayanan Petugas",
    aspek: [
      { kode: "8a", nama: "Sopan santun, kerapian dan keramahan petugas" },
      { kode: "8b", nama: "Respons terhadap kebutuhan dan keluhan peserta" },
      { kode: "8c", nama: "Ketersediaan media komunikasi" },
      { kode: "8d", nama: "Kemudahan menghubungi petugas" },
    ],
  },
];

export const ASPEK_23B: Aspek23B[] = FORMULIR_23B.flatMap((k) => k.aspek);

/** Formulir 23B untuk Pelatihan Struktural Kepemimpinan (di balai: PKA & PKP). */
export const pakaiFormulir23B = (jenisPelatihan: string | null | undefined) => !!getJenjang(jenisPelatihan);

/** Formulir menilai seluruh pelatihan → dibuka pada 7 hari terakhir (atau sejak hari pertama bila tanpa tanggal selesai). */
export const HARI_BUKA_SEBELUM_SELESAI = 6;
export function mulaiIsi23B(mulai: string, selesai: string | null | undefined): string {
  if (!selesai) return mulai;
  const d = new Date(`${selesai}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - HARI_BUKA_SEBELUM_SELESAI);
  const buka = d.toISOString().slice(0, 10);
  return buka < mulai ? mulai : buka;
}

export const periksaIsian23B = (nilai: Record<string, number | null | undefined>) => periksaNilaiAspek(ASPEK_23B, nilai);

// Keterangan kolom Formulir 23B: 1–60 Buruk, 60,1–70 Kurang, 70,1–80 Cukup, 80,1–90 Baik, 90,1–100 Sangat baik.
export type Kualifikasi23B = "BURUK" | "KURANG" | "CUKUP" | "BAIK" | "SANGAT_BAIK";
export const LABEL_KUALIFIKASI_23B: Record<Kualifikasi23B, string> = {
  BURUK: "Buruk",
  KURANG: "Kurang",
  CUKUP: "Cukup",
  BAIK: "Baik",
  SANGAT_BAIK: "Sangat baik",
};
export function kualifikasi23B(nilai: number): Kualifikasi23B {
  const n = bulat2(nilai);
  if (n > 90) return "SANGAT_BAIK";
  if (n > 80) return "BAIK";
  if (n > 70) return "CUKUP";
  if (n > 60) return "KURANG";
  return "BURUK";
}

type Rata = { rata: number | null; kualifikasi: Kualifikasi23B | null };
const rataDari = (vs: (number | null)[]): Rata => {
  const isi = vs.filter((v): v is number => v != null);
  const rata = isi.length ? bulat2(isi.reduce((s, x) => s + x, 0) / isi.length) : null;
  return { rata, kualifikasi: rata == null ? null : kualifikasi23B(rata) };
};

export type Rekap23B = Rata & {
  responden: number;
  kelompok: (Kelompok23B & Rata & { perAspek: (Aspek23B & { rata: number | null; n: number })[] })[];
};

/**
 * Rekap: rata-rata tiap aspek; rata-rata kelompok = rata-rata aspeknya yang dinilai;
 * rata-rata keseluruhan = rata-rata per responden (seperti Formulir 22).
 */
export function rekap23B(isian: { nilai: Record<string, number>; rata: number }[]): Rekap23B {
  const per = new Map(rataPerAspek(ASPEK_23B, isian).map((a) => [a.kode, a]));
  return {
    responden: isian.length,
    ...rataDari(isian.map((x) => x.rata)),
    kelompok: FORMULIR_23B.map((k) => {
      const perAspek = k.aspek.map((a) => ({ ...a, rata: per.get(a.kode)?.rata ?? null, n: per.get(a.kode)?.n ?? 0 }));
      return { ...k, ...rataDari(perAspek.map((a) => a.rata)), perAspek };
    }),
  };
}
