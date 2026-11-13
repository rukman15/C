/**
 * Penilaian & kelulusan peserta PKA/PKP (LMS tahap 3) — MURNI, dipakai server
 * dan halaman.
 *
 * Dasar: Pedoman (KepKa LAN No. 2/K.1/PDP.07/2023) BAB III.E.
 *  - Evaluasi peserta = 5 kolom Formulir 14: akademik, pembelajaran lapangan,
 *    perencanaan aksi perubahan, implementasi aksi perubahan, sikap perilaku.
 *    Tiap kolom = nilai aspek (0–100) dikali bobotnya; nilai akhir = jumlahnya.
 *  - Kualifikasi: sangat memuaskan > 90; memuaskan > 80; baik > 70;
 *    kurang baik > 60; tidak memenuhi kualifikasi <= 60.
 *  - "Lulus" kalau kualifikasi paling rendah BAIK pada setiap aspek evaluasi;
 *    "ditunda" kalau ada yang KURANG BAIK; "tidak lulus" kalau ada yang TIDAK
 *    MEMENUHI. Yang ditunda mendapat satu kali remedial (tidak untuk sikap
 *    perilaku); sesudahnya lulus dengan nilai paling tinggi 85,00, atau tidak lulus.
 *
 * "Aspek evaluasi" pada aturan kelulusan dibaca sebagai 5 jenis evaluasi di
 * atas (nilai tiap jenis = rata-rata tertimbang aspek di dalamnya) — itu yang
 * direkap dan diberi kualifikasi di Formulir 14.
 *
 * Aplikasi menghitung dan menandai; penetapan tetap oleh Tim Evaluasi Akhir.
 */
import { ATURAN, getJenjang, isModePelatihan, type JenisEvaluasi, type Penilai } from "@/lib/kurikulum";

export const EVALUASI: { kode: JenisEvaluasi; label: string; singkat: string; remedial: boolean }[] = [
  { kode: "AKADEMIK", label: "Evaluasi Akademik", singkat: "Akademik", remedial: true },
  { kode: "PEMBELAJARAN_LAPANGAN", label: "Evaluasi Pembelajaran Lapangan", singkat: "Lapangan", remedial: true },
  { kode: "AKTUALISASI_RANCANGAN", label: "Evaluasi Perencanaan Aksi Perubahan", singkat: "Perencanaan", remedial: true },
  { kode: "AKTUALISASI_IMPLEMENTASI", label: "Evaluasi Implementasi Aksi Perubahan", singkat: "Implementasi", remedial: true },
  // Pedoman: "Remedial tidak diberlakukan untuk penilaian sikap perilaku."
  { kode: "SIKAP_PERILAKU", label: "Evaluasi Sikap Perilaku", singkat: "Sikap", remedial: false },
];

export function labelEvaluasi(kode: string): string {
  return EVALUASI.find((e) => e.kode === kode)?.label ?? kode;
}

export const LABEL_PENILAI: Record<Penilai, string> = {
  PENGAMPU: "Pengampu materi",
  PENGUJI: "Penguji",
  PENYELENGGARA: "Penyelenggara",
  MENTOR: "Mentor",
  COACH: "Coach",
  PESERTA: "Peserta (sosiometri)",
  PEMBIMBING: "Pendamping studi lapangan",
  SISTEM: "Kuis LMS",
};

/**
 * Penilai yang bisa mengisi sendiri lewat akun Widyaiswara. Sisanya (mentor =
 * atasan peserta, sosiometri, kuis, kedisiplinan oleh penyelenggara) diisi
 * Ketua Diklat dari formulirnya.
 */
export const PENILAI_WI: readonly Penilai[] = ["PENGAMPU", "PENGUJI", "PEMBIMBING", "COACH"];

export type AspekPenilaian = {
  /** "<JENIS_EVALUASI>-<urutan>", mis. "AKADEMIK-2". Stabil selama program & mode tidak berubah. */
  kode: string;
  jenisEvaluasi: JenisEvaluasi;
  nama: string;
  bobot: number;
  penilai: Penilai;
  bisaDiisiWi: boolean;
};

