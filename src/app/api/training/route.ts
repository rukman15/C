import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { timDiklatPegawai } from "@/lib/server/akses";
import { ForbiddenError } from "@/lib/server/errors";
import { kelolaGlobal, periksaTimTujuan } from "@/lib/tim-kerja";
import { skemaTraining } from "@/lib/skema-training";
import { createTraining } from "@/lib/server/repositories/training";

/**
 * Tambah jadwal diklat. Aturan sama dengan POST /api/training aplikasi lama:
 * Ketua Diklat/admin (tim bebas), atau anggota tim berwenang "tugaskan-wi" untuk timnya sendiri.
 */
export async function POST(request: Request) {
  try {
    const s = await requireRole([]);
    const tim = await timDiklatPegawai(s.pegawaiId);
    const global = kelolaGlobal(s.role);
    if (!global && tim.length === 0) throw new ForbiddenError();

    const parsed = skemaTraining.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));

    const timIds = tim.map((t) => t.id);
    const tolak = periksaTimTujuan({ role: s.role, timIds }, parsed.data.timKerjaId ?? null);
    if (tolak) return fail(tolak, timIds.length && parsed.data.timKerjaId ? 403 : 400);

    return ok(await createTraining(parsed.data), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
