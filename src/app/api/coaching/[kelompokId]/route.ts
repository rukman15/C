import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaAksiRuang } from "@/lib/server/skema-coaching";
import { aksesRuangCoaching } from "@/lib/server/akses-coaching";
import * as repo from "@/lib/server/repositories/coaching";

type Ctx = { params: Promise<{ kelompokId: string }> };

/**
 * Ruang coaching satu kelompok ELEARNING (`kelompokId` = kelompok_peserta.id).
 *  GET  — isi ruang menurut peran (coach, penyelenggara, peserta anggota, pembaca).
 *  POST { aksi } — sesi | hapus-sesi | pasang-video | lepas-video | catatan (coach & penyelenggara);
 *                  tonton (peserta sendiri).
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await aksesRuangCoaching(params.kelompokId);
    return ok(await repo.getRuang(a));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await aksesRuangCoaching(params.kelompokId);
    const parsed = skemaAksiRuang.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    switch (d.aksi) {
      case "sesi":
        return ok(await repo.simpanSesi(a, d.id ?? null, d), { status: d.id ? 200 : 201 });
      case "hapus-sesi":
        await repo.hapusSesi(a, d.id);
        break;
      case "pasang-video":
        return ok(await repo.pasangVideo(a, d.videoId, d.sesiId ?? null));
      case "lepas-video":
        await repo.lepasVideo(a, d.id);
        break;
      case "tonton":
        await repo.tandaiTonton(a, d.id, d.sudah);
        break;
      case "catatan":
        await repo.simpanCatatan(a, d.sesiId, d.pesertaId, d);
        break;
    }
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
