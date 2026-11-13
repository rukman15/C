import "server-only";
import { getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { aksesDiklat } from "@/lib/server/akses";
import type { Pengguna } from "@/lib/server/repositories/tugas";

/** Identitas pemanggil untuk alur tugas (akses diklat + nama untuk riwayat & log aktivitas). */
export async function penggunaTugas(): Promise<Pengguna> {
  const akses = await aksesDiklat();
  const s = await getActiveSession();
  if (!s) throw new UnauthorizedError();
  return { akses, email: s.email, name: s.name, pegawaiId: s.pegawaiId ?? null };
}
