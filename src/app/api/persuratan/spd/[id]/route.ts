import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PEMBUAT_SPD, pengguna } from "@/lib/server/akses-persuratan";
import { hapusSpd, setSpd, ubahSpd } from "@/lib/server/repositories/spd";
import { skemaSpd } from "@/lib/server/skema-persuratan";

type Ctx = { params: Promise<{ id: string }> };

/** Ubah (PUT) / hapus (DELETE) satu SPD. */
export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna(PEMBUAT_SPD);
    const parsed = skemaSpd.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const s = await ubahSpd(params.id, parsed.data);
    return ok(await setSpd(s.sumber, s.sumberId));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna(PEMBUAT_SPD);
    await hapusSpd(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
