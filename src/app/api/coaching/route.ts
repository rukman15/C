import { ok, failFromError } from "@/lib/server/http";
import { identitasAkun } from "@/lib/server/akses-coaching";
import { listRuang } from "@/lib/server/repositories/coaching";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";

/**
 * Ruang coaching yang boleh dibuka akun ini: kelompok yang dibimbing (coach), kelompok diklat yang dikelola
 * (penyelenggara), kelompoknya sendiri (peserta), atau semua (pimpinan, Koordinator WI — lihat saja).
 */
export async function GET() {
  try {
    const i = await identitasAkun();
    return ok(await listRuang(i, isoTanggal(awalHariWib())));
  } catch (e) {
    return failFromError(e);
  }
}
