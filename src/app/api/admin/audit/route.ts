import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { listAudit } from "@/lib/server/audit";

/** Log audit — khusus admin. ?cari=teks&take=200 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await requireRole(["admin"]);
    const take = Number(url.searchParams.get("take") ?? 200);
    return ok(await listAudit({ cari: url.searchParams.get("cari") ?? undefined, take: Number.isFinite(take) ? take : 200 }));
  } catch (e) {
    return failFromError(e);
  }
}
