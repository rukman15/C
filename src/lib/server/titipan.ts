import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSecret } from "@/lib/server/session";

/**
 * Token titipan unggah langsung: mengikat jalur titipan ke pengguna, nama, tipe, dan jenis unggahan, berlaku 1 jam.
 * Ditandatangani HMAC dengan BBPKA_SESSION_SECRET (kunci turunan), jadi jalur titipan tidak bisa ditebak/ditukar.
 */
export type JenisTitipan = "berkas-peserta" | "tugas" | "dokumen" | "kunjungan";
export type IsiTitipan = { p: string; n: string; t: string; e: string; j: JenisTitipan; exp: number };

const UMUR_MS = 60 * 60 * 1000;
const kunci = () => createHmac("sha256", getSecret()).update("titipan-unggah").digest();
const tanda = (badan: string) => createHmac("sha256", kunci()).update(badan).digest();

export function buatTitipan(o: { nama: string; tipe: string; email: string; jenis: JenisTitipan }, sekarang = Date.now()): { path: string; token: string } {
  const isi: IsiTitipan = { p: `titipan/${randomUUID()}`, n: o.nama.slice(0, 200), t: o.tipe.slice(0, 120), e: o.email, j: o.jenis, exp: sekarang + UMUR_MS };
  const badan = Buffer.from(JSON.stringify(isi)).toString("base64url");
  return { path: isi.p, token: `${badan}.${tanda(badan).toString("base64url")}` };
}

export function bacaTitipan(token: string, sekarang = Date.now()): IsiTitipan | null {
  const [badan, t, ...lebih] = token.split(".");
  if (!badan || !t || lebih.length) return null;
  const harus = tanda(badan);
  const dapat = Buffer.from(t, "base64url");
  if (dapat.length !== harus.length || !timingSafeEqual(dapat, harus)) return null;
  try {
    const isi = JSON.parse(Buffer.from(badan, "base64url").toString("utf8")) as IsiTitipan;
    if (typeof isi.p !== "string" || !isi.p.startsWith("titipan/") || typeof isi.exp !== "number" || isi.exp < sekarang) return null;
    return isi;
  } catch {
    return null;
  }
}
