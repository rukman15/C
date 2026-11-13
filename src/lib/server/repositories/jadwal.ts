import "server-only";
import { prisma } from "@/lib/server/prisma";
import { sinkronStatusTraining } from "@/lib/server/repositories/training";
import { isoTanggal } from "@/lib/tanggal";
import { namaMataPelatihan } from "@/lib/kurikulum";
import { WEWENANG_TUGASKAN_WI, type TimDiklat } from "@/lib/tim-kerja";
import type { DataJadwal, JadwalDiklat, JadwalMengajar } from "@/lib/jadwal";

/** Banyaknya diklat selesai (terbaru) yang ikut ditampilkan, sama dengan aplikasi lama. */
const SELESAI_DITAMPILKAN = 10;

/**
 * Kalender diklat (informasi umum, untuk semua peran) + jadwal mengajar milik pegawai yang login.
 * Logika sama dengan getJadwal() di aplikasi lama. Penugasan yang ditolak tidak ditampilkan.
 */
export async function getJadwal(pegawaiId: string | null): Promise<DataJadwal> {
  await sinkronStatusTraining();

  const [aktif, selesai, penugasan] = await Promise.all([
    prisma.training.findMany({ where: { status: { not: "Selesai" } }, orderBy: { startDate: "asc" } }),
    prisma.training.findMany({ where: { status: "Selesai" }, orderBy: { startDate: "desc" }, take: SELESAI_DITAMPILKAN }),
    pegawaiId
      ? prisma.penugasanApproval.findMany({
          where: { instructorId: pegawaiId, status: { in: ["menunggu", "disetujui"] } },
          include: {
            training: { select: { id: true, name: true, startDate: true, endDate: true, tempat: true, jenisPelatihan: true, modePelatihan: true } },
            sesi: { select: { id: true, tanggal: true, kegiatan: true, jp: true, tempat: true, createdAt: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const keDiklat = (t: (typeof aktif)[number]): JadwalDiklat => ({
    id: t.id,
    name: t.name,
    category: t.category,
    participants: t.participants,
    startDate: isoTanggal(t.startDate),
    endDate: t.endDate ? isoTanggal(t.endDate) : undefined,
    tempat: t.tempat,
    status: t.status as JadwalDiklat["status"],
  });

  const mengajar: JadwalMengajar[] = penugasan
    .map((p) => {
      const sesi = [...p.sesi].sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
      return {
        id: p.id,
        trainingId: p.training.id,
        trainingName: p.training.name,
        startDate: isoTanggal(p.training.startDate),
        endDate: p.training.endDate ? isoTanggal(p.training.endDate) : undefined,
        tempat: p.training.tempat,
        jp: p.jp,
        status: p.status as JadwalMengajar["status"],
        mataPelatihanNama: namaMataPelatihan(p.mataPelatihan) ?? undefined,
        adaPenilaian: !!p.training.jenisPelatihan && !!p.training.modePelatihan,
        jpSesi: sesi.reduce((n, s) => n + s.jp, 0),
        sesi: sesi.map((s) => ({ id: s.id, tanggal: isoTanggal(s.tanggal), kegiatan: s.kegiatan, jp: s.jp, tempat: s.tempat })),
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.trainingName.localeCompare(b.trainingName, "id"));

  return { diklat: [...aktif, ...selesai].map(keDiklat), mengajar: pegawaiId ? mengajar : null };
}

/**
 * Pilihan "Tim kerja pemegang" di form tambah jadwal (sama dengan /api/diklat-tim aplikasi lama):
 * Ketua Diklat/admin = semua tim berwenang "tugaskan-wi" (boleh tanpa tim); anggota tim = timnya saja.
 */
export async function pilihanTimDiklat(global: boolean, timSendiri: TimDiklat[]): Promise<TimDiklat[]> {
  if (!global) return timSendiri;
  return prisma.timKerja.findMany({
    where: { wewenang: { has: WEWENANG_TUGASKAN_WI } },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  });
}
