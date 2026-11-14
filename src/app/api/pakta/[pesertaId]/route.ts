import { ok, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { wajibBacaFormulir } from "@/lib/server/akses";
import { getPakta, pesertaMilikAkun, trainingPeserta } from "@/lib/server/repositories/formulir-penyelenggaraan";

type Ctx = { params: Promise<{ pesertaId: string }> };

/**
 * Formulir 1 — Pakta Integritas satu peserta (identitas terisi) untuk dicetak, ditandatangani bermaterai,
 * lalu diunggah sebagai berkas PAKTA_INTEGRITAS. Peserta sendiri, atau penyelenggara/pimpinan jadwalnya.
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole([]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    const sendiri = role === "peserta" && (await pesertaMilikAkun(params.pesertaId, s.email));
    if (!sendiri) await wajibBacaFormulir(await trainingPeserta(params.pesertaId));
    return ok(await getPakta(params.pesertaId));
  } catch (e) {
    return failFromError(e);
  }
}
