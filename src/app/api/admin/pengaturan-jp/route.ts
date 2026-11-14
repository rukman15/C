import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import * as pengaturanJpRepo from "@/lib/server/repositories/pengaturan-jp";

const patchSchema = z.object({
  batasHijauHarian: z.number().int().min(1).optional(),
  batasKuningHarian: z.number().int().min(1).optional(),
  batasRekapBulanan: z.number().int().min(1).optional(),
});

export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await pengaturanJpRepo.getPengaturanJp());
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const current = await pengaturanJpRepo.getPengaturanJp();
    const hijau = parsed.data.batasHijauHarian ?? current.batasHijauHarian;
    const kuning = parsed.data.batasKuningHarian ?? current.batasKuningHarian;
    if (hijau >= kuning) {
      return fail("Batas hijau harus lebih kecil dari batas kuning");
    }
    const session = (await getActiveSession());
    return ok(await pengaturanJpRepo.updatePengaturanJp(parsed.data, session?.email ?? "admin"));
  } catch (e) {
    return failFromError(e);
  }
}
