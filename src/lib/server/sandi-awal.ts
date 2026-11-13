import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomInt } from "node:crypto";

/**
 * Kata sandi awal acak dan catatannya (EB-040).
 *
 * Setiap akun baru atau reset mendapat kata sandi sementara acak. Supaya admin bisa
 * menyerahkannya kemudian (Kelola Akun → Catatan sandi awal), kata sandi itu disimpan
 * TERENKRIPSI (AES-256-GCM) di `akun.sandiAwal`, dan dihapus begitu pemiliknya
 * mengganti kata sandi. Kata sandi pilihan pemilik tidak pernah dicatat.
 *
 * Kuncinya diturunkan (HKDF) dari BBPKA_SESSION_SECRET, jadi tidak perlu variabel
 * lingkungan baru. Akibatnya: bila rahasia itu diganti, catatan lama tidak terbaca
 * lagi (admin cukup mereset sandinya).
 *
 * Modul murni (hanya node:crypto) — dipakai server, skrip `prisma/*.ts`, dan uji.
 */

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/l/I).
const ABJAD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function buatSandiSementara(panjang = 12): string {
  let s = "";
  for (let i = 0; i < panjang; i++) s += ABJAD[randomInt(ABJAD.length)];
  return s;
}

export function kunciSandiAwal(rahasia: string): Buffer {
  if (!rahasia) throw new Error("Rahasia untuk kunci catatan sandi kosong.");
  return Buffer.from(hkdfSync("sha256", rahasia, "e-balai", "catatan-sandi-awal/v1", 32));
}

/** "v1.<iv>.<tag>.<isi>" (base64url). */
export function segelSandi(sandi: string, kunci: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunci, iv);
  const isi = Buffer.concat([c.update(sandi, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), isi.toString("base64url")].join(".");
}

/** Isi catatan bila kuncinya cocok dan catatannya utuh; selain itu null. */
export function bukaSandi(segel: string, kunci: Buffer): string | null {
  const b = segel.split(".");
  if (b.length !== 4 || b[0] !== "v1") return null;
  try {
    // authTagLength 16: tag yang dipotong ditolak, bukan diterima.
    const d = createDecipheriv("aes-256-gcm", kunci, Buffer.from(b[1], "base64url"), { authTagLength: 16 });
    d.setAuthTag(Buffer.from(b[2], "base64url"));
    return Buffer.concat([d.update(Buffer.from(b[3], "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
