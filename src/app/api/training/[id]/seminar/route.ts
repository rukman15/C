import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaSimpanSeminar, skemaStatusSeminar } from "@/lib/server/skema-coaching";
import { aksesSeminar, aturStatus, getSeminar, simpanJadwal, wajibKelolaSeminar } from "@/lib/server/repositories/seminar";
import { isJenisSeminar } from "@/lib/seminar";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";

/**
 * Seminar aksi perubahan satu jadwal PKA/PKP (?jenis=RAP|LAP), sama dengan aplikasi lama ditambah per kelompok (EB-055).
 *  GET  — penyelenggara & pimpinan: semua peserta; penguji: hanya peserta/kelompok yang ia uji.
 *  PUT  { jenis, isian: [...] } — ubah jadwal per peserta (penyelenggara pemegang diklat).
 *  POST { id, status } — evaluator (akun penyelenggara) mengubah status panggilan.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await aksesSeminar(id);
    const j = new URL(request.url).searchParams.get("jenis");
    return ok(await getSeminar(id, isJenisSeminar(j) ? j : "RAP", a, isoTanggal(awalHariWib())));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaSeminar(id);
    const parsed = skemaSimpanSeminar.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await simpanJadwal(id, parsed.data.jenis, parsed.data.isian, a.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaSeminar(id);
    const parsed = skemaStatusSeminar.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await aturStatus(id, parsed.data.id, parsed.data.status, a.email);
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
