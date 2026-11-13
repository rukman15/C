import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { diluarPeriode, isTanggalIsoValid, JP_SESI_MAKS, SESI_MAKS_PER_PERMINTAAN, totalJp, type SesiInput } from "@/lib/sesi";

/**
 * Sesi mengajar WI per penugasan — dasar rekap JP. Disalin dari repositories/sesi.ts aplikasi lama:
 * hanya untuk penugasan "disetujui"; total JP sesi tidak melebihi JP penugasan; tanggal di luar periode
 * TIDAK ditolak, hanya ditandai.
 */

export const sesiSchema = z.object({
  tanggal: z.string().refine(isTanggalIsoValid, "Tanggal harus berformat YYYY-MM-DD dan ada di kalender"),
  kegiatan: z.string().trim().min(1, "Nama kegiatan wajib diisi").max(200, "Nama kegiatan maksimal 200 karakter"),
  jp: z.number().int("JP harus bilangan bulat").min(1, "JP minimal 1").max(JP_SESI_MAKS, `JP satu sesi maksimal ${JP_SESI_MAKS}`),
  tempat: z.string().trim().max(120, "Tempat maksimal 120 karakter").optional(),
  keterangan: z.string().trim().max(300, "Keterangan maksimal 300 karakter").optional(),
});

export const sesiPostSchema = z.object({
  sesi: z.array(sesiSchema).min(1, "Minimal satu sesi").max(SESI_MAKS_PER_PERMINTAAN, `Maksimal ${SESI_MAKS_PER_PERMINTAAN} sesi sekali simpan`),
});

export type SesiMengajarRecord = {
  id: string;
  tanggal: string;
  kegiatan: string;
  jp: number;
  tempat: string;
  keterangan?: string;
  diluarPeriode: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const keDb = (t: string) => new Date(`${t}T00:00:00.000Z`);

async function penugasan(id: string) {
  const p = await prisma.penugasanApproval.findUnique({
    where: { id },
    include: { training: { select: { tempat: true, startDate: true, endDate: true } }, sesi: { select: { id: true, jp: true } } },
  });
  if (!p) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
  return p;
}

const keRecord = (r: { id: string; tanggal: Date; kegiatan: string; jp: number; tempat: string; keterangan: string | null }, t: { startDate: Date; endDate: Date | null }): SesiMengajarRecord => ({
  id: r.id,
  tanggal: iso(r.tanggal),
  kegiatan: r.kegiatan,
  jp: r.jp,
  tempat: r.tempat,
  keterangan: r.keterangan ?? undefined,
  diluarPeriode: diluarPeriode(iso(r.tanggal), iso(t.startDate), t.endDate ? iso(t.endDate) : null),
});

export async function listSesi(penugasanId: string): Promise<SesiMengajarRecord[]> {
  const p = await penugasan(penugasanId);
  const rows = await prisma.penugasanSesi.findMany({ where: { penugasanId }, orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => keRecord(r, p.training));
}

export async function tambahSesi(penugasanId: string, inputs: SesiInput[], dibuatOleh: string): Promise<void> {
  if (inputs.length === 0) throw new ValidationError("Tidak ada sesi untuk disimpan");
  const p = await penugasan(penugasanId);
  if (p.status !== "disetujui") throw new ConflictError("Sesi hanya bisa diisi untuk penugasan yang sudah disetujui Kepala Balai");
  const terpakai = totalJp(p.sesi);
  const total = terpakai + totalJp(inputs);
  if (total > p.jp) throw new ValidationError(`Total JP sesi (${total}) melebihi JP penugasan (${p.jp}). Sisa yang bisa diisi: ${Math.max(0, p.jp - terpakai)} JP.`);
  await prisma.$transaction(
    inputs.map((s) =>
      prisma.penugasanSesi.create({
        data: {
          penugasanId,
          tanggal: keDb(s.tanggal),
          kegiatan: s.kegiatan.trim(),
          jp: s.jp,
          tempat: s.tempat?.trim() || p.training.tempat,
          keterangan: s.keterangan?.trim() || null,
          dibuatOleh,
        },
      }),
    ),
  );
}

export async function hapusSesi(penugasanId: string, sesiId: string): Promise<void> {
  const { count } = await prisma.penugasanSesi.deleteMany({ where: { id: sesiId, penugasanId } });
  if (count === 0) throw new NotFoundError(`Sesi "${sesiId}" tidak ditemukan pada penugasan ini`);
}
