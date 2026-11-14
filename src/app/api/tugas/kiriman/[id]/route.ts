import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { getDetailKiriman, tinjauKiriman } from "@/lib/server/repositories/tugas";

/**
 * Satu kiriman tugas (EB-038): peserta pemilik, peninjau (coach/mentor/pengampu), atau pengelola diklat.
 *  GET — rincian + riwayat.  POST — tinjau { aksi, catatan?, sebagai?, atasNama? }; pengelola yang bukan peninjau mencatat
 *  ATAS NAMA peninjau (sebagai + atasNama wajib).
 */
type Ctx = { params: Promise<{ id: string }> };
const skemaTinjau = z.object({
  aksi: z.enum(["MULAI_TINJAU", "REVISI", "TERIMA", "CATATAN", "SETUJU_MENTOR"]),
  catatan: z.string().max(2000).nullish(),
  sebagai: z.enum(["COACH", "MENTOR", "PENGAMPU"]).nullish(),
  atasNama: z.string().max(120).nullish(),
});

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return ok(await getDetailKiriman(await penggunaTugas(), id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await penggunaTugas();
    const parsed = skemaTinjau.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await tinjauKiriman(p, id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}
