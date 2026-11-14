import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { cabutPenugasanSementara } from "@/lib/server/repositories/plt";

type Ctx = { params: Promise<{ id: string }> };

/** Cabut Plt/Plh (baris tetap disimpan sebagai jejak). */
export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["kepegawaian"]);
    await cabutPenugasanSementara(params.id, { ...await pelakuSesi(), role });
    return ok({ dicabut: true });
  } catch (e) {
    return failFromError(e);
  }
}
