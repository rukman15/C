import { failFromError, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getSuratKeterangan } from "@/lib/server/repositories/surat-keterangan";

/** Isi satu surat keterangan untuk halaman cetak (Ketua Diklat, Kepala Balai, Kabag TU; admin). */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    return ok(await getSuratKeterangan(id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}
