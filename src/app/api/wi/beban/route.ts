import { ok, fail, failFromError } from "@/lib/server/http";
import { aksesDiklat, wajibPembacaWi } from "@/lib/server/akses";
import { listBebanWi } from "@/lib/server/repositories/beban-wi";
import { isBulan } from "@/lib/dokumen";
import type { PeriodeBeban } from "@/lib/beban-wi";

/** Beban JP semua WI: ?periode=bulan|tahun|semua&bulan=YYYY-MM (tahun = tahun dari bulan). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    wajibPembacaWi(await aksesDiklat());
    const periode = (url.searchParams.get("periode") ?? "tahun") as PeriodeBeban;
    if (!["bulan", "tahun", "semua"].includes(periode)) return fail("Periode tidak valid");
    const bulan = url.searchParams.get("bulan") ?? "";
    if (periode !== "semua" && !isBulan(bulan)) return fail("Bulan tidak valid (YYYY-MM)");
    return ok(await listBebanWi(periode, isBulan(bulan) ? bulan : "2000-01"));
  } catch (e) {
    return failFromError(e);
  }
}
