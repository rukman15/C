import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { penggunaPegawai } from "@/lib/server/akses-persuratan";
import { tindakLanjutDisposisi } from "@/lib/server/repositories/surat-masuk";
import { skemaTindakLanjut } from "@/lib/server/skema-persuratan";

type Ctx = { params: Promise<{ id: string }> };

/** Penerima menandai disposisi dibaca/selesai dengan catatan tindak lanjut. */
export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await penggunaPegawai();
    const parsed = skemaTindakLanjut.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    await tindakLanjutDisposisi(params.id, p.pegawaiId, parsed.data);
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
