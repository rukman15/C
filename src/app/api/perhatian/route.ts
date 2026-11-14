import { ok, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { getPerhatian } from "@/lib/server/repositories/perhatian";

/**
 * "Perlu perhatian" untuk akun yang login (kartu Update Terbaru di Home). Selalu
 * milik sesi sendiri — tidak ada `?role=`: pratinjau admin atas peran lain tidak
 * boleh membocorkan data WI tertentu.
 */
export async function GET() {
  try {
    const { role } = await requireRole([]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await getPerhatian({ role, email: s.email, pegawaiId: s.pegawaiId ?? null }, new Date(), { persuratan: true }));
  } catch (e) {
    return failFromError(e);
  }
}
