import { failFromError, ok } from "@/lib/server/http";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { bacaUnggahan } from "@/lib/server/berkas-unggah";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { dataJenisDokumen } from "@/lib/dokumen-peserta";
import * as dokRepo from "@/lib/server/repositories/dokumen-peserta";

/** Penyelenggara mengunggahkan berkas atas nama peserta: { pesertaId, jenis, berkas } (multipart atau titipan). */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await aksesDiklat();
    await wajibKelolaTraining(a, id);
    const u = await bacaUnggahan(request);
    const pesertaId = u.field("pesertaId");
    const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true, nama: true } });
    if (!p || p.trainingId !== id) throw new NotFoundError("Peserta tidak ditemukan");
    const jenis = u.field("jenis");
    const dokId = await dokRepo.unggahDokumen(pesertaId, jenis, u.berkas, { peran: "PENYELENGGARA", akunId: await dokRepo.akunIdDariEmail(a.email) });
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.DOKUMEN_DIUNGGAH, `Jadwal ${id}`, `${p.nama} · ${dataJenisDokumen(jenis)?.label ?? jenis}`);
    return ok({ id: dokId }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
