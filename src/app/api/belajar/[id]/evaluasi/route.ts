import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaIsiEvaluasi } from "@/lib/server/skema-evaluasi";
import * as evRepo from "@/lib/server/repositories/evaluasi";
import { wajibDokumenLengkap } from "@/lib/server/repositories/dokumen-peserta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Evaluasi pengajar oleh PESERTA (`id` = Peserta.id).
 *  GET — daftar sasaran + isian sendiri (Ketua Diklat/Kepala Balai: pratinjau tanpa isian).
 *  PUT { sasaranKunci, nilai, catatan } — isi/ubah (selama belum ditutup).
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["peserta", "ketua-diklat", "kepala-balai"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await evRepo.getEvaluasiPeserta(params.id, role === "peserta" ? { pratinjau: false, email: s.email } : { pratinjau: true }));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { role } = await requireRole(["peserta"]);
    if (role !== "peserta") throw new ForbiddenError("Evaluasi diisi oleh peserta sendiri");
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    await wajibDokumenLengkap(params.id, s.email);
    const parsed = skemaIsiEvaluasi.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await evRepo.simpanEvaluasi(params.id, s.email, parsed.data);
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
