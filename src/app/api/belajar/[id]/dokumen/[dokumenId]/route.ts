import { failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";

type Ctx = { params: Promise<{ id: string; dokumenId: string }> };

/** Buka berkas milik sendiri: dialihkan ke tautan berjangka (60 detik) bucket privat. */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  let url: string;
  try {
    await requireRole(["peserta"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    url = (await dokRepo.tautanDokumen(params.dokumenId, { peran: "PESERTA", akunId: await dokRepo.akunIdDariEmail(s.email) })).url;
  } catch (e) {
    return failFromError(e);
  }
  return Response.redirect(new URL(url, request.url), 303);
}
