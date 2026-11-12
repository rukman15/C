import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/lib/roles";

/**
 * Sesi bertanda tangan HMAC-SHA256. Formatnya SAMA PERSIS dengan aplikasi lama
 * (src/lib/server/session.ts): dengan BBPKA_SESSION_SECRET yang sama, cookie
 * `bbpka_session` berlaku di kedua aplikasi.
 */
const DEV_FALLBACK_SECRET = "bbpka-dev-session-secret-change-me";

export function getSecret(): string {
  const secret = process.env.BBPKA_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "development") return DEV_FALLBACK_SECRET;
  throw new Error(
    "BBPKA_SESSION_SECRET belum diset. Wajib diisi string acak panjang sebelum auth bisa dipakai di luar mode dev (lihat .env.example).",
  );
}

export type SessionPayload = {
  email: string;
  role: UserRole;
  name: string;
  pegawaiId: string | null;
  jabatan: string | null;
  /** Kata sandi masih = NIP atau sementara: wajib ganti dulu. */
  wajibGantiSandi?: boolean;
  /** Login memakai kata sandi sementara (kolom akun.wajibGantiSandi). */
  sandiSementara?: boolean;
  /** Bertindak sebagai Plt/Plh. */
  plt?: { id: string; sebagai: string };
  /** Akun.sesiVersi saat sesi dibuat; berbeda = sesi gugur. */
  sv?: number;
  exp: number;
};

export const UMUR_SESI_DETIK = 60 * 60 * 24 * 7;

export function signSession(payload: Omit<SessionPayload, "exp">, ttlSec = UMUR_SESI_DETIK): string {
  const body: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", getSecret()).update(json).digest("base64url");
  return `${json}.${mac}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [json, mac] = token.split(".");
  if (!json || !mac) return null;
  const expected = createHmac("sha256", getSecret()).update(json).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
