import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { wajibBacaSurat, wajibKelolaSurat } from "@/lib/server/akses-dokumen";
import { bawaanSuratTugas, buatSuratTugas, listSuratTugas } from "@/lib/server/repositories/dokumen";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { prisma } from "@/lib/server/prisma";
import { skemaSuratTugas } from "@/lib/server/skema-dokumen";

type Ctx = { params: Promise<{ id: string }> };

/** Surat tugas mengajar satu jadwal diklat: daftar + isian bawaan (GET), buat (POST). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await wajibBacaSurat(params.id);
    const t = await prisma.training.findUnique({ where: { id: params.id }, select: { timKerjaId: true } });
    const [bawaan, surat] = await Promise.all([bawaanSuratTugas(params.id), listSuratTugas(params.id)]);
    return ok({ bawaan, surat, bolehKelola: bolehKelolaDiklat(a, t?.timKerjaId ?? null) });
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await wajibKelolaSurat(params.id);
    const parsed = skemaSuratTugas.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatSuratTugas(params.id, parsed.data, a.email), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
