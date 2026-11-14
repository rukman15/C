import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getDashboardPimpinan } from "@/lib/server/repositories/pimpinan";

/** Home Kepala Balai — read-only (admin otomatis lolos lewat requireRole). */
export async function GET() {
  try {
    await requireRole(["kepala-balai", "kabag-tu"]);
    const data = await getDashboardPimpinan();
    return ok({ ...data, lms: true });
  } catch (e) {
    return failFromError(e);
  }
}
