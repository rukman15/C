import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { bacaUnggahan } from "@/lib/server/berkas-unggah";
import { wajibDokumenLengkap } from "@/lib/server/repositories/dokumen-peserta";
import { UKURAN_MAKS_TUGAS } from "@/lib/tugas";
import * as repo from "@/lib/server/repositories/tugas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tugas milik PESERTA sendiri (`id` = Peserta.id; EB-038).
 *  GET   — daftar tugas diklat + kiriman & riwayat milik sendiri.
 *  POST  — multipart { tugasId, berkas } — unggah/ganti berkas (maks 10 MB).
 *  PATCH — { tugasId, aksi: "KIRIM" } — kirim untuk ditinjau.
 * Seperti tes & evaluasi, terkunci sampai dokumen persyaratan lengkap (bila jadwal mewajibkannya).
 */
async function sesiPeserta() {
  await requireRole(["peserta"]);
  const s = (await getActiveSession());
  if (!s) throw new UnauthorizedError();
  return s;
}

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const s = await sesiPeserta();
    return ok(await repo.getTugasPeserta(params.id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const s = await sesiPeserta();
    await wajibDokumenLengkap(params.id, s.email);
    const u = await bacaUnggahan(request, UKURAN_MAKS_TUGAS);
    const tugasId = u.field("tugasId");
    if (!tugasId) return fail("Tugas belum dipilih");
    await repo.unggahTugas(params.id, tugasId, u.berkas, s);
    return ok(await repo.getTugasPeserta(params.id, s.email), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}

const skemaKirim = z.object({ tugasId: z.string().min(1), aksi: z.literal("KIRIM") });

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const s = await sesiPeserta();
    await wajibDokumenLengkap(params.id, s.email);
    const parsed = skemaKirim.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await repo.kirimTugas(params.id, parsed.data.tugasId, s);
    return ok(await repo.getTugasPeserta(params.id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}
