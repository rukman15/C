import { ok, failFromError } from "@/lib/server/http";
import { PENCATAT_SURAT_MASUK, pengguna } from "@/lib/server/akses-persuratan";
import { tautanPindaian, unggahPindaian } from "@/lib/server/repositories/surat-masuk";
import { bacaUnggahan } from "@/lib/server/berkas-unggah";
import { UKURAN_MAKS_SURAT_MASUK } from "@/lib/persuratan";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Pindaian surat masuk: unggah multipart { berkas } (POST, TU), tautan unduh berjangka (GET). */
export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna(PENCATAT_SURAT_MASUK);
    const u = await bacaUnggahan(request, UKURAN_MAKS_SURAT_MASUK);
    return ok(await unggahPindaian(params.id, u.berkas), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const url = await tautanPindaian(params.id, await pengguna());
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.SURAT_MASUK_DIBUKA, `Surat masuk ${params.id}`);
    return ok({ url });
  } catch (e) {
    return failFromError(e);
  }
}
