import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pelakuEvaluasi } from "@/lib/server/pelaku-evaluasi";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaAksiEvaluasi } from "@/lib/server/skema-evaluasi";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { selCsv } from "@/lib/tes";
import * as evRepo from "@/lib/server/repositories/evaluasi";

/**
 * Evaluasi tenaga pelatihan satu jadwal (rekap Formulir 22) dan penyelenggaraan (23B), sama dengan aplikasi lama.
 *  GET  — Ketua Diklat & admin (kelola), Kepala Balai & Kabag TU (lihat). ?format=csv[&formulir=23b] → unduh.
 *  POST — { aksi: tambah | hapus | tutup | buka } — Ketua Diklat & admin.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const d = await evRepo.getRekapEvaluasi(id, await pelakuEvaluasi(["ketua-diklat", "kepala-balai", "kabag-tu"]));
    const u = new URL(request.url);
    if (u.searchParams.get("format") === "csv") {
      const f23 = u.searchParams.get("formulir") === "23b";
      const nama =
        `rekap-evaluasi-${f23 ? "penyelenggaraan" : "pengajar"}-${d.training.jenisPelatihan ?? "diklat"}${d.training.angkatan ? "-" + d.training.angkatan : ""}.csv`.replace(
          /[^\w.-]+/g,
          "-",
        );
      return new Response(f23 ? evRepo.csvRekap23B(d, selCsv) : evRepo.csvRekap(d, selCsv), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${nama}"`, "cache-control": "no-store" },
      });
    }
    return ok(d);
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await pelakuEvaluasi(["ketua-diklat"]);
    const parsed = skemaAksiEvaluasi.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if (d.aksi === "tambah") {
      const sid = await evRepo.tambahSasaran(id, d, p);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.EVALUASI_SASARAN, `Jadwal ${id}`, `Tambah ${d.formulir}: ${d.nama}`);
      return ok({ id: sid }, { status: 201 });
    }
    if (d.aksi === "hapus") {
      const nama = await evRepo.hapusSasaran(id, d.id, p);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.EVALUASI_SASARAN, `Jadwal ${id}`, `Hapus: ${nama}`);
      return ok({ dihapus: true });
    }
    await evRepo.setEvaluasiDitutup(id, d.aksi === "tutup", p);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.EVALUASI_STATUS, `Jadwal ${id}`, d.aksi === "tutup" ? "ditutup" : "dibuka");
    return ok({ ditutup: d.aksi === "tutup" });
  } catch (e) {
    return failFromError(e);
  }
}
