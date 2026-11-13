import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { aksesDiklat, pembacaSemua, wajibKelolaTraining } from "@/lib/server/akses";
import { periksaTimTujuan } from "@/lib/tim-kerja";
import { skemaTraining } from "@/lib/skema-training";
import { deleteTraining, updateTraining } from "@/lib/server/repositories/training";
import { getRincian } from "@/lib/server/repositories/rincian";

/**
 * Satu jadwal diklat. Wewenang sama dengan aplikasi lama (src/routes/api/training/[id]):
 * dibaca Ketua Diklat, Kepala Balai, Koordinator WI, Admin Penyelenggara, dan tim pemegangnya;
 * diubah Ketua Diklat/admin atau tim pemegangnya; dihapus Ketua Diklat (admin selalu boleh).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await aksesDiklat();
    if (!pembacaSemua(a, ["kepala-balai"])) await wajibKelolaTraining(a, id);
    return ok(await getRincian(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await aksesDiklat();
    await wajibKelolaTraining(a, id);
    const parsed = skemaTraining.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const tolak = periksaTimTujuan(a, parsed.data.timKerjaId);
    if (tolak) return fail(tolak, 403);
    return ok(await updateTraining(id, parsed.data));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    await deleteTraining(id);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}
