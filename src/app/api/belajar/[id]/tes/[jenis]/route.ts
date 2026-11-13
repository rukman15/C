import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaJawaban } from "@/lib/server/skema-tes";
import { isJenisTes, type JenisTes } from "@/lib/tes";
import * as tesRepo from "@/lib/server/repositories/tes";
import { wajibDokumenLengkap } from "@/lib/server/repositories/dokumen-peserta";

type Ctx = { params: Promise<{ id: string; jenis: string }> };

/**
 * Pengerjaan pre/post-test oleh PESERTA sendiri (akun tertaut ke Peserta.id).
 *  GET  — lanjutkan (null = belum mulai);  POST — mulai;  PUT { jawaban, kirim? } — simpan/kirim.
 * Kunci jawaban tidak pernah dikirim; waktu dihitung server.
 */
async function siapa(jenis: string, pesertaId: string): Promise<{ email: string; jenis: JenisTes }> {
  const { role } = await requireRole(["peserta"]);
  if (role !== "peserta") throw new ForbiddenError("Hanya peserta yang mengerjakan tes (admin tidak bisa mengerjakan atas nama peserta)");
  const s = (await getActiveSession());
  if (!s) throw new UnauthorizedError();
  if (!isJenisTes(jenis.toUpperCase())) throw new NotFoundError("Jenis tes tidak dikenal");
  // Ruang belajar terkunci sampai dokumen persyaratan lengkap (jadwal yang mewajibkannya).
  await wajibDokumenLengkap(pesertaId, s.email);
  return { email: s.email, jenis: jenis.toUpperCase() as JenisTes };
}

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { email, jenis } = await siapa(params.jenis, params.id);
    return ok(await tesRepo.getPengerjaan(params.id, jenis, email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { email, jenis } = await siapa(params.jenis, params.id);
    return ok(await tesRepo.mulaiTes(params.id, jenis, email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const { email, jenis } = await siapa(params.jenis, params.id);
    const parsed = skemaJawaban.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await tesRepo.simpanJawaban(params.id, jenis, parsed.data.jawaban, parsed.data.kirim === true, email));
  } catch (e) {
    return failFromError(e);
  }
}
