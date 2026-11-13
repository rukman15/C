import { ok, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { listDiklatSaya } from "@/lib/server/repositories/belajar";

/** Ruang belajar: diklat yang diikuti akun peserta yang login. */
export async function GET() {
  try {
    await requireRole(["peserta"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await listDiklatSaya(s.email));
  } catch (e) {
    return failFromError(e);
  }
}
