import { failFromError, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { bukaRekening } from "@/lib/server/repositories/rekening-mentor";

/** Buka rekening mentor daring lengkap (EB-045): hanya Ketua Diklat dan admin; setiap pembukaan tercatat di Log Audit. */
type Ctx = { params: Promise<{ id: string; pesertaId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id, pesertaId } = await params;
    await requireRole(["ketua-diklat"]);
    return ok(await bukaRekening(id, pesertaId, await pelakuSesi()));
  } catch (e) {
    return failFromError(e);
  }
}
