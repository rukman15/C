import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { pesanZod, skemaAksiDokumen } from "@/lib/server/skema-lms";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";

/**
 * Dokumen persyaratan peserta satu jadwal PKA/PKP (sama dengan aplikasi lama) — penyelenggara pemegang diklat saja
 * (data sensitif, pimpinan tidak). GET: semua peserta + status berkas. POST { aksi: verifikasi | batas | jalur }.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await wajibKelolaTraining(await aksesDiklat(), id);
    return ok(await dokRepo.getDokumenJadwal(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await aksesDiklat();
    await wajibKelolaTraining(a, id);
    const parsed = skemaAksiDokumen.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "verifikasi") {
      const teks = await dokRepo.verifikasiDokumen(id, d.dokumenId, d, await dokRepo.akunIdDariEmail(a.email));
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.DOKUMEN_DIVERIFIKASI, `Jadwal ${id}`, teks);
    } else if (d.aksi === "batas") {
      await dokRepo.aturBatasDokumen(id, d.tanggal);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.DOKUMEN_PENGATURAN, `Jadwal ${id}`, d.tanggal ? `Wajib dokumen, batas ${d.tanggal}` : "Tidak mewajibkan dokumen");
    } else {
      const nama = await dokRepo.aturJalur(id, d.pesertaId, d.jalur);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.DOKUMEN_PENGATURAN, `Jadwal ${id}`, `Jalur ${nama}: ${d.jalur}`);
    }
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
