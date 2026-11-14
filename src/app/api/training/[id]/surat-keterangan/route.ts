import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pesanZod, skemaAksiSuratKeterangan } from "@/lib/server/skema-lms";
import * as skRepo from "@/lib/server/repositories/surat-keterangan";

/**
 * Surat keterangan ditunda/tidak lulus satu jadwal PKA/PKP (sama dengan aplikasi lama).
 *  GET  — peserta yang berhak + surat yang sudah dibuat. Ketua Diklat & admin (kelola), Kepala Balai & Kabag TU (lihat).
 *  POST — { aksi: simpan | hapus } — Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    return ok(await skRepo.daftarSuratKeterangan(id, s.role === "admin" || s.role === "ketua-diklat", s.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaAksiSuratKeterangan.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "hapus") {
      await skRepo.hapusSuratKeterangan(id, d.id);
      return ok({ dihapus: true });
    }
    return ok({ id: await skRepo.simpanSuratKeterangan(id, d, s.email) });
  } catch (e) {
    return failFromError(e);
  }
}
