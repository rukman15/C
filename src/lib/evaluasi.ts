/**
 * Evaluasi tenaga pelatihan oleh peserta (KepKa LAN 2/K.1/PDP.07/2023 BAB III.E.3,
 * Formulir 16–21; rekap Formulir 22). Logika murni — diuji di uji/murni.test.ts.
 * Menggantikan Google Form evaluasi WI di situs PKA/PKP balai.
 *
 * Skala nilai 1–100 (formulir memakai kolom 1–60, 60,01–70, 70,01–80, 80,01–90,
 * 90,01–100 — peserta menulis angkanya). Kualifikasi rekap memakai rentang yang sama.
 */
import { bulat2, kualifikasi, type Kualifikasi } from "@/lib/penilaian";

export const FORMULIR_EVALUASI = ["PENGAMPU", "PENCERAMAH", "COACH", "PENGUJI", "MENTOR"] as const;
export type FormulirEvaluasi = (typeof FORMULIR_EVALUASI)[number];
export const isFormulirEvaluasi = (v: unknown): v is FormulirEvaluasi =>
  typeof v === "string" && (FORMULIR_EVALUASI as readonly string[]).includes(v);

export type AspekEvaluasi = { kode: string; nama: string; opsional?: boolean };

export const DEFINISI_FORMULIR: Record<FormulirEvaluasi, { nomor: number; label: string; aspek: AspekEvaluasi[] }> = {
  PENGAMPU: {
    nomor: 17,
    label: "Pengampu Materi",
    aspek: [
      { kode: "A1", nama: "Penguasaan materi" },
      { kode: "A2", nama: "Sistematika penyajian dan cara menyajikan" },
      { kode: "A3", nama: "Ketepatan waktu dan kehadiran" },
      { kode: "A4", nama: "Penggunaan metode dan media pembelajaran" },
      { kode: "A5", nama: "Sikap dan perilaku" },
      { kode: "A6", nama: "Cara menjawab pertanyaan dari peserta" },
      { kode: "A7", nama: "Penggunaan bahasa" },
      { kode: "A8", nama: "Pemberian motivasi kepada peserta" },
      { kode: "A9", nama: "Kerja sama antar widyaiswara (khusus tim teaching)", opsional: true },
      { kode: "A10", nama: "Kecakapan menciptakan situasi dinamis kelas" },
    ],
  },
  PENCERAMAH: {
    nomor: 16,
    label: "Penceramah",
    aspek: [
      { kode: "A1", nama: "Penguasaan materi" },
      { kode: "A2", nama: "Cara menyajikan" },
      { kode: "A3", nama: "Cara menjawab pertanyaan dari peserta" },
      { kode: "A4", nama: "Pemberian motivasi dan inspirasi kepada peserta" },
    ],
  },
  COACH: {
    nomor: 20,
    label: "Coach",
    aspek: [
      { kode: "A1", nama: "Kemampuan membimbing" },
      { kode: "A2", nama: "Ketepatan waktu dan kehadiran" },
      { kode: "A3", nama: "Penggunaan metode dan media pembimbingan" },
      { kode: "A4", nama: "Sikap dan perilaku" },
      { kode: "A5", nama: "Pemberian inspirasi" },
      { kode: "A6", nama: "Pemberian motivasi" },
    ],
  },
  PENGUJI: {
    nomor: 19,
    label: "Penguji",
    aspek: [
      { kode: "A1", nama: "Kemampuan menggali potensi belajar peserta" },
      { kode: "A2", nama: "Pemberian motivasi" },
      { kode: "A3", nama: "Pemberian inspirasi" },
    ],
  },
  MENTOR: {
    nomor: 21,
    label: "Mentor",
    aspek: [
      { kode: "A1", nama: "Kemampuan membimbing" },
      { kode: "A2", nama: "Penggunaan metode dan media pembimbingan" },
      { kode: "A3", nama: "Pemberian inspirasi" },
      { kode: "A4", nama: "Pemberian motivasi" },
      { kode: "A5", nama: "Pembimbingan pemetaan sikap perilaku kepemimpinan dan strategi pengembangan potensi diri" },
      { kode: "A6", nama: "Pembimbingan pelaksanaan pengembangan potensi diri" },
    ],
  },
};

