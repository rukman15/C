import { ok, failFromError } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { faseDiklat } from "@/lib/server/repositories/fase-diklat";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";

/**
 * Timeline fase PKA/PKP untuk akun yang login (semua peran yang terlibat). Tanpa parameter: diklat berjalan &
 * yang segera mulai. `?trainingId=`: satu diklat (404 bila akun ini tidak terlibat / bukan PKA/PKP).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const a = await aksesDiklat();
    return ok(await faseDiklat(a, isoTanggal(awalHariWib()), url.searchParams.get("trainingId")));
  } catch (e) {
    return failFromError(e);
  }
}
