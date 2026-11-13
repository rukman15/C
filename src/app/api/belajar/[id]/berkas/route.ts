import { failFromError, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { bacaUnggahan } from "@/lib/server/berkas-unggah";
import { catatAktivitasPeserta } from "@/lib/server/aktivitas";
import { getFolderBerkas, unggahBerkasPeserta } from "@/lib/server/repositories/berkas-peserta";
import { UKURAN_MAKS_BERKAS } from "@/lib/berkas-peserta";

/**
 * Folder peserta (EB-051): bahan tayang RAP/LAP dan sertifikat self learning.
 *  GET  — daftar berkas (peserta sendiri; Ketua Diklat, Kepala Balai, admin sebagai pratinjau).
 *  POST — multipart { jenis, berkas } — unggah/ganti (hanya peserta sendiri, maks 20 MB).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["peserta", "ketua-diklat", "kepala-balai"]);
    return ok(await getFolderBerkas(id, s.role === "peserta" ? { pratinjau: false, email: s.email } : { pratinjau: true }));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["peserta"]);
    const u = await bacaUnggahan(request, UKURAN_MAKS_BERKAS);
    const r = await unggahBerkasPeserta(id, u.field("jenis"), u.berkas, s.email);
    await catatAktivitasPeserta(id, {
      aktor: s,
      jenis: "DOKUMEN_DIUNGGAH",
      objekTipe: "dokumen",
      objekId: r.id,
      ringkasan: (nama) => `${nama} mengunggah ${r.label.toLowerCase()}`,
    });
    return ok({ id: r.id }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
