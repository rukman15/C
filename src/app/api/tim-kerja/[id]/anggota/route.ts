import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as timKerjaRepo from "@/lib/server/repositories/tim-kerja";

type Ctx = { params: Promise<{ id: string }> };

const addSchema = z.object({
  pegawaiId: z.string().min(1),
  peran: z.enum(["ketua", "anggota"]).optional(),
});

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    // Keanggotaan manual — admin assign satu-satu (keputusan diskusi),
    // bukan otomatis ngikutin jabatan/unit tertentu.
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const updated = await timKerjaRepo.addAnggota(params.id, parsed.data);
    return ok(updated, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
