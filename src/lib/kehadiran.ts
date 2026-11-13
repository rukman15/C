/**
 * Aturan kehadiran peserta — MURNI (tanpa database), dipakai server dan halaman.
 *
 * Dasar: Pedoman (KepKa LAN No. 2/K.1/PDP.07/2023) BAB IV.B — peserta
 * diberhentikan bila tidak hadir akumulatif 27 JP atau 3 hari pelatihan; berlaku
 * pada sesi SINKRON dan KLASIKAL. Pengecualian (tugas dinas yang tidak bisa
 * diwakilkan, force majeure paling lama 6 hari) perlu persetujuan tertulis dan
 * dicatat di sini sebagai "DISPENSASI": tidak menambah hitungan tidak hadir.
 *
 * Aplikasi hanya MENGHITUNG dan MENANDAI. Keputusan memberhentikan tetap di
 * penyelenggara (status peserta diubah manual).
 */
import { ATURAN, isKodeJenis } from "@/lib/kurikulum";
import { akhirPekanIso, tambahHariIso } from "@/lib/tanggal";

export const STATUS_KEHADIRAN = ["HADIR", "TIDAK_HADIR", "DISPENSASI"] as const;
export type StatusKehadiran = (typeof STATUS_KEHADIRAN)[number];

export const LABEL_KEHADIRAN: Record<StatusKehadiran, string> = {
  HADIR: "Hadir",
  TIDAK_HADIR: "Tidak hadir",
  DISPENSASI: "Dispensasi",
};

export function isStatusKehadiran(v: unknown): v is StatusKehadiran {
  return typeof v === "string" && (STATUS_KEHADIRAN as readonly string[]).includes(v);
}

/**
 * Bentuk sesi pembelajaran. `wajibHadir` = kehadirannya dicatat dan dihitung.
 * Studi lapangan ikut dihitung karena di kurikulum ia bagian dari Pembelajaran
 * Klasikal Tahap I (bukan tahap tersendiri).
 */
export const BENTUK_SESI = [
  { value: "KLASIKAL", label: "Klasikal", wajibHadir: true },
  { value: "SINKRON", label: "E-learning sinkron", wajibHadir: true },
  { value: "LAPANGAN", label: "Studi lapangan", wajibHadir: true },
  { value: "ASINKRON", label: "E-learning asinkron", wajibHadir: false },
  { value: "MANDIRI", label: "Mandiri", wajibHadir: false },
] as const;
export type BentukSesi = (typeof BENTUK_SESI)[number]["value"];

export function isBentukSesi(v: unknown): v is BentukSesi {
  return typeof v === "string" && BENTUK_SESI.some((b) => b.value === v);
}
export function labelBentuk(bentuk: string): string {
  return BENTUK_SESI.find((b) => b.value === bentuk)?.label ?? bentuk;
}
export function wajibHadir(bentuk: string): boolean {
  return BENTUK_SESI.find((b) => b.value === bentuk)?.wajibHadir ?? true;
}

export type AturanKehadiran = { maksJp: number; maksHari: number; maksHariDispensasi: number };

/** Batas ketidakhadiran menurut Pedoman — hanya untuk program berkurikulum (PKP/PKA). */
export function aturanKehadiran(jenisPelatihan: string | null | undefined): AturanKehadiran | null {
  if (!isKodeJenis(jenisPelatihan)) return null;
  return {
    maksJp: ATURAN.ketidakhadiranMaksJp,
    maksHari: ATURAN.ketidakhadiranMaksHari,
    maksHariDispensasi: ATURAN.forceMajeureMaksHari,
  };
}

export type SesiRingkas = { id: string; tanggal: string; jp: number; bentuk: string };

export type TingkatKehadiran = "aman" | "peringatan" | "batas";

export type RekapKehadiran = {
  /** JP sesi wajib hadir yang kehadirannya sudah dicatat untuk peserta ini. */
  jpDicatat: number;
  jpHadir: number;
  jpTidakHadir: number;
  /** Hari yang SEMUA sesi wajib hadirnya tercatat tidak hadir. */
  hariTidakHadir: number;
  jpDispensasi: number;
  /** Hari yang memuat sedikitnya satu sesi berdispensasi. */
  hariDispensasi: number;
  /** Sesi wajib hadir yang belum punya catatan untuk peserta ini. */
  sesiBelumDicatat: number;
  tingkat: TingkatKehadiran;
  /** true kalau hari dispensasi sudah melewati batas (6 hari). */
  dispensasiMelebihi: boolean;
};

/**
 * Rekap kehadiran SATU peserta.
 *
 * `tingkat` (hanya kalau ada `aturan`):
 *   - "batas"      : tidak hadir >= 27 JP ATAU >= 3 hari penuh — menurut Pedoman diberhentikan;
 *   - "peringatan" : sudah 2/3 batas JP (18 JP) atau tinggal satu hari lagi (2 hari);
 *   - "aman"       : selain itu, dan selalu untuk diklat tanpa aturan.
 */
