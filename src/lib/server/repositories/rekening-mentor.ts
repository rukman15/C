import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { AKSI_AUDIT, catatAudit, type Pelaku } from "@/lib/server/audit";
import { mentorPeserta } from "@/lib/server/repositories/penugasan-angkatan";
import { periksaRekening, samarkan, statusRekening, type IsianRekening, type StatusRekening } from "@/lib/rekening-mentor";

/**
 * Rekening mentor daring (EB-045). Peserta mengisi/mengubah kapan saja di "Mentor saya" bila mentornya hadir daring pada
 * seminar; isian melekat pada mentor (ganti mentor → isi ulang, ditimpa). Nomor lengkap hanya untuk admin & Ketua Diklat
 * lewat bukaRekening (tercatat di log audit); peserta dan daftar pengelola melihat tersamar.
 */
export type RekeningSayaRecord = {
  status: StatusRekening;
  mentorNama: string | null;
  rekening: { namaBank: string; nomorSamar: string; atasNama: string; ponselSamar: string; diperbarui: string } | null;
};

async function pesertaSendiri(pesertaId: string, email: string) {
  const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { id: true, trainingId: true, status: true, akun: { select: { email: true } } } });
  if (!p) throw new NotFoundError("Peserta tidak ditemukan");
  if (!p.akun || p.akun.email !== email) throw new ForbiddenError("Ini bukan ruang belajar Anda.");
  return p;
}

const mentorDaring = async (pesertaId: string) => !!(await prisma.seminarPeserta.findFirst({ where: { pesertaId, mentorHadir: "DARING" }, select: { id: true } }));

export async function rekeningSaya(pesertaId: string, email: string): Promise<RekeningSayaRecord> {
  const p = await pesertaSendiri(pesertaId, email);
  const [mentor, daring, r] = await Promise.all([mentorPeserta(p.trainingId, pesertaId), mentorDaring(pesertaId), prisma.rekeningMentor.findUnique({ where: { pesertaId } })]);
  const status = statusRekening({ mentorDaring: daring, mentorNama: mentor.nama, rekening: r });
  return {
    status,
    mentorNama: mentor.nama,
    rekening:
      r && status === "TERISI"
        ? { namaBank: r.namaBank, nomorSamar: samarkan(r.nomorRekening), atasNama: r.atasNama, ponselSamar: samarkan(r.ponsel), diperbarui: r.updatedAt.toISOString() }
        : null,
  };
}

export async function simpanRekeningSaya(pesertaId: string, email: string, isian: IsianRekening): Promise<RekeningSayaRecord> {
  const p = await pesertaSendiri(pesertaId, email);
  if (p.status !== "AKTIF") throw new ForbiddenError("Hanya peserta aktif.");
  if (!(await mentorDaring(pesertaId))) throw new ForbiddenError("Rekening hanya diisi bila mentor Anda hadir daring (Zoom) pada seminar.");
  const mentor = await mentorPeserta(p.trainingId, pesertaId);
  if (!mentor.nama) throw new ValidationError("Usulkan mentor Anda dulu.");
  const h = periksaRekening(isian);
  if ("galat" in h) throw new ValidationError(h.galat);
  const data = { ...h.rapi, mentorNama: mentor.nama, diubahOleh: email };
  await prisma.rekeningMentor.upsert({ where: { pesertaId }, create: { pesertaId, trainingId: p.trainingId, ...data }, update: data });
  return rekeningSaya(pesertaId, email);
}

/** Status rekening per peserta satu jadwal (untuk tab Seminar). */
export async function statusRekeningJadwal(trainingId: string): Promise<Record<string, StatusRekening>> {
  const daring: { pesertaId: string }[] = await prisma.seminarPeserta.findMany({
    where: { trainingId, mentorHadir: "DARING" },
    select: { pesertaId: true },
    distinct: ["pesertaId"],
  });
  if (!daring.length) return {};
  const rek = await prisma.rekeningMentor.findMany({ where: { trainingId, pesertaId: { in: daring.map((d) => d.pesertaId) } }, select: { pesertaId: true, mentorNama: true } });
  const hasil: Record<string, StatusRekening> = {};
  for (const d of daring) {
    const m = await mentorPeserta(trainingId, d.pesertaId);
    hasil[d.pesertaId] = statusRekening({ mentorDaring: true, mentorNama: m.nama, rekening: rek.find((r) => r.pesertaId === d.pesertaId) ?? null });
  }
  return hasil;
}

export type RekeningLengkapRecord = IsianRekening & { mentorNama: string; berlaku: boolean; peserta: string; diperbarui: string };

/** Nomor lengkap untuk admin & Ketua Diklat; setiap pembukaan dicatat di log audit. */
export async function bukaRekening(trainingId: string, pesertaId: string, pelaku: Pelaku): Promise<RekeningLengkapRecord> {
  const r = await prisma.rekeningMentor.findUnique({ where: { pesertaId }, include: { peserta: { select: { nama: true } } } });
  if (!r || r.trainingId !== trainingId) throw new NotFoundError("Rekening mentor belum diisi peserta");
  const m = await mentorPeserta(trainingId, pesertaId);
  await catatAudit(pelaku, AKSI_AUDIT.REKENING_MENTOR_DIBUKA, `peserta:${pesertaId}`, `Mentor ${r.mentorNama} (${r.peserta.nama})`);
  return {
    namaBank: r.namaBank,
    nomorRekening: r.nomorRekening,
    atasNama: r.atasNama,
    ponsel: r.ponsel,
    mentorNama: r.mentorNama,
    berlaku: statusRekening({ mentorDaring: true, mentorNama: m.nama, rekening: r }) === "TERISI",
    peserta: r.peserta.nama,
    diperbarui: r.updatedAt.toISOString(),
  };
}
