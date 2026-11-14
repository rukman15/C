import { failFromError, ok } from "@/lib/server/http";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { daftarTinjau } from "@/lib/server/repositories/tugas";

/** GET ?trainingId=&semua=1 — kiriman tugas yang perlu ditinjau akun ini (coach/mentor/pengampu atau pengelola diklat). */
export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    return ok(await daftarTinjau(await penggunaTugas(), { trainingId: u.searchParams.get("trainingId") || null, semua: u.searchParams.get("semua") === "1" }));
  } catch (e) {
    return failFromError(e);
  }
}