export const CATATAN_EVALUASI_MAKS = 1000;
/** WI baru melihat rekap & saran bila respondennya sedikitnya sekian (menjaga kerahasiaan peserta). */
export const MIN_RESPONDEN_TAMPIL = 3;

/**
 * Periksa nilai per aspek. Semua aspek wajib kecuali yang opsional (boleh null =
 * tidak dinilai). Nilai 1–100, paling banyak 2 desimal. Hasil: nilai yang dirapikan
 * + rata-rata aspek yang diisi; atau pesan galat. Dipakai juga Formulir 23B.
 */
export function periksaNilaiAspek(
  aspek: AspekEvaluasi[],
  nilai: Record<string, number | null | undefined>,
): { nilai: Record<string, number>; rata: number } | { galat: string } {
  const kodeSah = new Set(aspek.map((a) => a.kode));
  for (const k of Object.keys(nilai)) if (!kodeSah.has(k)) return { galat: `Aspek "${k}" tidak dikenal` };
  const out: Record<string, number> = {};
  for (const a of aspek) {
    const v = nilai[a.kode];
    if (v == null) {
      if (a.opsional) continue;
      return { galat: `Nilai "${a.nama}" belum diisi` };
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 1 || v > 100) return { galat: `Nilai "${a.nama}" harus 1–100` };
    out[a.kode] = bulat2(v);
  }
  const isi = Object.values(out);
  if (!isi.length) return { galat: "Belum ada nilai yang diisi" };
  return { nilai: out, rata: bulat2(isi.reduce((s, x) => s + x, 0) / isi.length) };
}

/** Periksa isian satu evaluasi tenaga pelatihan (Formulir 16–21). */
export const periksaIsianEvaluasi = (formulir: FormulirEvaluasi, nilai: Record<string, number | null | undefined>) =>
  periksaNilaiAspek(DEFINISI_FORMULIR[formulir].aspek, nilai);

/** Rata-rata tiap aspek dari banyak isian (aspek yang tidak dinilai tidak dihitung). */
export function rataPerAspek(aspek: AspekEvaluasi[], isian: { nilai: Record<string, number> }[]) {
  return aspek.map((a) => {
    const vs = isian.map((x) => x.nilai[a.kode]).filter((v): v is number => typeof v === "number");
    return { kode: a.kode, nama: a.nama, rata: vs.length ? bulat2(vs.reduce((s, x) => s + x, 0) / vs.length) : null, n: vs.length };
  });
}

export type RekapSasaran = {
  responden: number;
  rata: number | null;
  kualifikasi: Kualifikasi | null;
  perAspek: { kode: string; nama: string; rata: number | null; n: number }[];
};

/** Rekap satu sasaran (Formulir 22): rata-rata tiap aspek dan rata-rata keseluruhan (rata-rata per responden). */
export function rekapSasaran(formulir: FormulirEvaluasi, isian: { nilai: Record<string, number>; rata: number }[]): RekapSasaran {
  const def = DEFINISI_FORMULIR[formulir];
  const rata = isian.length ? bulat2(isian.reduce((s, x) => s + x.rata, 0) / isian.length) : null;
  return {
    responden: isian.length,
    rata,
    kualifikasi: rata == null ? null : kualifikasi(rata),
    perAspek: rataPerAspek(def.aspek, isian),
  };
}

/** Kunci sasaran pengampu: satu per (WI, mata pelatihan). */
export const kunciPengampu = (pegawaiId: string, kodeMp: string | null | undefined) => `P:${pegawaiId}:${kodeMp || "-"}`;
export const kunciSasaranLain = (id: string) => `S:${id}`;
/** Kunci sasaran coach dari tab Kelompok: satu per kelompok, diisi anggota kelompok itu saja. */
export const kunciCoachKelompok = (kelompokId: string) => `K:${kelompokId}`;

/** Rentang nilai formulir (kolom) untuk tombol cepat di layar. */
export const RENTANG_NILAI = [
  { label: "1–60", nilai: 55 },
  { label: "60–70", nilai: 65 },
  { label: "70–80", nilai: 75 },
  { label: "80–90", nilai: 85 },
  { label: "90–100", nilai: 95 },
];
