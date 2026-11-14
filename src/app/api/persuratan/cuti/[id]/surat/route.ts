import { ok, failFromError } from "@/lib/server/http";
import { pengguna } from "@/lib/server/akses-persuratan";
import { suratCuti } from "@/lib/server/repositories/cuti";

type Ctx = { params: Promise<{ id: string }> };

/** Data cetak Nota Dinas + Surat Izin Cuti (halaman /cetak/cuti/[id]). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    return ok(await suratCuti(params.id, await pengguna()));
  } catch (e) {
    return failFromError(e);
  }
}
