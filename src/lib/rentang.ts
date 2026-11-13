/**
 * Rentang tanggal dan bentrok jadwal pegawai. Disalin dari aplikasi lama (src/lib/persuratan.ts dan
 * src/lib/dokumen.ts): hanya bagian yang dipakai saat menetapkan pengampu.
 */
import { isTanggalIso, tambahHariIso } from "@/lib/tanggal";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function pecah(iso: string) {
  const [y, b, t] = iso.slice(0, 10).split("-").map(Number);
  return { y, b, t };
}

/** "2026-08-27" -> "27 Agustus 2026". */
export function tanggalPanjang(iso: string): string {
  const { y, b, t } = pecah(iso);
  return `${t} ${BULAN[b - 1]} ${y}`;
}

/** "27 s.d. 28 Agustus 2026", "30 September s.d. 2 Oktober 2026", satu hari: "27 Agustus 2026". */
export function periodeSurat(mulai: string, selesai?: string | null): string {
  const a = pecah(mulai);
  if (!selesai || selesai.slice(0, 10) === mulai.slice(0, 10)) return tanggalPanjang(mulai);
  const z = pecah(selesai);
  if (a.y !== z.y) return `${tanggalPanjang(mulai)} s.d. ${tanggalPanjang(selesai)}`;
  if (a.b !== z.b) return `${a.t} ${BULAN[a.b - 1]} s.d. ${tanggalPanjang(selesai)}`;
  return `${a.t} s.d. ${tanggalPanjang(selesai)}`;
}

export type RentangTanggal = { mulai: string; selesai: string };

/** Rapikan daftar rentang: hanya tanggal sah, mulai ≤ selesai, urut, yang beririsan/bersambung digabung. */
export function rapikanRentang(v: unknown): RentangTanggal[] {
  const isi = Array.isArray(v) ? v : [];
  const sah = isi
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ mulai: String(x.mulai ?? "").slice(0, 10), selesai: String(x.selesai ?? x.mulai ?? "").slice(0, 10) }))
    .filter((r) => isTanggalIso(r.mulai) && isTanggalIso(r.selesai) && r.mulai <= r.selesai)
    .sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0))
    .slice(0, 60);
  const out: RentangTanggal[] = [];
  for (const r of sah) {
    const akhir = out[out.length - 1];
    if (akhir && r.mulai <= tambahHariIso(akhir.selesai, 1)) {
      if (r.selesai > akhir.selesai) akhir.selesai = r.selesai;
    } else out.push({ ...r });
  }
  return out;
}

/** Semua tanggal dalam daftar rentang, urut tanpa ganda. */
export function daftarHari(rentang: RentangTanggal[]): string[] {
  const s = new Set<string>();
  for (const r of rapikanRentang(rentang)) for (let d = r.mulai; d <= r.selesai; d = tambahHariIso(d, 1)) s.add(d);
  return [...s].sort();
}

/** Tanggal yang sama-sama ada di dua daftar rentang. */
export function irisanHari(a: RentangTanggal[], b: RentangTanggal[]): string[] {
  const hb = new Set(daftarHari(b));
  return daftarHari(a).filter((d) => hb.has(d));
}

// Kalimat tanggal selalu di akhir butir: "…, [selama N (…) hari] pada tanggal … s.d. …[.;]".
const POLA_KALIMAT_TANGGAL = /,?\s*(selama\s+\d+\s*\([^)]*\)\s*hari\s*)?pada tanggal\s.*?(?=[.;]?\s*$)/i;
export const tanpaKalimatTanggal = (teks: string) => teks.replace(POLA_KALIMAT_TANGGAL, "").replace(/[.;]\s*$/, "").trim();

export type TingkatBentrok = "cegah" | "peringatan";
export type BentrokItem = { jenis: "surat-tugas" | "cuti" | "penugasan-wi"; keterangan: string; tanggal: string[]; tingkat: TingkatBentrok };

/**
 * Sesi mengajar mewajibkan hadir fisik? Dari bentuk sesi (klasikal & studi lapangan = fisik), atau bila
 * bentuknya tidak diketahui, dari teks tempat/kegiatan: fisik kecuali menyebut daring/Zoom.
 */
export function hariAjarFisik(bentuk: string | null, teks: string | null): boolean {
  if (bentuk) return bentuk === "KLASIKAL" || bentuk === "LAPANGAN";
  return !/daring|zoom|online|e-?learning|virtual|google meet|webinar/i.test(teks ?? "");
}

/** Pesan galat untuk bentrok yang mencegah (dipakai server). */
export function pesanBentrok(nama: (id: string) => string, peta: Record<string, BentrokItem[]>): string | null {
  const baris = Object.entries(peta).flatMap(([id, xs]) =>
    xs.filter((x) => x.tingkat === "cegah").map((x) => `${nama(id)}: ${x.keterangan} (${x.tanggal.map(tanggalPanjang).join(", ")})`),
  );
  return baris.length ? `Bentrok jadwal — ${baris.join("; ")}` : null;
}

const JENIS_CUTI: Record<string, string> = {
  TAHUNAN: "Cuti Tahunan",
  SAKIT: "Cuti Sakit",
  ALASAN_PENTING: "Cuti Karena Alasan Penting",
  BESAR: "Cuti Besar",
  MELAHIRKAN: "Cuti Melahirkan",
  LUAR_TANGGUNGAN: "Cuti di Luar Tanggungan Negara",
};
export const labelJenisCuti = (k: string) => JENIS_CUTI[k] ?? k;
