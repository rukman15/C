import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pesanZod } from "@/lib/server/skema-lms";
import { rekeningSaya, simpanRekeningSaya } from "@/lib/server/repositories/rekening-mentor";

/**
 * Rekening mentor daring (EB-045) — peserta pemilik ruang belajar saja.
 *  GET — status & rekening tersamar.  PUT { namaBank, nomorRekening, atasNama, ponsel } — isi/ubah kapan saja.
 */
type Ctx = { params: Promise<{ id: string }> };
const skema = z.object({ namaBank: z.string().max(100), nomorRekening: z.string().max(40), atasNama: z.string().max(150), ponsel: z.string().max(30) });

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["peserta"]);
    return ok(await rekeningSaya(id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["peserta"]);
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await simpanRekeningSaya(id, s.email, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}