export function rekapKehadiran(
  sesi: SesiRingkas[],
  catatan: { sesiId: string; status: string }[],
  aturan: AturanKehadiran | null = null,
): RekapKehadiran {
  const status = new Map<string, string>();
  for (const c of catatan) status.set(c.sesiId, c.status);

  let jpDicatat = 0;
  let jpHadir = 0;
  let jpTidakHadir = 0;
  let jpDispensasi = 0;
  let sesiBelumDicatat = 0;
  // per tanggal: banyaknya sesi wajib hadir, dan berapa yang tidak hadir / dispensasi
  const perHari = new Map<string, { sesi: number; tidakHadir: number; dispensasi: number }>();

  for (const s of sesi) {
    if (!wajibHadir(s.bentuk)) continue;
    const hari = perHari.get(s.tanggal) ?? { sesi: 0, tidakHadir: 0, dispensasi: 0 };
    hari.sesi++;
    const st = status.get(s.id);
    if (st === "HADIR") {
      jpDicatat += s.jp;
      jpHadir += s.jp;
    } else if (st === "TIDAK_HADIR") {
      jpDicatat += s.jp;
      jpTidakHadir += s.jp;
      hari.tidakHadir++;
    } else if (st === "DISPENSASI") {
      jpDicatat += s.jp;
      jpDispensasi += s.jp;
      hari.dispensasi++;
    } else {
      sesiBelumDicatat++;
    }
    perHari.set(s.tanggal, hari);
  }

  let hariTidakHadir = 0;
  let hariDispensasi = 0;
  for (const h of perHari.values()) {
    if (h.tidakHadir > 0 && h.tidakHadir === h.sesi) hariTidakHadir++;
    if (h.dispensasi > 0) hariDispensasi++;
  }

  let tingkat: TingkatKehadiran = "aman";
  if (aturan) {
    if (jpTidakHadir >= aturan.maksJp || hariTidakHadir >= aturan.maksHari) tingkat = "batas";
    else if (jpTidakHadir * 3 >= aturan.maksJp * 2 || hariTidakHadir >= aturan.maksHari - 1) tingkat = "peringatan";
  }

  return {
    jpDicatat,
    jpHadir,
    jpTidakHadir,
    hariTidakHadir,
    jpDispensasi,
    hariDispensasi,
    sesiBelumDicatat,
    tingkat,
    dispensasiMelebihi: !!aturan && hariDispensasi > aturan.maksHariDispensasi,
  };
}

/** "08:00" / "8.30" -> "08:00" / "08:30"; null kalau bukan jam yang sah. */
export function rapikanJam(teks: string | null | undefined): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec((teks ?? "").trim());
  if (!m) return null;
  const jam = Number(m[1]);
  const menit = Number(m[2]);
  if (jam > 23 || menit > 59) return null;
  return `${String(jam).padStart(2, "0")}:${m[2]}`;
}

/**
 * Pemeriksaan presensi HARIAN (keputusan 14 Okt 2026, CATATAN-KEPUTUSAN-14OKT.md C.13–14):
 * tiap hari pelatihan dari tanggal mulai sampai selesai harus punya presensi, termasuk hari
 * asinkron/mandiri. Presensi asinkron/mandiri hanya dicatat — tidak masuk hitungan batas
 * ketidakhadiran (`rekapKehadiran` tetap hanya menghitung sesi wajib hadir).
 *
 * Hanya hari yang sudah lewat atau hari ini yang diperiksa. `tercatat` = banyaknya peserta
 * yang sudah punya catatan pada sesi itu. Hasil:
 *   - tanpaSesi    : hari yang belum punya sesi sama sekali (tidak ada tempat mencatat presensi);
 *   - belumLengkap : hari yang punya sesi, tetapi ada sesi yang catatannya kurang dari jumlah
 *                    peserta aktif.
 */
export function periksaPresensiHarian(o: {
  mulai: string;
  selesai: string | null;
  hariIni: string;
  sesi: { tanggal: string; tercatat: number }[];
  pesertaAktif: number;
  lewatiAkhirPekan?: boolean;
  /** Rentang tanggal yang tidak diperiksa (inklusif), mis. masa di tempat kerja peserta. */
  kecuali?: { mulai: string; selesai: string }[];
}): { tanpaSesi: string[]; belumLengkap: string[] } {
  const akhir = [o.selesai ?? o.mulai, o.hariIni].sort()[0];
  const perHari = new Map<string, { tercatat: number }[]>();
  for (const s of o.sesi) perHari.set(s.tanggal, [...(perHari.get(s.tanggal) ?? []), s]);
  const tanpaSesi: string[] = [];
  const belumLengkap: string[] = [];
  for (let t = o.mulai; t <= akhir; t = tambahHariIso(t, 1)) {
    if (o.lewatiAkhirPekan && akhirPekanIso(t)) continue;
    if (o.kecuali?.some((r) => t >= r.mulai && t <= r.selesai)) continue;
    const sesi = perHari.get(t);
    if (!sesi?.length) tanpaSesi.push(t);
    else if (o.pesertaAktif > 0 && sesi.some((s) => s.tercatat < o.pesertaAktif)) belumLengkap.push(t);
  }
  return { tanpaSesi, belumLengkap };
}

/**
 * Masa peserta berada di tempat kerja asal (keputusan 16 Okt 2026): komitmen bersama dan
 * aktualisasi kepemimpinan. Hari dalam masa ini tidak diperiksa "tanpa sesi" — presensinya
 * tidak dicatat harian di balai. Tanggalnya diisi penyelenggara per jadwal.
 */
export const JENIS_MASA_TEMPAT_KERJA = [
  { value: "KOMITMEN_BERSAMA", label: "Pembangunan komitmen bersama" },
  { value: "AKTUALISASI", label: "Aktualisasi kepemimpinan" },
  { value: "LAINNYA", label: "Lainnya (di luar balai)" },
] as const;
export type JenisMasaTempatKerja = (typeof JENIS_MASA_TEMPAT_KERJA)[number]["value"];
export const isJenisMasaTempatKerja = (v: unknown): v is JenisMasaTempatKerja =>
  typeof v === "string" && JENIS_MASA_TEMPAT_KERJA.some((j) => j.value === v);
export const labelMasaTempatKerja = (v: string) => JENIS_MASA_TEMPAT_KERJA.find((j) => j.value === v)?.label ?? v;
