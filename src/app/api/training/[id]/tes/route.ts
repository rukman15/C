import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaAksiTes, skemaSimpanTes } from "@/lib/server/skema-tes";
import { pelakuTes } from "@/lib/server/pelaku-tes";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { LABEL_JENIS_TES, selCsv } from "@/lib/tes";
import * as tesRepo from "@/lib/server/repositories/tes";

/**
 * Pre-test & post-test satu jadwal PKA/PKP (sama dengan aplikasi lama).
 *  GET  — Ketua Diklat & admin (kelola), Kepala Balai & Kabag TU (lihat hasil). ?format=csv → unduh hasil.
 *  PUT  — simpan pengaturan satu tes.  POST — aksi: susun | salin-pre | terbitkan | tutup | buka-lagi | kembali-draf | reset.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const d = await tesRepo.getKelolaTes(id, await pelakuTes(["ketua-diklat", "kepala-balai", "kabag-tu"]));
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const nama = `hasil-pre-post-${d.training.jenisPelatihan}${d.training.angkatan ? "-" + d.training.angkatan : ""}.csv`.replace(/[^\w.-]+/g, "-");
      return new Response(tesRepo.csvHasil(d, selCsv), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${nama}"`, "cache-control": "no-store" },
      });
    }
    return ok(d);
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await pelakuTes(["ketua-diklat"]);
    const parsed = skemaSimpanTes.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const { jenis, ...isi } = parsed.data;
    await tesRepo.simpanTes(id, jenis, isi, p);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.TES_DIATUR, `${LABEL_JENIS_TES[jenis]} jadwal ${id}`, `${isi.soalIds.length} soal, ${isi.durasiMenit} menit`);
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await pelakuTes(["ketua-diklat"]);
    const parsed = skemaAksiTes.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    const sasaran = `${LABEL_JENIS_TES[d.jenis]} jadwal ${id}`;
    if (d.aksi === "reset") {
      const nama = await tesRepo.resetPengerjaan(id, d.jenis, d.pesertaId, p);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.TES_DIRESET, sasaran, `Peserta: ${nama}`);
      return ok({ direset: true });
    }
    const hasil = await tesRepo.aksiTes(id, d.jenis, d.aksi, { jumlah: "jumlah" in d ? d.jumlah : undefined }, p);
    if (d.aksi !== "susun" && d.aksi !== "salin-pre") await catatAudit(await pelakuSesi(), AKSI_AUDIT.TES_STATUS, sasaran, `${d.aksi} → ${hasil.status}`);
    return ok(hasil);
  } catch (e) {
    return failFromError(e);
  }
}
