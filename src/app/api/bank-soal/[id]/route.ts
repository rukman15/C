import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaUbahSoal } from "@/lib/server/skema-tes";
import { pelakuTes } from "@/lib/server/pelaku-tes";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import * as tesRepo from "@/lib/server/repositories/tes";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Satu soal di bank.
 *  PATCH { aksi, catatan } — periksa (setujui/kembalikan/nonaktifkan/aktifkan): admin & Ketua Diklat.
 *  PATCH { pertanyaan, opsi, kunci, ... } — ubah isi: penyelenggara, atau WI untuk soalnya
 *        yang belum disetujui. Soal yang sudah dipakai tes terbit/dikerjakan dikunci.
 *  DELETE — hapus soal yang belum masuk paket tes mana pun.
 */
export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pelakuTes(["ketua-diklat", "widyaiswara"]);
    const parsed = skemaUbahSoal.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    if ("aksi" in d && d.aksi) {
      const status = await tesRepo.periksaSoalBank(params.id, d.aksi, d.catatan, p);
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.SOAL_DIPERIKSA, `Soal ${params.id}`, `${d.aksi} → ${status}${d.catatan ? `: ${d.catatan}` : ""}`);
      return ok({ status });
    }
    await tesRepo.ubahSoal(params.id, d as tesRepo.UbahSoal, p);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.SOAL_DIUBAH, `Soal ${params.id}`);
    return ok({ diubah: true });
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pelakuTes(["ketua-diklat", "widyaiswara"]);
    await tesRepo.hapusSoal(params.id, p);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.SOAL_DIHAPUS, `Soal ${params.id}`);
    return ok({ dihapus: true });
  } catch (e) {
    return failFromError(e);
  }
}
