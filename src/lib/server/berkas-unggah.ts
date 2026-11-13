import "server-only";
import { ValidationError } from "@/lib/server/errors";
import { UKURAN_MAKS_BYTE } from "@/lib/dokumen-peserta";
import { ambilTitipan, hapusTitipan } from "@/lib/server/penyimpanan";
import { bacaTitipan } from "@/lib/server/titipan";
import { getActiveSession } from "@/lib/server/auth";

/** Batas badan permintaan unggah (berkas 2 MB + isian form). */
const BADAN_MAKS = UKURAN_MAKS_BYTE + 64 * 1024;

type Berkas = { nama: string; tipe: string; isi: Uint8Array };
type Unggahan = { field: (k: string) => string; berkas: Berkas | null };

/**
 * Baca unggahan. Dua bentuk:
 *  - multipart: satu berkas di field `berkas` + field teks lain (cara lama; ±4,5 MB di Vercel).
 *  - JSON `{ titipan, ...field }`: berkas sudah diunggah browser langsung ke Supabase (`/api/unggah`); server
 *    mengambilnya, memeriksa token (pemilik, umur), lalu menghapus titipannya. Lolos batas badan Vercel.
 * Ukuran dan pemilik diperiksa di sini; isi/jenis berkas tetap diperiksa repository pemanggil.
 */
async function baca(request: Request, maks: number): Promise<Unggahan> {
  const label = `${Math.round(maks / (1024 * 1024))} MB`;
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    let badan: Record<string, unknown>;
    try {
      badan = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Kiriman tidak terbaca");
    }
    const field = (k: string) => (typeof badan[k] === "string" ? (badan[k] as string) : "");
    const token = field("titipan");
    if (!token) return { field, berkas: null };
    const t = bacaTitipan(token);
    const s = await getActiveSession();
    if (!t || !s || t.e !== s.email) throw new ValidationError("Unggahan kedaluwarsa atau bukan milik Anda. Pilih berkas lagi.");
    const ambil = await ambilTitipan(t.p, maks);
    await hapusTitipan(t.p);
    if (!ambil) throw new ValidationError("Berkas belum terunggah. Pilih berkas lagi.");
    if (ambil.isi.byteLength > maks) throw new ValidationError(`Ukuran berkas maksimal ${label}`);
    return { field, berkas: { nama: t.n, tipe: t.t, isi: ambil.isi } };
  }
  const panjang = Number(request.headers.get("content-length") ?? "0");
  if (panjang > maks + (BADAN_MAKS - UKURAN_MAKS_BYTE)) throw new ValidationError(`Ukuran berkas maksimal ${label}`);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Kiriman berkas tidak terbaca");
  }
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const f = form.get("berkas");
  if (!f || typeof f === "string" || f.size === 0) return { field, berkas: null };
  if (f.size > maks) throw new ValidationError(`Ukuran berkas maksimal ${label}`);
  return { field, berkas: { nama: f.name, tipe: f.type, isi: new Uint8Array(await f.arrayBuffer()) } };
}

/** Unggahan wajib berisi berkas. */
export async function bacaUnggahan(request: Request, maks: number = UKURAN_MAKS_BYTE): Promise<{ field: (k: string) => string; berkas: Berkas }> {
  const u = await baca(request, maks);
  if (!u.berkas) throw new ValidationError("Berkas belum dipilih");
  return { field: u.field, berkas: u.berkas };
}

/** Unggahan dengan berkas opsional (mis. catatan kunjungan stula). */
export const bacaUnggahanOpsional = (request: Request, maks: number) => baca(request, maks);

const TANDA: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};
/** Isi berkas sesuai tipenya (tanda tangan biner di awal berkas), bukan hanya tipe kiriman browser. */
export const isiSesuaiTipe = (isi: Uint8Array, tipe: string) => !!TANDA[tipe] && TANDA[tipe].every((b, i) => isi[i] === b);
