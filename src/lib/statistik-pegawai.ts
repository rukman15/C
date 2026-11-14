import { awalHariWib } from "./tanggal";

/**
 * Statistik kepegawaian untuk halaman Data Pegawai. Dihitung di peramban dari
 * daftar yang sudah dimuat. Isian data pegawai asli tidak seragam ("L",
 * "LAKI-LAKI", "S-2", "SMA/SEDERAJAT", golongan PPPK "IX", …) jadi dirapikan
 * di sini. Setiap pegawai diberi satu label per DIMENSI (`kunciPegawai`);
 * label yang sama dipakai untuk menghitung grafik dan menyaring tabel, jadi
 * angka di grafik selalu sama dengan jumlah baris hasil saringan.
 */

export type DataStatistik = {
  nip?: string | null;
  jenisKelamin?: string | null;
  tanggalLahir?: string | null;
  tingkatPendidikan?: string | null;
  jenisKepegawaian?: string | null;
  golRuang?: string | null;
  jabatan?: string | null;
  jenisJabatan?: string | null;
  kelasJabatan?: number | null;
  status?: string | null;
};

export type Kelompok = { label: string; jumlah: number; persen: number };

export const TIDAK_DIKETAHUI = "Tidak diketahui";
/** Label untuk pegawai yang tidak termasuk dimensi itu (mis. jabatan fungsional bagi pelaksana). */
export const TIDAK_BERLAKU = "-";

export function pegawaiAktif(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "" || s === "AKTIF";
}

export function labelJenisKelamin(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase().replace(/[\s_]+/g, "-");
  if (["L", "LK", "LAKI-LAKI", "LAKI", "PRIA", "MALE"].includes(s)) return "Laki-laki";
  if (["P", "PR", "PEREMPUAN", "WANITA", "FEMALE"].includes(s)) return "Perempuan";
  return TIDAK_DIKETAHUI;
}

/** Tanggal lahir dari NIP ASN/PPPK (8 digit awal = TTTTBBHH); null kalau bukan NIP 18 digit yang masuk akal. */
export function tanggalLahirDariNip(nip: string | null | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})\d{10}$/.exec((nip ?? "").replace(/\D/g, ""));
  if (!m) return null;
  const [bl, tg] = [Number(m[2]), Number(m[3])];
  return bl >= 1 && bl <= 12 && tg >= 1 && tg <= 31 ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Tanggal lahir "YYYY-MM-DD": isian tanggal lahir, kalau kosong dari NIP. */
export function tanggalLahir(p: Pick<DataStatistik, "tanggalLahir" | "nip">): string | null {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(p.tanggalLahir ?? "");
  return m ? m[0] : tanggalLahirDariNip(p.nip);
}

/**
 * Usia dalam tahun penuh pada hari ini (WIB); null kalau tanggal lahir kosong/tidak masuk akal.
 * Kalau tanggal lahir kosong, dipakai tanggal lahir dari NIP.
 */
export function hitungUsia(tanggal: string | null | undefined, now: Date = new Date(), nip?: string | null): number | null {
  const lahir = tanggalLahir({ tanggalLahir: tanggal, nip });
  if (!lahir) return null;
  const hari = awalHariWib(now);
  const [th, bl, tg] = lahir.split("-").map(Number);
  let usia = hari.getUTCFullYear() - th;
  const blIni = hari.getUTCMonth() + 1;
  if (blIni < bl || (blIni === bl && hari.getUTCDate() < tg)) usia--;
  return usia >= 15 && usia <= 100 ? usia : null;
}

export const KELOMPOK_USIA = ["< 30", "30–39", "40–49", "50–54", "55–59", "≥ 60"] as const;

export function kelompokUsia(usia: number | null): string {
  if (usia === null) return TIDAK_DIKETAHUI;
  if (usia < 30) return "< 30";
  if (usia < 40) return "30–39";
  if (usia < 50) return "40–49";
  if (usia < 55) return "50–54";
  if (usia < 60) return "55–59";
  return "≥ 60";
}

