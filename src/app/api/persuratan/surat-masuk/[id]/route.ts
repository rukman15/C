import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENCATAT_SURAT_MASUK, pengguna } from "@/lib/server/akses-persuratan";
import { getSuratMasuk, hapusSuratMasuk, ubahSuratMasuk } from "@/lib/server/repositories/surat-masuk";
import { skemaSuratMasuk } from "@/lib/server/skema-persuratan";

type Ctx = { params: Promise<{ id: string }> };

/** Satu surat masuk beserta disposisinya (GET), ubah (PUT), hapus bila belum didisposisi (DELETE). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    return ok(await getSuratMasuk(params.id, await pengguna()));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna(PENCATAT_SURAT_MASUK);
    const parsed = skemaSuratMasuk.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await ubahSuratMasuk(params.id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna(PENCATAT_SURAT_MASUK);
    await hapusSuratMasuk(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
