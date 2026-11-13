import { fail, failFromError, ok } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { ForbiddenError } from "@/lib/server/errors";
import { daftarWi } from "@/lib/server/repositories/pengampu";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";

/**
 * Daftar Widyaiswara dengan beban JP pada `?bulan=YYYY-MM` (bawaan bulan berjalan). Dibaca peran yang
 * memakainya + anggota tim pemegang diklat (sama dengan wajibPembacaWi aplikasi lama).
 */
const PERAN_PEMBACA_WI = ["ketua-diklat", "kepala-balai", "kabag-tu", "kepegawaian", "widyaiswara"];

export async function GET(request: Request) {
  try {
    const a = await aksesDiklat();
    if (!a.global && !PERAN_PEMBACA_WI.includes(a.role) && a.tim.length === 0) throw new ForbiddenError();
    const bulan = new URL(request.url).searchParams.get("bulan");
    if (bulan !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) return fail("Format bulan harus YYYY-MM");
    return ok(await daftarWi(bulan ?? isoTanggal(awalHariWib()).slice(0, 7)));
  } catch (e) {
    return failFromError(e);
  }
}
