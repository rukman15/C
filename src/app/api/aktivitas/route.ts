import { ok, failFromError } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { daftarAktivitas } from "@/lib/server/aktivitas";

/**
 * GET ?trainingId=&take= — Aktivitas Terbaru di Beranda pengelola (EB-039). Tanpa trainingId = semua diklat
 * yang boleh diakses. Bila tabel belum dibuat (migrasi belum dijalankan): `{ siap: false, butir: [] }`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const a = await aksesDiklat();
    const take = Number(url.searchParams.get("take") ?? "10");
    return ok(await daftarAktivitas(a, url.searchParams.get("trainingId") || null, Number.isFinite(take) ? take : 10));
  } catch (e) {
    return failFromError(e);
  }
}
