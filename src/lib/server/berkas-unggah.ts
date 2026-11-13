import "server-only";
import { ValidationError } from "@/lib/server/errors";
import { UKURAN_MAKS_BYTE } from "@/lib/dokumen-peserta";

/** Batas badan permintaan unggah (berkas 2 MB + isian form). */
const BADAN_MAKS = UKURAN_MAKS_BYTE + 64 * 1024;

/**
 * Baca unggahan multipart: satu berkas di field `berkas` + field teks lain.
 * Ditolak lebih awal bila ukuran badan jelas melebihi batas.
 */
export async function bacaUnggahan(
  request: Request,
  maks: number = UKURAN_MAKS_BYTE,
): Promise<{ field: (k: string) => string; berkas: { nama: string; tipe: string; isi: Uint8Array } }> {
  const label = `${Math.round(maks / (1024 * 1024))} MB`;
  const panjang = Number(request.headers.get("content-length") ?? "0");
  if (panjang > maks + (BADAN_MAKS - UKURAN_MAKS_BYTE)) throw new ValidationError(`Ukuran berkas maksimal ${label}`);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Kiriman berkas tidak terbaca");
  }
  const f = form.get("berkas");
  if (!f || typeof f === "string") throw new ValidationError("Berkas belum dipilih");
  const berkas = f as File;
  if (berkas.size > maks) throw new ValidationError(`Ukuran berkas maksimal ${label}`);
  return {
    field: (k) => {
      const v = form.get(k);
      return typeof v === "string" ? v : "";
    },
    berkas: { nama: berkas.name, tipe: berkas.type, isi: new Uint8Array(await berkas.arrayBuffer()) },
  };
}

const TANDA: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};
/** Isi berkas sesuai tipenya (tanda tangan biner di awal berkas), bukan hanya tipe kiriman browser. */
export const isiSesuaiTipe = (isi: Uint8Array, tipe: string) => !!TANDA[tipe] && TANDA[tipe].every((b, i) => isi[i] === b);