/** Aspek penilaian satu program pada satu mode; [] kalau bukan PKA/PKP. */
export function daftarAspek(jenis: string | null | undefined, mode: string | null | undefined): AspekPenilaian[] {
  const j = getJenjang(jenis);
  if (!j || !isModePelatihan(mode)) return [];
  const urut = new Map<string, number>();
  return (j.aspek[mode] ?? []).map((a) => {
    const n = (urut.get(a.jenisEvaluasi) ?? 0) + 1;
    urut.set(a.jenisEvaluasi, n);
    const penilai = a.penilai ?? "PENYELENGGARA";
    return {
      kode: `${a.jenisEvaluasi}-${n}`,
      jenisEvaluasi: a.jenisEvaluasi,
      nama: a.nama,
      bobot: a.bobot,
      penilai,
      bisaDiisiWi: PENILAI_WI.includes(penilai),
    };
  });
}

/** Kode yang dipakai untuk menyimpan nilai remedial satu jenis evaluasi. */
export const kodeRemedial = (jenis: JenisEvaluasi) => `REMEDIAL-${jenis}`;
export function jenisDariKodeRemedial(kode: string): JenisEvaluasi | null {
  const m = /^REMEDIAL-(.+)$/.exec(kode);
  const e = m && EVALUASI.find((x) => x.kode === m[1]);
  return e ? e.kode : null;
}

export const NILAI_REMEDIAL_MAKS = ATURAN.remedial.nilaiMaksSetelahRemedial; // 85

export const bulat2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** "85", "85,5", "85.25" → angka 0–100 (2 desimal); "" → null; selain itu → undefined (tidak sah). */
export function bacaNilai(teks: string | number | null | undefined): number | null | undefined {
  if (teks === null || teks === undefined) return null;
  const s = String(teks).replace(/\u00a0/g, "").trim().replace(",", ".");
  if (s === "") return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : undefined;
}

export const KUALIFIKASI_URUT = ["SANGAT_MEMUASKAN", "MEMUASKAN", "BAIK", "KURANG_BAIK", "TIDAK_MEMENUHI"] as const;
export type Kualifikasi = (typeof KUALIFIKASI_URUT)[number];

export const LABEL_KUALIFIKASI: Record<Kualifikasi, string> = {
  SANGAT_MEMUASKAN: "Sangat memuaskan",
  MEMUASKAN: "Memuaskan",
  BAIK: "Baik",
  KURANG_BAIK: "Kurang baik",
  TIDAK_MEMENUHI: "Tidak memenuhi kualifikasi",
};

/** Batas dari Pedoman: 90,01 / 80,01 / 70,01 / 60,01 (nilai dibulatkan 2 desimal dulu). */
export function kualifikasi(nilai: number): Kualifikasi {
  const n = bulat2(nilai);
  if (n > 90) return "SANGAT_MEMUASKAN";
  if (n > 80) return "MEMUASKAN";
  if (n > 70) return "BAIK";
  if (n > 60) return "KURANG_BAIK";
  return "TIDAK_MEMENUHI";
}
const minimalBaik = (k: Kualifikasi) => KUALIFIKASI_URUT.indexOf(k) <= KUALIFIKASI_URUT.indexOf("BAIK");

export type SumberNilai = "REKAP" | "PENILAI";
export type EntriNilai = { nilai: number; sumber: SumberNilai };

export type NilaiAspek = {
  nilai: number | null;
  /** REKAP = ditetapkan Ketua Diklat; RATA = rata-rata isian penilai; null = belum ada. */
  dari: "REKAP" | "RATA" | null;
  jumlahPenilai: number;
};

/**
 * Nilai satu aspek untuk satu peserta: nilai yang ditetapkan Ketua Diklat
 * (REKAP) didahulukan; kalau tidak ada, rata-rata isian para penilai (mis.
 * beberapa pengampu materi menilai kerja sama peserta yang sama).
 */
