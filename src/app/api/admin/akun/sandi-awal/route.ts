import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { catatanSandiAwal } from "@/lib/server/repositories/akun-admin";

/** Catatan sandi awal (EB-040) — khusus admin; setiap pembukaan tercatat di Log Audit. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await catatanSandiAwal(await pelakuSesi()), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return failFromError(e);
  }
}
