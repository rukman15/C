import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { periksaSandiNip } from "@/lib/server/repositories/akun-admin";

const schema = z.object({
  setelah: z.string().min(1).max(64).nullable().optional(),
  jalankan: z.boolean(),
});

/**
 * Periksa (`jalankan: false`) atau ganti (`jalankan: true`) kata sandi yang masih = NIP menjadi
 * kata sandi sementara acak (EB-040). Satu kelompok akun per permintaan; halaman mengulang
 * dengan `setelah` = `berikutnya` sampai `berikutnya` null.
 */
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await periksaSandiNip(parsed.data.setelah ?? null, parsed.data.jalankan, await pelakuSesi()));
  } catch (e) {
    return failFromError(e);
  }
}
