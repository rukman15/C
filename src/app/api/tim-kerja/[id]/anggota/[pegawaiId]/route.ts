import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as timKerjaRepo from "@/lib/server/repositories/tim-kerja";

type Ctx = { params: Promise<{ id: string; pegawaiId: string }> };

const patchSchema = z.object({
  peran: z.enum(["ketua", "anggota"]),
});

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const updated = await timKerjaRepo.updateAnggotaPeran(params.id, params.pegawaiId, parsed.data.peran);
    return ok(updated);
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    const updated = await timKerjaRepo.removeAnggota(params.id, params.pegawaiId);
    return ok(updated);
  } catch (e) {
    return failFromError(e);
  }
}
