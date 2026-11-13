import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { hapusMasaTempatKerja, tambahMasaTempatKerja } from "@/lib/server/repositories/pembelajaran";
import { pesanZod, skemaAksiMasaTempatKerja } from "@/lib/data-pembelajaran";

/**
 * Masa peserta di tempat kerja (komitmen bersama, aktualisasi): hari di dalamnya tidak diperiksa
 * "tanpa sesi" pada presensi harian. POST { aksi: tambah | hapus } — Ketua Diklat (admin selalu boleh).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaAksiMasaTempatKerja.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "hapus") {
      await hapusMasaTempatKerja(id, d.id);
      return ok({ dihapus: true });
    }
    return ok({ id: await tambahMasaTempatKerja(id, d, s.email) }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
