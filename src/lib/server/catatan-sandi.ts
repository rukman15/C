import { getSecret } from "@/lib/server/session";
import { hashPassword } from "@/lib/server/password";
import { bukaSandi, kunciSandiAwal, segelSandi } from "@/lib/server/sandi-awal";

/** Catatan sandi awal (EB-040) di sisi server; kuncinya dari BBPKA_SESSION_SECRET (lihat sandi-awal.ts). */

let simpanan: { rahasia: string; kunci: Buffer } | null = null;
function kunci(): Buffer {
  const rahasia = getSecret();
  if (simpanan?.rahasia !== rahasia) simpanan = { rahasia, kunci: kunciSandiAwal(rahasia) };
  return simpanan.kunci;
}

/** Kolom akun untuk kata sandi sementara baru: hash, wajib ganti, dan catatannya. */
export function dataSandiSementara(sandi: string) {
  return { passwordHash: hashPassword(sandi), wajibGantiSandi: true, sandiAwal: segelSandi(sandi, kunci()), sandiAwalAt: new Date() };
}

/** Dipakai saat pemilik mengganti kata sandinya sendiri. */
export const HAPUS_CATATAN_SANDI = { sandiAwal: null, sandiAwalAt: null };

export function bacaCatatanSandi(segel: string): string | null {
  return bukaSandi(segel, kunci());
}
