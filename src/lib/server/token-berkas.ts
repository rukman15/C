import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tautan unduh berjangka untuk berkas di Google Drive. Drive tidak punya "signed URL" seperti
 * Supabase Storage, jadi server membuat token sendiri: isi (id berkas Drive, nama unduhan, waktu
 * kedaluwarsa) + tanda tangan HMAC. `/api/berkas/[token]` memeriksa token lalu mengalirkan berkasnya.
 * Logika murni (kunci diberikan pemanggil) — diuji di uji/murni.test.ts.
 */
export type IsiTokenBerkas = { id: string; nama?: string; exp: number };

const tandaTangan = (badan: string, kunci: string) => createHmac("sha256", kunci).update(badan).digest();

export function buatTokenBerkas(isi: IsiTokenBerkas, kunci: string): string {
  const badan = Buffer.from(JSON.stringify(isi)).toString("base64url");
  return `${badan}.${tandaTangan(badan, kunci).toString("base64url")}`;
}

/** Isi token bila sah dan belum kedaluwarsa; selain itu null. */
export function bacaTokenBerkas(token: string, kunci: string, sekarang = Date.now()): IsiTokenBerkas | null {
  const bagian = token.split(".");
  if (bagian.length !== 2 || !bagian[0] || !bagian[1]) return null;
  const [badan, tanda] = bagian;
  const harus = tandaTangan(badan, kunci);
  const dapat = Buffer.from(tanda, "base64url");
  if (dapat.length !== harus.length || !timingSafeEqual(dapat, harus)) return null;
  try {
    const isi = JSON.parse(Buffer.from(badan, "base64url").toString("utf8")) as Partial<IsiTokenBerkas>;
    if (typeof isi.id !== "string" || !isi.id || typeof isi.exp !== "number" || isi.exp < sekarang) return null;
    return { id: isi.id, exp: isi.exp, ...(typeof isi.nama === "string" ? { nama: isi.nama } : {}) };
  } catch {
    return null;
  }
}

/** Nama berkas di Drive dari jalur bucket (Drive tidak punya jalur): "a/b/c.pdf" -> "a__b__c.pdf". */
export const namaBerkasDrive = (path: string) => path.split("/").join("__");

/** Kutip nilai untuk kueri `q` Drive API (garis miring terbalik & petik tunggal di-escape). */
export const kutipKueriDrive = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
