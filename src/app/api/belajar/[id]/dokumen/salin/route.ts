import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";

type Ctx = { params: Promise<{ id: string }> };

const skema = z.object({ jenis: z.string().min(1).max(40), dokumenId: z.string().min(1).max(60) });

/**
 * Pakai berkas dari diklat sebelumnya (SK jabatan, SK pangkat, pas foto) milik peserta sendiri:
 * POST { jenis, dokumenId } — berkas disalin, statusnya menunggu diperiksa penyelenggara diklat ini.
 */
export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["peserta"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const siapa = { peran: "PESERTA" as const, akunId: await dokRepo.akunIdDariEmail(s.email) };
    return ok({ id: await dokRepo.pakaiBerkasLama(params.id, parsed.data.jenis, parsed.data.dokumenId, siapa) }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
