import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { pengguna } from "@/lib/server/akses-persuratan";
import { buatDisposisi } from "@/lib/server/repositories/surat-masuk";
import { skemaDisposisi } from "@/lib/server/skema-persuratan";

type Ctx = { params: Promise<{ id: string }> };

/** Beri disposisi (pimpinan) atau teruskan (penerima disposisi surat ini). */
export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pengguna();
    const parsed = skemaDisposisi.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatDisposisi(params.id, parsed.data, p), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
