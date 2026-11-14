import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { putuskanRegistrasi } from "@/lib/server/repositories/registrasi";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("setujui") }),
  z.object({ aksi: z.literal("tolak"), alasan: z.string().trim().max(500).optional() }),
]);

/** Setujui (akun aktif) atau tolak (akun & profil dihapus) — admin & Ketua Diklat. */
export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin", "ketua-diklat"]);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const d = parsed.data;
    await putuskanRegistrasi(params.id, d.aksi, await pelakuSesi(), d.aksi === "tolak" ? d.alasan : null);
    return ok({ aksi: d.aksi });
  } catch (e) {
    return failFromError(e);
  }
}
