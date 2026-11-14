import { ok, failFromError } from "@/lib/server/http";
import { PEMBACA_SPD, pengguna } from "@/lib/server/akses-persuratan";
import { daftarSuratUntukSpd } from "@/lib/server/repositories/spd";
import { awalHariWib } from "@/lib/tanggal";

/** Surat tugas bernomor (umum & mengajar) satu tahun beserta jumlah SPD: ?tahun=YYYY. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna(PEMBACA_SPD);
    const tahun = Number(url.searchParams.get("tahun") ?? "") || awalHariWib().getUTCFullYear();
    return ok(await daftarSuratUntukSpd(tahun));
  } catch (e) {
    return failFromError(e);
  }
}
