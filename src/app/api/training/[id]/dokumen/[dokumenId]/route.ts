import { failFromError } from "@/lib/server/http";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";

/** Penyelenggara membuka satu berkas: dialihkan ke tautan berjangka (60 detik); setiap pembukaan dicatat di Log Audit. */
type Ctx = { params: Promise<{ id: string; dokumenId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id, dokumenId } = await params;
    const a = await aksesDiklat();
    await wajibKelolaTraining(a, id);
    const t = await dokRepo.tautanDokumen(dokumenId, { peran: "PENYELENGGARA", akunId: await dokRepo.akunIdDariEmail(a.email) }, id);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.DOKUMEN_DIUNDUH, `Jadwal ${id}`, `${t.audit}${t.sensitif ? " (sensitif)" : ""}`);
    return Response.redirect(new URL(t.url, request.url), 303);
  } catch (e) {
    return failFromError(e);
  }
}
