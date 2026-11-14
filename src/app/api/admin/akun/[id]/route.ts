import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { resetSandiAkun, setAktifAkun, ubahPeranAkun } from "@/lib/server/repositories/akun-admin";
import { roleProfiles, type UserRole } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

const PERAN = roleProfiles.map((p) => p.id) as [UserRole, ...UserRole[]];

const schema = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("nonaktifkan") }),
  z.object({ aksi: z.literal("aktifkan") }),
  z.object({ aksi: z.literal("reset-sandi") }),
  z.object({ aksi: z.literal("peran"), role: z.enum(PERAN) }),
]);

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const pelaku = await pelakuSesi();
    switch (parsed.data.aksi) {
      case "nonaktifkan":
        await setAktifAkun(params.id, false, pelaku);
        return ok({ aktif: false });
      case "aktifkan":
        await setAktifAkun(params.id, true, pelaku);
        return ok({ aktif: true });
      case "reset-sandi":
        return ok(await resetSandiAkun(params.id, pelaku));
      case "peran":
        await ubahPeranAkun(params.id, parsed.data.role, pelaku);
        return ok({ role: parsed.data.role });
    }
  } catch (e) {
    return failFromError(e);
  }
}
