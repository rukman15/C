import { failFromError, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { hapusBerkasPeserta, tautanBerkasPeserta } from "@/lib/server/repositories/berkas-peserta";

/** Buka (alihkan ke tautan berjangka) atau hapus satu berkas folder peserta. */
type Ctx = { params: Promise<{ id: string; berkasId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id, berkasId } = await params;
  let url: string;
  try {
    const s = await requireRole(["peserta", "ketua-diklat", "kepala-balai"]);
    url = await tautanBerkasPeserta(id, berkasId, s.role === "peserta" ? { pratinjau: false, email: s.email } : { pratinjau: true });
  } catch (e) {
    return failFromError(e);
  }
  return Response.redirect(new URL(url, request.url), 303);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, berkasId } = await params;
    const s = await requireRole(["peserta"]);
    await hapusBerkasPeserta(id, berkasId, s.email);
    return ok({ dihapus: true });
  } catch (e) {
    return failFromError(e);
  }
}
