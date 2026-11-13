import { ok, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { listTesPeserta } from "@/lib/server/repositories/tes";

type Ctx = { params: Promise<{ id: string }> };

/** Daftar pre/post-test seorang peserta (`id` = Peserta.id). Penyelenggara & pimpinan: pratinjau. */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["peserta", "ketua-diklat", "kepala-balai"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await listTesPeserta(params.id, role === "peserta" ? { pratinjau: false, email: s.email } : { pratinjau: true }));
  } catch (e) {
    return failFromError(e);
  }
}