export function nilaiAspek(entri: EntriNilai[]): NilaiAspek {
  const penilai = entri.filter((e) => e.sumber === "PENILAI");
  const rekap = entri.filter((e) => e.sumber === "REKAP");
  const rata = (xs: EntriNilai[]) => bulat2(xs.reduce((a, e) => a + e.nilai, 0) / xs.length);
  if (rekap.length) return { nilai: rata(rekap), dari: "REKAP", jumlahPenilai: penilai.length };
  if (penilai.length) return { nilai: rata(penilai), dari: "RATA", jumlahPenilai: penilai.length };
  return { nilai: null, dari: null, jumlahPenilai: 0 };
}

export type RekapEvaluasi = {
  kode: JenisEvaluasi;
  bobot: number;
  jumlahAspek: number;
  terisi: number;
  /** Rata-rata tertimbang aspek (0–100); null kalau belum semua aspek terisi. */
  nilai: number | null;
  /** Nilai remedial (sudah dibatasi), kalau ada dan berlaku. */
  remedial: number | null;
  /** Nilai yang dipakai (remedial kalau berlaku). */
  nilaiDipakai: number | null;
  /** nilaiDipakai × bobot / 100 — isi kolom Formulir 14. */
  kontribusi: number | null;
  kualifikasi: Kualifikasi | null;
  /** Kualifikasi sebelum remedial. */
  kualifikasiAwal: Kualifikasi | null;
};

export type StatusKelulusan = "BELUM_LENGKAP" | "LULUS" | "DITUNDA" | "TIDAK_LULUS";

export const LABEL_KELULUSAN: Record<StatusKelulusan, string> = {
  BELUM_LENGKAP: "Belum lengkap",
  LULUS: "Lulus",
  DITUNDA: "Ditunda kelulusannya",
  TIDAK_LULUS: "Tidak lulus",
};

export type HasilPeserta = {
  evaluasi: RekapEvaluasi[];
  nilaiAkhir: number | null;
  kualifikasi: Kualifikasi | null;
  status: StatusKelulusan;
  /** Status hasil evaluasi akhir pertama (sebelum remedial). */
  statusAwal: StatusKelulusan;
  /** Jenis evaluasi yang perlu/boleh diremedial (kualifikasi awal kurang baik). */
  perluRemedial: JenisEvaluasi[];
  /** Ada evaluasi kurang baik yang tidak bisa diremedial (sikap perilaku) — diputus Tim Evaluasi Akhir. */
  perluKeputusanTim: boolean;
};

/**
 * Hasil satu peserta dari nilai per aspek (`nilai.get(kodeAspek)`) dan nilai
 * remedial per jenis evaluasi. Remedial hanya dipakai bila status awal
 * "ditunda" dan jenis evaluasinya memang kurang baik.
 */
