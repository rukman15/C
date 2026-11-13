import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaVideo } from "@/lib/server/skema-coaching";
import { pemilikPustaka } from "@/lib/server/akses-coaching";
import { hapusVideo, ubahVideo } from "@/lib/server/repositories/coaching";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Satu video di pustaka sendiri.
 *  PATCH  { judul, tautan, jenis, keterangan? } — ubah (semua kelompok yang memakainya ikut berubah).
 *  DELETE ?paksa=1 — hapus; tanpa `paksa` ditolak (409) bila masih dipakai di kelompok.
 */
export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { pegawaiId } = await pemilikPustaka();
    const parsed = skemaVideo.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await ubahVideo(pegawaiId, params.id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  const url = new URL(request.url);
  try {
    const { pegawaiId } = await pemilikPustaka();
    await hapusVideo(pegawaiId, params.id, url.searchParams.get("paksa") === "1");
    return ok({ dihapus: true });
  } catch (e) {
    return failFromError(e);
  }
}
