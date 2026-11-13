import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pesanZod, skemaAksiKelompok } from "@/lib/server/skema-lms";
import * as kelRepo from "@/lib/server/repositories/kelompok";
import { JENIS_KELOMPOK_BAWAAN, isJenisKelompok } from "@/lib/kelompok";

/**
 * Kelompok peserta satu jadwal PKA/PKP per jenis kegiatan (?jenis=ELEARNING|SEMINAR|STULA|MANDIRI), sama dengan aplikasi
 * lama ditambah revisi EB-046 s/d EB-050.
 *  GET  — Ketua Diklat & admin (kelola), Kepala Balai & Kabag TU (lihat).
 *  POST — { aksi: jumlah | bagi | ubah | pindah | kategori-peserta } — Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { role } = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    const j = new URL(request.url).searchParams.get("jenis");
    return ok(await kelRepo.getKelompok(id, role === "admin" || role === "ketua-diklat", isJenisKelompok(j) ? j : JENIS_KELOMPOK_BAWAAN));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    const parsed = skemaAksiKelompok.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "jumlah") await kelRepo.aturJumlah(id, d.jenis, d.jumlah);
    else if (d.aksi === "bagi") return ok({ dibagi: await kelRepo.bagiOtomatis(id, d.jenis, d.jumlah) });
    else if (d.aksi === "ubah") await kelRepo.ubahKelompok(id, d.id, d);
    else if (d.aksi === "kategori-peserta") await kelRepo.aturKategoriPeserta(id, d.pesertaId, d.kategori);
    else await kelRepo.pindahPeserta(id, d.jenis, d.pesertaId, d.kelompokId);
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