export function hitungHasil(
  aspek: AspekPenilaian[],
  nilai: Map<string, number | null>,
  remedial: Partial<Record<JenisEvaluasi, number | null>> = {},
): HasilPeserta {
  const awal = EVALUASI.filter((e) => aspek.some((a) => a.jenisEvaluasi === e.kode)).map((e) => {
    const isi = aspek.filter((a) => a.jenisEvaluasi === e.kode);
    const bobot = isi.reduce((s, a) => s + a.bobot, 0);
    const ada = isi.filter((a) => typeof nilai.get(a.kode) === "number");
    const lengkap = ada.length === isi.length;
    const n = lengkap && bobot > 0 ? bulat2(isi.reduce((s, a) => s + (nilai.get(a.kode) as number) * a.bobot, 0) / bobot) : null;
    return { kode: e.kode, bobot, jumlahAspek: isi.length, terisi: ada.length, nilai: n, bisaRemedial: e.remedial };
  });

  const kualAwal = awal.map((e) => (e.nilai === null ? null : kualifikasi(e.nilai)));
  const statusDari = (ks: (Kualifikasi | null)[]): StatusKelulusan => {
    if (ks.some((k) => k === null)) return "BELUM_LENGKAP";
    if (ks.some((k) => k === "TIDAK_MEMENUHI")) return "TIDAK_LULUS";
    if (ks.some((k) => k === "KURANG_BAIK")) return "DITUNDA";
    return "LULUS";
  };
  const statusAwal = statusDari(kualAwal);

  const kurang = awal.filter((_, i) => kualAwal[i] === "KURANG_BAIK");
  const perluRemedial = statusAwal === "DITUNDA" ? kurang.filter((e) => e.bisaRemedial).map((e) => e.kode) : [];
  const perluKeputusanTim = statusAwal === "DITUNDA" && kurang.some((e) => !e.bisaRemedial);

  const evaluasi: RekapEvaluasi[] = awal.map((e, i) => {
    const r = perluRemedial.includes(e.kode) ? remedial[e.kode] : null;
    const rem = typeof r === "number" ? Math.min(bulat2(r), NILAI_REMEDIAL_MAKS) : null;
    const dipakai = rem ?? e.nilai;
    return {
      kode: e.kode,
      bobot: e.bobot,
      jumlahAspek: e.jumlahAspek,
      terisi: e.terisi,
      nilai: e.nilai,
      remedial: rem,
      nilaiDipakai: dipakai,
      kontribusi: dipakai === null ? null : bulat2((dipakai * e.bobot) / 100),
      kualifikasi: dipakai === null ? null : kualifikasi(dipakai),
      kualifikasiAwal: kualAwal[i],
    };
  });

  let status = statusAwal;
  const sudahRemedial = perluRemedial.length > 0 && perluRemedial.every((k) => evaluasi.find((e) => e.kode === k)?.remedial !== null);
  if (statusAwal === "DITUNDA" && sudahRemedial && !perluKeputusanTim) {
    status = evaluasi.every((e) => e.kualifikasi !== null && minimalBaik(e.kualifikasi)) ? "LULUS" : "TIDAK_LULUS";
  }

  // Formulir 14: nilai akhir = jumlah kolom (kontribusi yang sudah dibulatkan),
  // supaya angka yang dicetak selalu bisa dijumlah ulang.
  let nilaiAkhir: number | null = null;
  if (evaluasi.every((e) => e.kontribusi !== null)) {
    nilaiAkhir = bulat2(evaluasi.reduce((s, e) => s + (e.kontribusi as number), 0));
    if (evaluasi.some((e) => e.remedial !== null)) nilaiAkhir = Math.min(nilaiAkhir, NILAI_REMEDIAL_MAKS);
  }

  return {
    evaluasi,
    nilaiAkhir,
    kualifikasi: nilaiAkhir === null ? null : kualifikasi(nilaiAkhir),
    status,
    statusAwal,
    perluRemedial,
    perluKeputusanTim,
  };
}

/**
 * Peringkat peserta LULUS menurut nilai akhir (tertinggi = 1). Nilai sama
 * mendapat peringkat sama (1, 2, 2, 4). Yang lain tidak diberi peringkat.
 */
export function peringkat(hasil: { id: string; nilaiAkhir: number | null; status: StatusKelulusan }[]): Map<string, number> {
  const lulus = hasil
    .filter((h) => h.status === "LULUS" && h.nilaiAkhir !== null)
    .sort((a, b) => (b.nilaiAkhir as number) - (a.nilaiAkhir as number));
  const out = new Map<string, number>();
  lulus.forEach((h, i) => {
    const sebelum = lulus[i - 1];
    out.set(h.id, sebelum && sebelum.nilaiAkhir === h.nilaiAkhir ? (out.get(sebelum.id) as number) : i + 1);
  });
  return out;
}

export const JUMLAH_TERBAIK = ATURAN.jumlahPeringkatTerbaik; // PKA & PKP: 3

/** Angka gaya Indonesia, 2 desimal: 85.5 → "85,50". */
export const formatNilai = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
