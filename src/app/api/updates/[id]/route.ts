import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as updatesRepo from "@/lib/server/repositories/updates";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tandai satu update sebagai sudah dibaca (unread -> false). Tidak butuh
 * body — dipanggil begitu kartu update yang bersangkutan tampil di depan
 * pada panel "Update Terbaru", meniru perilaku badge notifikasi biasa.
 *
 * Array kosong di requireRole = "role apa pun boleh, yang penting sudah
 * login". `role === "admin" ? undefined : role` dikirim sebagai allowedRole
 * — admin boleh mark-read update role mana pun, role lain cuma update role
 * dia sendiri (lihat komentar lengkap di repository).
 */
export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole([]);
    const { id } = params;
    const updated = await updatesRepo.markRead(id, role === "admin" ? undefined : role);
    return ok(updated);
  } catch (e) {
    return failFromError(e);
  }
}
