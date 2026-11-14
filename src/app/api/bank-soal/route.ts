import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaTambahSoal } from "@/lib/server/skema-tes";
import { pelakuTes } from "@/lib/server/pelaku-tes";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import * as tesRepo from "@/lib/server/repositories/tes";

/**
 * Bank soal pre/post-test.
 *  GET  — admin & Ketua Diklat: semua soal; Widyaiswara: soal susunannya sendiri.
 *  POST — tambah satu/banyak soal (impor tempelan Excel). Admin/Ketua Diklat: langsung
 *         "Siap dipakai" (boleh atas nama WI lewat `penyusun`); WI: "Menunggu diperiksa".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const p = await pelakuTes(["ketua-diklat", "widyaiswara"]);
    return ok(await tesRepo.getBankSoal(p, { program: url.searchParams.get("program") ?? undefined }));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pelakuTes(["ketua-diklat", "widyaiswara"]);
    const parsed = skemaTambahSoal.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const hasil = await tesRepo.tambahSoal(parsed.data, p);
    if (hasil.dibuat > 0) {
      await catatAudit(
        await pelakuSesi(),
        AKSI_AUDIT.SOAL_DITAMBAH,
        `Bank soal ${parsed.data.program}`,
        `${hasil.dibuat} soal${parsed.data.penyusun ? ` atas nama ${parsed.data.penyusun}` : ""}${hasil.dilewati.length ? `, ${hasil.dilewati.length} dilewati` : ""}`,
      );
    }
    return ok(hasil, { status: hasil.dibuat > 0 ? 201 : 200 });
  } catch (e) {
    return failFromError(e);
  }
}
