import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { wajibBacaSuratId, wajibKelolaSurat } from "@/lib/server/akses-dokumen";
import { getSuratTugas, hapusSuratTugas, trainingSurat, ubahSuratTugas } from "@/lib/server/repositories/dokumen";
import { skemaSuratTugas } from "@/lib/server/skema-dokumen";

type Ctx = { params: Promise<{ id: string }> };

/** Satu surat tugas: data lengkap untuk dicetak (GET), ubah (PUT), hapus (DELETE). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await wajibBacaSuratId(params.id);
    return ok(await getSuratTugas(params.id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await wajibKelolaSurat(await trainingSurat(params.id));
    const parsed = skemaSuratTugas.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await ubahSuratTugas(params.id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await wajibKelolaSurat(await trainingSurat(params.id));
    await hapusSuratTugas(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
