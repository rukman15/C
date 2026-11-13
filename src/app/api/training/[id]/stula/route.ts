import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pesanZod } from "@/lib/server/skema-lms";
import * as stula from "@/lib/server/repositories/stula";

/**
 * Studi lapangan satu jadwal (EB-049, EB-050, EB-053).
 *  GET  — Ketua Diklat & admin (kelola), Kepala Balai & Kabag TU (lihat).
 *  POST — { aksi: simpan-lokasi | hapus-lokasi | cocokkan | hapus-kunjungan } — Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };

const opsional = (n: number) => z.string().max(n).nullish();
const skema = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("simpan-lokasi"),
    id: z.string().min(1).nullish(),
    nama: z.string().min(1, "Nama lokasi wajib diisi").max(150),
    kategori: opsional(40),
    alamat: opsional(300),
    narahubungNama: opsional(150),
    narahubungPonsel: opsional(30),
    status: z.string().max(20).optional(),
    catatan: opsional(1000),
    ketuaTimPegawaiId: opsional(64),
    ketuaTimNama: opsional(150),
    kelompokId: z.string().max(64).nullable().optional(),
  }),
  z.object({ aksi: z.literal("hapus-lokasi"), id: z.string().min(1) }),
  z.object({ aksi: z.literal("cocokkan") }),
  z.object({ aksi: z.literal("hapus-kunjungan"), id: z.string().min(1) }),
]);

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { role } = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    return ok(await stula.getStula(id, role === "admin" || role === "ketua-diklat"));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "simpan-lokasi") {
      const { aksi: _a, id: lokasiId, ...isian } = d;
      return ok({ id: await stula.simpanLokasi(id, lokasiId ?? null, isian, s.email) });
    }
    if (d.aksi === "hapus-lokasi") await stula.hapusLokasi(id, d.id);
    else if (d.aksi === "hapus-kunjungan") await stula.hapusKunjungan(id, d.id);
    else return ok({ dipasangkan: await stula.cocokkanOtomatis(id) });
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