export const URUTAN_PENDIDIKAN = ["S3", "S2", "Profesi", "S1", "D4", "D3", "D2", "D1", "SLTA", "SLTP", "SD", "Lainnya"] as const;

export function labelPendidikan(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase().replace(/[\s.\-/]+/g, "");
  if (!s) return TIDAK_DIKETAHUI;
  if (/^(S3|STRATA3|STRATAIII|DOKTOR)/.test(s)) return "S3";
  if (/^(S2|STRATA2|STRATAII|MAGISTER|PASCASARJANA)/.test(s)) return "S2";
  if (/^PROFESI/.test(s)) return "Profesi";
  if (/^(S1|STRATA1|STRATAI|SARJANA)/.test(s)) return "S1";
  if (/^(D4|DIV|DIPLOMA4|DIPLOMAIV)/.test(s)) return "D4";
  if (/^(D3|DIII|DIPLOMA3|DIPLOMAIII)/.test(s)) return "D3";
  if (/^(D2|DII|DIPLOMA2|DIPLOMAII)/.test(s)) return "D2";
  if (/^(D1|DI|DIPLOMA1|DIPLOMAI)$/.test(s)) return "D1";
  if (/^(SLTA|SMA|SMK|SMU|STM|SMEA|MA|SPG)/.test(s)) return "SLTA";
  if (/^(SLTP|SMP|MTS)/.test(s)) return "SLTP";
  if (/^(SD|MI)$/.test(s)) return "SD";
  return "Lainnya";
}

export const URUTAN_KEPEGAWAIAN = ["PNS", "CPNS", "PPPK", "PPPK Paruh Waktu", "Outsourcing", "Non-ASN"] as const;

export function labelJenisKepegawaian(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase();
  if (!s) return TIDAK_DIKETAHUI;
  if (s.includes("PPPK") || s.includes("P3K")) return s.includes("PARUH") ? "PPPK Paruh Waktu" : "PPPK";
  if (s.includes("CPNS")) return "CPNS";
  if (s.includes("PNS")) return "PNS";
  if (s.includes("OUTSOURC") || s.includes("ALIH DAYA")) return "Outsourcing";
  if (s.includes("HONOR") || s.includes("NON")) return "Non-ASN";
  return s.length <= 20 ? s : "Lainnya";
}

/** Bukan ASN (outsourcing/honorer): tidak punya batas usia pensiun ASN. */
function bukanAsn(jenisKepegawaian: string | null | undefined): boolean {
  const l = labelJenisKepegawaian(jenisKepegawaian);
  return l === "Outsourcing" || l === "Non-ASN";
}

const ROMAWI: Record<string, number> = { I: 1, V: 5, X: 10 };
function romawi(s: string): number | null {
  if (!/^[IVX]+$/.test(s)) return null;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const a = ROMAWI[s[i]];
    const b = ROMAWI[s[i + 1]] ?? 0;
    n += a < b ? -a : a;
  }
  return n;
}

/** PNS "III/a" → "Gol. III"; PPPK "IX"/"9" → "PPPK IX"; kosong → Tidak diketahui. */
export function labelGolongan(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase();
  if (!s || s === "-") return TIDAK_DIKETAHUI;
  const m = /^(IV|III|II|I)\s*\/\s*[A-E]$/.exec(s);
  if (m) return `Gol. ${m[1]}`;
  if (romawi(s) !== null) return `PPPK ${s}`;
  if (/^\d{1,2}$/.test(s)) return `PPPK ${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII"][Number(s)] ?? s}`;
  return "Lainnya";
}
function urutGolongan(l: string): number {
  const m = /^Gol\. (\w+)$/.exec(l);
  if (m) return 100 - (romawi(m[1]) ?? 0); // PNS dulu, IV → I
  const p = /^PPPK (\w+)$/.exec(l);
  if (p) return 200 - (romawi(p[1]) ?? 0); // lalu PPPK, XVII → I
  return 1e9;
}

