import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { tetapkanPengampu } from "@/lib/server/repositories/pengampu";

/** Tetapkan pengampu: Ketua Diklat/admin, atau anggota tim pemegang diklatnya (sama dengan aplikasi lama). */
const schema = z.object({
  trainingId: z.string().min(1),
  instructorId: z.string().min(1),
  jp: z.number().int().min(1).max(10_000),
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
  mataPelatihan: z.string().trim().max(60).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const a = await aksesDiklat();
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    await wajibKelolaTraining(a, parsed.data.trainingId);
    return ok(await tetapkanPengampu({ ...parsed.data, diajukanOleh: a.email }), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
