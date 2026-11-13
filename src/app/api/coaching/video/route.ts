import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaVideo } from "@/lib/server/skema-coaching";
import { pemilikPustaka } from "@/lib/server/akses-coaching";
import { buatVideo, listPustaka } from "@/lib/server/repositories/coaching";

/**
 * Pustaka video coaching milik akun ini (WI / Ketua Diklat yang tertaut ke data pegawai).
 *  GET  — daftar video + berapa kelompok yang memakainya.
 *  POST { judul, tautan, jenis, keterangan? } — tambah video YouTube (hanya tautan; tidak ada unggah berkas).
 */
export async function GET() {
  try {
    const { pegawaiId } = await pemilikPustaka();
    return ok(await listPustaka(pegawaiId));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { pegawaiId } = await pemilikPustaka();
    const parsed = skemaVideo.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await buatVideo(pegawaiId, parsed.data), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
