import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { getPengaturanDokumen, simpanPengaturanDokumen } from "@/lib/server/repositories/dokumen";
import { skemaPengaturanDokumen } from "@/lib/server/skema-dokumen";

/** Pejabat penanda tangan (Kepala Balai, Kabag TU) + perjalanan dinas — admin. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await getPengaturanDokumen());
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(["admin"]);
    const parsed = skemaPengaturanDokumen.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await simpanPengaturanDokumen(parsed.data, (await getActiveSession())?.email ?? "admin"));
  } catch (e) {
    return failFromError(e);
  }
}
