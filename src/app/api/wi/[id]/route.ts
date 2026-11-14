import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as wiRepo from "@/lib/server/repositories/widyaiswara";
import { NotFoundError } from "@/lib/server/errors";

type Ctx = { params: Promise<{ id: string }> };

// Hanya field operasional; data HR (nama, jabatan, dst) bukan lewat sini.
const patchSchema = z.object({
  status: z.enum(["Aktif", "Cuti"]).optional(),
  // Batas JP per bulan khusus WI ini; null = hapus (ikut batas jenjang di Aturan JP).
  jpMaksimal: z.number().int().min(0).nullable().optional(),
  spesialisasi: z.array(z.string()).optional(),
  bio: z.string().optional(),
});

// Peran pembaca sama dengan GET /api/wi (lihat catatan di sana); admin selalu boleh.
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu", "kepegawaian", "widyaiswara"]);
    const item = await wiRepo.getWiById(params.id);
    if (!item) throw new NotFoundError("Widyaiswara tidak ditemukan");
    return ok(item);
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["kepegawaian", "kepala-balai"]);
    const body = await parseJson<unknown>(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await wiRepo.updateWi(params.id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}
