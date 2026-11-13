import { ok, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { getRuangBelajar } from "@/lib/server/repositories/belajar";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ruang belajar satu peserta. Peserta hanya bisa membuka miliknya sendiri;
 * Ketua Diklat, Kepala Balai, dan admin membukanya sebagai pratinjau.
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["peserta", "ketua-diklat", "kepala-balai"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    const pembaca = role === "peserta" ? { pratinjau: false as const, email: s.email } : { pratinjau: true as const };
    return ok(await getRuangBelajar(params.id, pembaca));
  } catch (e) {
    return failFromError(e);
  }
}
