import { failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { tautanBerkasKunjungan } from "@/lib/server/repositories/stula";

/** Unduh berkas advance kunjungan (EB-053): Ketua Diklat, Kepala Balai, Kabag TU, admin. */
type Ctx = { params: Promise<{ id: string; kunjunganId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id, kunjunganId } = await params;
    await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    return Response.redirect(new URL(await tautanBerkasKunjungan(id, kunjunganId), request.url), 303);
  } catch (e) {
    return failFromError(e);
  }
}
