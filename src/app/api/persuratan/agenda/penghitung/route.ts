import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENOMOR, pengguna } from "@/lib/server/akses-persuratan";
import { aturPenghitung } from "@/lib/server/repositories/persuratan";
import { skemaPenghitung } from "@/lib/server/skema-persuratan";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";

/** Atur nomor urut terakhir satu tahun (melanjutkan buku agenda lama). Hanya TU. */
export async function PUT(request: Request) {
  try {
    await pengguna(PENOMOR);
    const parsed = skemaPenghitung.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const r = await aturPenghitung(parsed.data.tahun, parsed.data.terakhir);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.PENGHITUNG_NOMOR, String(r.tahun), `Nomor terakhir ${r.terakhir}`);
    return ok(r);
  } catch (e) {
    return failFromError(e);
  }
}
