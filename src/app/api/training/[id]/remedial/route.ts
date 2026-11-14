import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod, skemaPelaksanaanRemedial } from "@/lib/server/skema-lms";
import { wajibBacaFormulir, wajibKelolaFormulir } from "@/lib/server/akses";
import { getRemedialJadwal, simpanPelaksanaanRemedial } from "@/lib/server/repositories/formulir-penyelenggaraan";

/**
 * Formulir 15 — Laporan Hasil Evaluasi Remedial (sama dengan aplikasi lama): peserta yang evaluasi akhir pertamanya ditunda.
 *  GET — penyelenggara pemegang diklat & pimpinan.
 *  PUT { pesertaId, jenisEvaluasi, tanggal, waktu, teknis, catatan } — penyelenggara (nilai remedial tetap di lembar penilaian).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibBacaFormulir(id);
    return ok(await getRemedialJadwal(id, a.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaFormulir(id);
    const parsed = skemaPelaksanaanRemedial.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await simpanPelaksanaanRemedial(id, parsed.data, a.email));
  } catch (e) {
    return failFromError(e);
  }
}
