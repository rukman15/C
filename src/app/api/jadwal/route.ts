import { ok, failFromError } from "@/lib/server/http";
import { UnauthorizedError } from "@/lib/server/errors";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { getJadwal } from "@/lib/server/repositories/jadwal";

/**
 * Kalender diklat + jadwal mengajar milik akun yang login.
 * Wajib login (`[]` = peran apa pun). Kalender hanya memuat informasi umum
 * (nama, periode, tempat, status); jadwal mengajar selalu milik
 * `session.pegawaiId` sendiri — tidak ada parameter untuk melihat milik orang lain.
 */
export async function GET() {
  try {
    await requireRole([]);
    const session = (await getActiveSession());
    if (!session) throw new UnauthorizedError();
    return ok(await getJadwal(session.pegawaiId));
  } catch (e) {
    return failFromError(e);
  }
}
