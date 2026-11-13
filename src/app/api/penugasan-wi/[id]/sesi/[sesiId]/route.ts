import { failFromError, ok } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { ForbiddenError } from "@/lib/server/errors";
import { hapusSesi } from "@/lib/server/repositories/sesi-mengajar";

/** Hapus satu sesi mengajar: Ketua Diklat, Koordinator WI (admin selalu boleh). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sesiId: string }> }) {
  try {
    const { id, sesiId } = await params;
    const a = await aksesDiklat();
    if (a.role !== "admin" && a.role !== "ketua-diklat" && !a.koordinatorWi) throw new ForbiddenError();
    await hapusSesi(id, sesiId);
    return ok({ id: sesiId });
  } catch (e) {
    return failFromError(e);
  }
}
