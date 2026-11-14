import { ok, fail, failFromError } from "@/lib/server/http";
import { UnauthorizedError } from "@/lib/server/errors";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { getWiById } from "@/lib/server/repositories/widyaiswara";

/**
 * Data Widyaiswara milik SESI yang sedang login: session.pegawaiId langsung
 * dipakai sebagai id (tidak ada crosswalk lagi — WI = baris pegawai).
 * Session cookie httpOnly, jadi lookup WAJIB di server.
 *
 * 404 (bukan 401/403) kalau sesi valid tapi tidak tertaut ke pegawai, atau
 * pegawai itu bukan Widyaiswara — bukan soal wewenang, memang tidak ada data.
 */
export async function GET() {
  try {
    await requireRole([]);
    const session = (await getActiveSession());
    if (!session) throw new UnauthorizedError();

    if (!session.pegawaiId) {
      return fail("Akun ini tidak tertaut ke data pegawai", 404);
    }

    const wi = await getWiById(session.pegawaiId);
    if (!wi) {
      return fail("Pegawai ini bukan Widyaiswara", 404);
    }

    return ok(wi);
  } catch (e) {
    return failFromError(e);
  }
}
