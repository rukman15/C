import { ok, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { getEvaluasiSaya } from "@/lib/server/repositories/evaluasi";

/** Rekap evaluasi peserta terhadap Widyaiswara yang sedang masuk (rahasia, minimal 3 responden). */
export async function GET() {
  try {
    await requireRole(["widyaiswara"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await getEvaluasiSaya(s.pegawaiId ?? null));
  } catch (e) {
    return failFromError(e);
  }
}
