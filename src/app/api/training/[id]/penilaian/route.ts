import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { penilaiSesi } from "@/lib/server/penilai";
import { pesanZod } from "@/lib/server/skema-lms";
import * as penilaianRepo from "@/lib/server/repositories/penilaian";

/**
 * Lembar penilaian peserta PKA/PKP, sama dengan aplikasi lama.
 *  GET — Ketua Diklat & admin (semua nilai + rekap kelulusan), Kepala Balai (lihat saja),
 *        Widyaiswara yang penugasannya disetujui pada jadwal ini (hanya aspek & isiannya sendiri).
 *  PUT — Ketua Diklat/admin (nilai rekap + remedial) atau Widyaiswara tadi (nilai aspek bagiannya).
 * Admin tetap boleh melihat & mengubah nilai (EB-033). Admin Penyelenggara (EB-034): "ubah-nilai" = seperti Ketua
 * Diklat; "lihat-nilai" = lihat saja.
 */
type Ctx = { params: Promise<{ id: string }> };

const skemaSimpanNilai = z.object({
  nilai: z
    .array(
      z.object({
        pesertaId: z.string().min(1),
        kodeAspek: z.string().min(1).max(60),
        // Bentuk & rentangnya diperiksa bacaNilai() di repository (pesannya lebih jelas).
        nilai: z.union([z.number(), z.string().max(10)]).nullable(),
      }),
    )
    .min(1, "Tidak ada nilai yang dikirim")
    .max(2000, "Terlalu banyak nilai sekali simpan"),
});

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return ok(await penilaianRepo.getLembarPenilaian(id, await penilaiSesi("baca")));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const penilai = await penilaiSesi("ubah");
    const parsed = skemaSimpanNilai.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await penilaianRepo.simpanNilai(id, parsed.data.nilai, penilai));
  } catch (e) {
    return failFromError(e);
  }
}
