import { failFromError, fail, ok } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { tambahKunjungan } from "@/lib/server/repositories/stula";

/**
 * Catat advance kunjungan lokasi stula (EB-053) — multipart { lokasiId, tanggal, petugas, hasil, berkas? }.
 * Berkas opsional: PDF/JPG/PNG maks 10 MB. Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };
const MAKS = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    if (Number(request.headers.get("content-length") ?? "0") > MAKS + 64 * 1024) return fail("Ukuran berkas maksimal 10 MB");
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("Kiriman tidak terbaca");
    }
    const f = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : "";
    };
    const b = form.get("berkas");
    const berkas = b && typeof b !== "string" && b.size > 0 ? { nama: b.name, tipe: b.type, isi: new Uint8Array(await b.arrayBuffer()) } : null;
    const kunjunganId = await tambahKunjungan(id, f("lokasiId"), { tanggal: f("tanggal"), petugas: f("petugas"), hasil: f("hasil") }, berkas, s.email);
    return ok({ id: kunjunganId }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
