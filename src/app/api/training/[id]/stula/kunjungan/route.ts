import { failFromError, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { bacaUnggahanOpsional } from "@/lib/server/berkas-unggah";
import { tambahKunjungan } from "@/lib/server/repositories/stula";

/**
 * Catat advance kunjungan lokasi stula (EB-053) — { lokasiId, tanggal, petugas, hasil, berkas? } sebagai multipart atau
 * JSON dengan `titipan` (unggah langsung ke Supabase). Berkas opsional: PDF/JPG/PNG maks 10 MB. Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const u = await bacaUnggahanOpsional(request, 10 * 1024 * 1024);
    const kunjunganId = await tambahKunjungan(id, u.field("lokasiId"), { tanggal: u.field("tanggal"), petugas: u.field("petugas"), hasil: u.field("hasil") }, u.berkas, s.email);
    return ok({ id: kunjunganId }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
