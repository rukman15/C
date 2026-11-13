import { ok, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { bacaUnggahan } from "@/lib/server/berkas-unggah";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";
import { catatAktivitasPeserta } from "@/lib/server/aktivitas";
import { dataJenisDokumen } from "@/lib/dokumen-peserta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Dokumen persyaratan milik PESERTA sendiri (`id` = Peserta.id).
 *  GET  — daftar berkas wajib + status.
 *  POST — multipart { jenis, berkas } — unggah/ganti satu berkas (PDF/JPG/PNG ≤ 2 MB).
 */
async function siapa(): Promise<dokRepo.PeranDokumen> {
  await requireRole(["peserta"]);
  const s = (await getActiveSession());
  if (!s) throw new UnauthorizedError();
  return { peran: "PESERTA", akunId: await dokRepo.akunIdDariEmail(s.email) };
}

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    return ok(await dokRepo.getDokumenPeserta(params.id, await siapa()));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const s = await siapa();
    const u = await bacaUnggahan(request);
    const id = await dokRepo.unggahDokumen(params.id, u.field("jenis"), u.berkas, s);
    const sesi = (await getActiveSession());
    if (sesi) {
      const label = dataJenisDokumen(u.field("jenis"))?.label ?? "dokumen";
      await catatAktivitasPeserta(params.id, { aktor: sesi, jenis: "DOKUMEN_DIUNGGAH", objekTipe: "dokumen", objekId: id, ringkasan: (nama) => `${nama} mengunggah ${label}` });
    }
    return ok({ id }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
