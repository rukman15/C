import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { pelakuSesi } from "@/lib/server/audit";
import { wajibKoordinatorAtau } from "@/lib/server/akses";
import { isBulan } from "@/lib/dokumen";
import { bulanSekarang, listBatasJpWi, simpanBatasJpWi } from "@/lib/server/repositories/batas-jp-wi";

/**
 * Batas JP Widyaiswara PER BULAN — diatur manual oleh admin atau Koordinator WI (halaman Aturan JP).
 *   GET  ?bulan=YYYY-MM  batas jenjang + semua WI (batas khusus, batas berlaku, JP bulan itu)
 *   PATCH { jenjang?: {pertama|muda|madya|utama: n|null}, wi?: [{id, batas: n|null}] }
 * null = kosongkan (jenjang: belum diatur; WI: ikut batas jenjang).
 */
const batas = z.number().int("Batas JP harus bilangan bulat").min(1, "Batas JP minimal 1").nullable();
const patchSchema = z.object({
  jenjang: z
    .object({ pertama: batas.optional(), muda: batas.optional(), madya: batas.optional(), utama: batas.optional() })
    .strict()
    .optional(),
  wi: z.array(z.object({ id: z.string().min(1).max(64), batas })).max(500).optional(),
  bulan: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await wajibKoordinatorAtau([]);
    const bulan = url.searchParams.get("bulan") ?? bulanSekarang();
    if (!isBulan(bulan)) return fail("Format bulan harus YYYY-MM");
    return ok(await listBatasJpWi(bulan));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    await wajibKoordinatorAtau([]);
    const parsed = patchSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const bulan = parsed.data.bulan ?? bulanSekarang();
    if (!isBulan(bulan)) return fail("Format bulan harus YYYY-MM");
    const berubah = await simpanBatasJpWi({ jenjang: parsed.data.jenjang, wi: parsed.data.wi }, await pelakuSesi());
    return ok({ berubah, ...(await listBatasJpWi(bulan)) });
  } catch (e) {
    return failFromError(e);
  }
}
