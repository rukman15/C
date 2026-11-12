import { NextResponse } from "next/server";
import { AppError, ValidationError } from "@/lib/server/errors";

/** Balasan API sama dengan aplikasi lama: `{ ok: true, data }` / `{ ok: false, error }`. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

/** AppError membawa status & pesan untuk pengguna; error lain dibalas 500 generik (detail hanya di log). */
export function failFromError(error: unknown) {
  if (error instanceof AppError) return fail(error.message, error.status);
  console.error("[api] kesalahan tak terduga:", error);
  return fail("Terjadi kesalahan pada server. Coba lagi nanti.", 500);
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError("Body JSON tidak valid");
  }
}

/** IP peminta dari header proxy (Vercel / reverse proxy). Tanpa header: satu ember "unknown". */
export function alamatKlien(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
