import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getRingkasanLembaga } from "@/lib/server/repositories/ringkasan";

/**
 * Ringkasan lembaga — khusus Kepala Balai (admin otomatis lolos lewat
 * `requireRole`). Read-only.
 */
export async function GET() {
  try {
    await requireRole(["kepala-balai", "kabag-tu"]);
    return ok(await getRingkasanLembaga({ persuratan: true }));
  } catch (e) {
    return failFromError(e);
  }
}
