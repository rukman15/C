import { ok, fail, failFromError } from "@/lib/server/http";
import { aksesDiklat, wajibPembacaWi } from "@/lib/server/akses";
import { rincianBebanWi } from "@/lib/server/repositories/beban-wi";
import { isBulan } from "@/lib/dokumen";

type Ctx = { params: Promise<{ id: string }> };

/** Rincian beban satu WI (panel samping): penugasan terbaru + sesi mengajar bulan ?bulan=YYYY-MM. */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  const url = new URL(request.url);
  try {
    wajibPembacaWi(await aksesDiklat());
    const bulan = url.searchParams.get("bulan") ?? "";
    if (!isBulan(bulan)) return fail("Bulan tidak valid (YYYY-MM)");
    return ok(await rincianBebanWi(params.id, bulan));
  } catch (e) {
    return failFromError(e);
  }
}
