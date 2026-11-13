/**
 * Studi lapangan (EB-049, EB-050, EB-053): status lokasi, pencocokan lokasi ke kelompok stula, dan peringatan H-7.
 * Logika murni, diuji di uji/stula.test.ts.
 */
import { labelKategori } from "@/lib/kelompok";
import { tambahHariIso } from "@/lib/tanggal";

export const STATUS_LOKASI = [
  { kode: "CALON", label: "Calon" },
  { kode: "LAYAK", label: "Layak" },
  { kode: "TIDAK_LAYAK", label: "Tidak layak" },
] as const;
export type StatusLokasi = (typeof STATUS_LOKASI)[number]["kode"];
export const isStatusLokasi = (v: unknown): v is StatusLokasi => STATUS_LOKASI.some((s) => s.kode === v);
export const labelStatusLokasi = (v: string) => STATUS_LOKASI.find((s) => s.kode === v)?.label ?? v;

/** Lokasi dan ketua tim ditetapkan paling lambat seminggu sebelum studi lapangan (EB-049). */
export const HARI_SEBELUM_STULA = 7;
export const batasPenetapan = (mulaiStula: string) => tambahHariIso(mulaiStula, -HARI_SEBELUM_STULA);

/**
 * Pasangkan lokasi LAYAK yang belum ditugaskan ke kelompok stula yang belum punya lokasi, bila kategori lokasi
 * tercantum dalam kategori kelompok (kategori kelompok = daftar label, mis. "Kesehatan/RSUD, Kominfo").
 * Kelompok diproses berurutan; satu lokasi untuk satu kelompok. Hasil: kelompokId → lokasiId.
 */
export function cocokkanLokasi(
  kelompok: { id: string; kategori: string | null; adaLokasi: boolean }[],
  lokasi: { id: string; kategori: string | null; status: string; kelompokId: string | null }[],
): Map<string, string> {
  const bebas = lokasi.filter((l) => l.status === "LAYAK" && !l.kelompokId && l.kategori);
  const hasil = new Map<string, string>();
  for (const k of kelompok) {
    if (k.adaLokasi || !k.kategori) continue;
    const label = k.kategori.toLowerCase();
    const i = bebas.findIndex((l) => label.includes(labelKategori(l.kategori).toLowerCase()));
    if (i < 0) continue;
    hasil.set(k.id, bebas[i].id);
    bebas.splice(i, 1);
  }
  return hasil;
}

/**
 * Peringatan penetapan lokasi (EB-049): mulai H-7 sebelum studi lapangan, sebut kelompok tanpa lokasi, lokasi tanpa
 * ketua tim, dan lokasi yang belum layak. Kosong bila studi lapangan belum dijadwalkan atau belum masuk H-7.
 */
export function peringatanStula(o: {
  mulaiStula: string | null;
  hariIni: string;
  kelompok: { label: string; lokasi: { nama: string; status: string; ketuaTim: string | null } | null }[];
}): string[] {
  if (!o.mulaiStula || o.hariIni < batasPenetapan(o.mulaiStula)) return [];
  const out: string[] = [];
  const tanpa = o.kelompok.filter((k) => !k.lokasi).map((k) => k.label);
  if (tanpa.length) out.push(`Belum punya lokasi: ${tanpa.join(", ")}.`);
  const tanpaKetua = o.kelompok.filter((k) => k.lokasi && !k.lokasi.ketuaTim).map((k) => k.label);
  if (tanpaKetua.length) out.push(`Lokasi belum punya ketua tim: ${tanpaKetua.join(", ")}.`);
  const belumLayak = o.kelompok.filter((k) => k.lokasi && k.lokasi.status !== "LAYAK").map((k) => `${k.label} (${k.lokasi!.nama})`);
  if (belumLayak.length) out.push(`Lokasi belum dinyatakan layak: ${belumLayak.join(", ")}.`);
  return out;
}
