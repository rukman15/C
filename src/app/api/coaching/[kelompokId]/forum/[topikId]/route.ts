import { ok, failFromError } from "@/lib/server/http";
import { aksesRuangCoaching } from "@/lib/server/akses-coaching";
import { getTopik } from "@/lib/server/repositories/coaching";

type Ctx = { params: Promise<{ kelompokId: string; topikId: string }> };

/** Satu topik forum beserta balasannya (membuka topik = tulisan dianggap sudah dibaca). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await aksesRuangCoaching(params.kelompokId);
    return ok(await getTopik(a, params.topikId));
  } catch (e) {
    return failFromError(e);
  }
}
