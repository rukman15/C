import { ok, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { suratTugasSaya } from "@/lib/server/repositories/saya";

/** Surat tugas untuk akun yang login (mengajar + umum bernomor). */
export async function GET() {
  try {
    await requireRole([]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    if (!s.pegawaiId) return ok([]);
    return ok(await suratTugasSaya(s.pegawaiId, { umum: true }));
  } catch (e) {
    return failFromError(e);
  }
}
