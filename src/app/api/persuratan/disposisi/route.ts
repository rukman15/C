import { ok, failFromError } from "@/lib/server/http";
import { penggunaPegawai } from "@/lib/server/akses-persuratan";
import { disposisiSaya } from "@/lib/server/repositories/surat-masuk";

/** Disposisi yang ditujukan kepada pegawai yang login. */
export async function GET() {
  try {
    const p = await penggunaPegawai();
    return ok(await disposisiSaya(p.pegawaiId));
  } catch (e) {
    return failFromError(e);
  }
}
