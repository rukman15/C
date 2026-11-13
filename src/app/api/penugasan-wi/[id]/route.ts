import { failFromError, ok } from "@/lib/server/http";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { NotFoundError } from "@/lib/server/errors";
import { prisma } from "@/lib/server/prisma";
import { hapusPengampu, tetapkanPengajuanLama } from "@/lib/server/repositories/pengampu";

type Ctx = { params: Promise<{ id: string }> };

/** Hak: pengelola diklat tempat penugasan ini berada (Ketua Diklat/admin atau tim pemegangnya). */
async function wajibKelolaPenugasan(id: string) {
  const a = await aksesDiklat();
  const p = await prisma.penugasanApproval.findUnique({ where: { id }, select: { trainingId: true } });
  if (!p) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
  await wajibKelolaTraining(a, p.trainingId);
  return a;
}

/** Tetapkan pengajuan lama yang masih "menunggu". */
export async function PATCH(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaPenugasan(id);
    await tetapkanPengajuanLama(id, a.email);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await wajibKelolaPenugasan(id);
    await hapusPengampu(id);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}