export function labelJenisJabatan(v: string | null | undefined): string {
  const s = (v ?? "").trim().toUpperCase();
  if (!s) return TIDAK_DIKETAHUI;
  if (s === "JFT" || s === "JFU" || s.includes("FUNGSIONAL")) return s === "JFU" ? "Pelaksana" : "Fungsional";
  if (s.includes("PELAKSANA")) return "Pelaksana";
  if (s.includes("STRUKTURAL") || s.includes("JPT") || s.includes("ADMINISTRATOR") || s.includes("PENGAWAS")) return "Struktural";
  return "Lainnya";
}

const JENJANG_JF = /\s+(AHLI\s+(UTAMA|MADYA|MUDA|PERTAMA)|TERAMPIL|MAHIR|PENYELIA|PEMULA)\s*$/;
const TETAP_KAPITAL = new Set(["SDM", "ASN", "TU", "PIPK", "II", "III", "IV", "IT", "TIK"]);

function judulKata(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (TETAP_KAPITAL.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\/\s*(\w)/g, (_, c: string) => `/ ${c.toUpperCase()}`);
}

/** "ANALIS SDM APARATUR AHLI MUDA" → "Analis SDM Aparatur"; bukan jabatan fungsional → TIDAK_BERLAKU. */
export function labelJabatanFungsional(jabatan: string | null | undefined, jenisJabatan?: string | null): string {
  const s = (jabatan ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const jf = labelJenisJabatan(jenisJabatan) === "Fungsional" || JENJANG_JF.test(s);
  if (!jf) return TIDAK_BERLAKU;
  const nama = s.replace(JENJANG_JF, "").trim();
  return nama ? judulKata(nama) : TIDAK_DIKETAHUI;
}

export function labelKelasJabatan(v: number | null | undefined): string {
  return typeof v === "number" && v >= 1 && v <= 17 ? `Kelas ${v}` : TIDAK_DIKETAHUI;
}

/**
 * Batas usia pensiun (PP 11/2017 jo. PP 17/2020; PPPK mengikuti BUP jabatannya):
 * 65 JF ahli utama; 60 JF ahli madya dan pimpinan tinggi; 58 lainnya
 * (administrator, pengawas, pelaksana, JF ahli muda/pertama, keterampilan).
 * null untuk non-ASN.
 */
export function batasUsiaPensiun(p: Pick<DataStatistik, "jabatan" | "jenisJabatan" | "kelasJabatan" | "jenisKepegawaian">): number | null {
  if (bukanAsn(p.jenisKepegawaian)) return null;
  const j = (p.jabatan ?? "").toUpperCase().replace(/\s+/g, " ");
  if (/AHLI UTAMA/.test(j)) return 65;
  if (/AHLI MADYA/.test(j)) return 60;
  const pimpinanTinggi =
    labelJenisJabatan(p.jenisJabatan) === "Struktural" &&
    (/^KEPALA (BALAI BESAR|BADAN|PUSAT)|^(SEKRETARIS|DIREKTUR|DEPUTI|INSPEKTUR)/.test(j) || (p.kelasJabatan ?? 0) >= 14);
  return pimpinanTinggi ? 60 : 58;
}

/** TMT pensiun "YYYY-MM-01": hari pertama bulan berikutnya setelah mencapai BUP. */
export function tmtPensiun(lahir: string | null, bup: number | null): string | null {
  if (!lahir || bup === null) return null;
  const [th, bl] = lahir.split("-").map(Number);
  const tahun = bl === 12 ? th + bup + 1 : th + bup;
  const bulan = bl === 12 ? 1 : bl + 1;
  return `${tahun}-${String(bulan).padStart(2, "0")}-01`;
}

/** Berapa tahun ke depan proyeksi pensiun ditampilkan (tahun ini + N). */
export const RENTANG_PENSIUN = 5;
export const LEWAT_BUP = "Lewat BUP";
export const PENSIUN_NANTI = "Lebih lama";

export function labelPensiun(tmt: string | null, now: Date = new Date()): string {
  if (!tmt) return TIDAK_DIKETAHUI;
  const hari = awalHariWib(now);
  if (tmt <= hari.toISOString().slice(0, 10)) return LEWAT_BUP;
  const th = Number(tmt.slice(0, 4));
  return th <= hari.getUTCFullYear() + RENTANG_PENSIUN ? String(th) : PENSIUN_NANTI;
}

export const DIMENSI = [
  "jenisKelamin",
  "usia",
  "pensiun",
  "jenisJabatan",
  "jabatanFungsional",
  "pendidikan",
  "golongan",
  "kelasJabatan",
  "jenisKepegawaian",
] as const;
export type Dimensi = (typeof DIMENSI)[number];

export const NAMA_DIMENSI: Record<Dimensi, string> = {
  jenisKelamin: "Jenis kelamin",
  usia: "Usia",
  pensiun: "Pensiun",
  jenisJabatan: "Jenis jabatan",
  jabatanFungsional: "Jabatan fungsional",
  pendidikan: "Pendidikan",
  golongan: "Golongan",
  kelasJabatan: "Kelas jabatan",
  jenisKepegawaian: "Jenis kepegawaian",
};

export type KunciPegawai = Record<Dimensi, string> & { umur: number | null; tmtPensiun: string | null; bup: number | null };

export function kunciPegawai(p: DataStatistik, now: Date = new Date()): KunciPegawai {
  const umur = hitungUsia(p.tanggalLahir, now, p.nip);
  const bup = batasUsiaPensiun(p);
  const tmt = tmtPensiun(tanggalLahir(p), bup);
  return {
    umur,
    bup,
    tmtPensiun: tmt,
    jenisKelamin: labelJenisKelamin(p.jenisKelamin),
    usia: kelompokUsia(umur),
    pensiun: labelPensiun(tmt, now),
    jenisJabatan: labelJenisJabatan(p.jenisJabatan),
    jabatanFungsional: labelJabatanFungsional(p.jabatan, p.jenisJabatan),
    pendidikan: labelPendidikan(p.tingkatPendidikan),
    golongan: labelGolongan(p.golRuang),
    kelasJabatan: labelKelasJabatan(p.kelasJabatan),
    jenisKepegawaian: labelJenisKepegawaian(p.jenisKepegawaian),
  };
}

export type Saringan = Partial<Record<Dimensi, string>>;

export function cocokSaringan(k: KunciPegawai, s: Saringan): boolean {
  return DIMENSI.every((d) => s[d] === undefined || k[d] === s[d]);
}

function hitung(nilai: string[], urutan: (l: string) => number): Kelompok[] {
  const peta = new Map<string, number>();
  for (const v of nilai) peta.set(v, (peta.get(v) ?? 0) + 1);
  const total = nilai.length;
  const posisi = (l: string) => (l === TIDAK_DIKETAHUI ? 2e9 : urutan(l));
  return [...peta.entries()]
    .map(([label, jumlah]) => ({ label, jumlah, persen: total ? Math.round((jumlah / total) * 1000) / 10 : 0 }))
    .sort((a, b) => posisi(a.label) - posisi(b.label) || b.jumlah - a.jumlah || a.label.localeCompare(b.label));
}
const menurut = (urutan: readonly string[]) => (l: string) => {
  const i = urutan.indexOf(l);
  return i === -1 ? 1e9 : i;
};

export type BarisPiramida = { label: string; laki: number; perempuan: number };

export type StatistikPegawai = {
  total: number;
  lakiLaki: number;
  perempuan: number;
  rataUsia: number | null;
  jenisKelamin: Kelompok[];
  usia: Kelompok[];
  piramida: BarisPiramida[];
  /** Tahun ini s.d. +RENTANG_PENSIUN (selalu lengkap, 0 pun tampil); didahului "Lewat BUP" kalau ada. */
  pensiun: Kelompok[];
  pensiunNanti: number;
  pensiunTakTerhitung: number;
  jenisJabatan: Kelompok[];
  /** Persen terhadap jumlah pejabat fungsional, bukan seluruh pegawai. */
  jabatanFungsional: Kelompok[];
  pendidikan: Kelompok[];
  golongan: Kelompok[];
  kelasJabatan: Kelompok[];
  jenisKepegawaian: Kelompok[];
};

export function statistikPegawai(list: DataStatistik[], now: Date = new Date()): StatistikPegawai {
  const kunci = list.map((p) => kunciPegawai(p, now));
  const ambil = (d: Dimensi) => kunci.map((k) => k[d]);
  const umur = kunci.map((k) => k.umur).filter((u): u is number => u !== null);
  const tahunIni = awalHariWib(now).getUTCFullYear();

  const tahunPensiun = Array.from({ length: RENTANG_PENSIUN + 1 }, (_, i) => String(tahunIni + i));
  const pensiunSemua = hitung(ambil("pensiun"), menurut([LEWAT_BUP, ...tahunPensiun]));
  const jmlPensiun = (l: string) => pensiunSemua.find((k) => k.label === l)?.jumlah ?? 0;
  const pensiun = [...(jmlPensiun(LEWAT_BUP) ? [LEWAT_BUP] : []), ...tahunPensiun].map((label) => {
    const jumlah = jmlPensiun(label);
    return { label, jumlah, persen: list.length ? Math.round((jumlah / list.length) * 1000) / 10 : 0 };
  });

  const usiaUrut = [...KELOMPOK_USIA, TIDAK_DIKETAHUI];
  const piramida = usiaUrut
    .map((label) => ({
      label,
      laki: kunci.filter((k) => k.usia === label && k.jenisKelamin === "Laki-laki").length,
      perempuan: kunci.filter((k) => k.usia === label && k.jenisKelamin === "Perempuan").length,
    }))
    .filter((b) => b.laki + b.perempuan > 0);

  const kelas = (l: string) => 100 - Number(l.replace("Kelas ", "") || 0);

  return {
    total: list.length,
    lakiLaki: kunci.filter((k) => k.jenisKelamin === "Laki-laki").length,
    perempuan: kunci.filter((k) => k.jenisKelamin === "Perempuan").length,
    rataUsia: umur.length ? Math.round((umur.reduce((a, b) => a + b, 0) / umur.length) * 10) / 10 : null,
    jenisKelamin: hitung(ambil("jenisKelamin"), menurut(["Laki-laki", "Perempuan"])),
    usia: hitung(ambil("usia"), menurut(KELOMPOK_USIA)),
    piramida,
    pensiun,
    pensiunNanti: jmlPensiun(PENSIUN_NANTI),
    pensiunTakTerhitung: jmlPensiun(TIDAK_DIKETAHUI),
    jenisJabatan: hitung(ambil("jenisJabatan"), menurut(["Struktural", "Fungsional", "Pelaksana", "Lainnya"])),
    jabatanFungsional: hitung(ambil("jabatanFungsional").filter((l) => l !== TIDAK_BERLAKU), () => 0),
    pendidikan: hitung(ambil("pendidikan"), menurut(URUTAN_PENDIDIKAN)),
    golongan: hitung(ambil("golongan"), urutGolongan),
    kelasJabatan: hitung(ambil("kelasJabatan"), kelas),
    jenisKepegawaian: hitung(ambil("jenisKepegawaian"), menurut(URUTAN_KEPEGAWAIAN)),
  };
}
