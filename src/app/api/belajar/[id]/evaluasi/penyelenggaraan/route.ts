import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaIsi23B } from "@/lib/server/skema-evaluasi";
import * as evRepo from "@/lib/server/repositories/evaluasi";
import { wajibDokumenLengkap } from "@/lib/server/repositories/dokumen-peserta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Evaluasi penyelenggaraan (Formulir 23B) oleh PESERTA (`id` = Peserta.id).
 * Data & status dibaca lewat GET /api/belajar/[id]/evaluasi (bagian `penyelenggaraan`).
 *  PUT { nilai, catatan } — isi/ubah (selama belum ditutup).
 */
export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["peserta"]);
    if (role !== "peserta") throw new ForbiddenError("Evaluasi diisi oleh peserta sendiri");
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    await wajibDokumenLengkap(params.id, s.email);
    const parsed = skemaIsi23B.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await evRepo.simpanEvaluasiPenyelenggaraan(params.id, s.email, parsed.data);
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
