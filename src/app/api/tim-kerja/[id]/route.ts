import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as timKerjaRepo from "@/lib/server/repositories/tim-kerja";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  nama: z.string().min(1).optional(),
  deskripsi: z.string().optional(),
  wewenang: z.array(z.string().min(1)).optional(),
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
    const updated = await timKerjaRepo.updateTimKerja(params.id, parsed.data);
    return ok(updated);
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    await timKerjaRepo.deleteTimKerja(params.id);
    return ok({ deleted: true });
  } catch (e) {
    return failFromError(e);
  }
}
