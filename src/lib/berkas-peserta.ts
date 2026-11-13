/**
 * Folder peserta (EB-051): bahan tayang seminar RAP/LAP dan sertifikat self learning. Murni, diuji di uji/folder.test.ts.
 * Berbeda dari dokumen persyaratan: tidak diperiksa penyelenggara, tidak mengunci tes/evaluasi, maks 20 MB.
 */
export const UKURAN_MAKS_BERKAS = 20 * 1024 * 1024;

const PDF = "application/pdf";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const JPG = "image/jpeg";
const PNG = "image/png";
const EKSTENSI: Record<string, string[]> = { [PDF]: ["pdf"], [PPTX]: ["pptx"], [JPG]: ["jpg", "jpeg"], [PNG]: ["png"] };

export const JENIS_BERKAS = [
  { kode: "BAHAN_TAYANG_RAP", label: "Bahan tayang Seminar RAP", keterangan: "Slide presentasi Rancangan Aksi Perubahan", format: [PPTX, PDF], seminar: "RAP" },
  { kode: "BAHAN_TAYANG_LAP", label: "Bahan tayang Seminar LAP", keterangan: "Slide presentasi Laporan Aksi Perubahan", format: [PPTX, PDF], seminar: "LAP" },
  {
    kode: "SERTIFIKAT_MANDIRI",
    label: "Sertifikat self learning",
    keterangan: "Unduh dari SiBangkom LAN setelah pembelajaran mandiri selesai",
    format: [PDF, JPG, PNG],
    seminar: null,
  },
] as const;
export type JenisBerkas = (typeof JENIS_BERKAS)[number]["kode"];
export const isJenisBerkas = (v: unknown): v is JenisBerkas => JENIS_BERKAS.some((j) => j.kode === v);
export const dataJenisBerkas = (kode: string) => JENIS_BERKAS.find((j) => j.kode === kode);

/** Ekstensi yang diterima untuk atribut `accept` input berkas. */
export const terimaBerkas = (kode: JenisBerkas) =>
  dataJenisBerkas(kode)!
    .format.flatMap((t) => EKSTENSI[t].map((e) => `.${e}`))
    .join(",");

/** Tipe dari nama berkas (browser kadang mengirim tipe kosong/octet-stream untuk .pptx). */
export function tipeDariNamaBerkas(nama: string): string | null {
  const eks = nama.toLowerCase().split(".").pop() ?? "";
  return Object.entries(EKSTENSI).find(([, d]) => d.includes(eks))?.[0] ?? null;
}

/** Periksa berkas sebelum disimpan. Mengembalikan pesan galat atau null. Tipe hasil = tipe dari ekstensi. */
export function periksaBerkasPeserta(jenis: string, b: { nama: string; tipe: string; ukuran: number }): { galat: string } | { tipe: string } {
  const j = dataJenisBerkas(jenis);
  if (!j) return { galat: "Jenis berkas tidak dikenal." };
  if (!Number.isFinite(b.ukuran) || b.ukuran <= 0) return { galat: "Berkas kosong." };
  if (b.ukuran > UKURAN_MAKS_BERKAS) return { galat: `Ukuran berkas ${(b.ukuran / 1024 / 1024).toFixed(1).replace(".", ",")} MB, maksimal 20 MB.` };
  const tipe = tipeDariNamaBerkas(b.nama);
  if (!tipe || !(j.format as readonly string[]).includes(tipe)) {
    return { galat: `${j.label} harus berupa ${j.format.map((t) => EKSTENSI[t][0].toUpperCase()).join(" atau ")}.` };
  }
  if (b.tipe && b.tipe !== "application/octet-stream" && EKSTENSI[b.tipe] && b.tipe !== tipe) return { galat: "Ekstensi berkas tidak sesuai isinya." };
  return { tipe };
}

/** Isi berkas sesuai tipenya (tanda tangan biner di awal; PPTX = arsip ZIP "PK\x03\x04"). */
export function isiSesuaiTipeBerkas(isi: Uint8Array, tipe: string): boolean {
  const awal = (b: number[]) => b.every((x, i) => isi[i] === x);
  if (tipe === PDF) return awal([0x25, 0x50, 0x44, 0x46]);
  if (tipe === PNG) return awal([0x89, 0x50, 0x4e, 0x47]);
  if (tipe === JPG) return awal([0xff, 0xd8, 0xff]);
  if (tipe === PPTX) return awal([0x50, 0x4b, 0x03, 0x04]);
  return false;
}
