import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { sinkronStatusTraining } from "@/lib/server/repositories/training";
import { BATAS_JENJANG_KOSONG, batasEfektif, bulanDari, melebihiKapasitas, type BatasJenjang } from "@/lib/kapasitas";
import { namaMataPelatihan } from "@/lib/kurikulum";
import { isoTanggal } from "@/lib/tanggal";
import { jenjangWi, rentangBulan } from "@/lib/wi";
import type { Pengampu, RincianDiklat } from "@/lib/rincian";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Batas JP per jenjang WI (pengaturan admin). Belum ada baris pengaturan = semua kosong. */
async function batasJenjang(): Promise<BatasJenjang> {
  const r = await prisma.pengaturanJp.findUnique({ where: { id: "singleton" } });
  if (!r) return { ...BATAS_JENJANG_KOSONG };
  return { pertama: r.batasWiPertama ?? null, muda: r.batasWiMuda ?? null, madya: r.batasWiMadya ?? null, utama: r.batasWiUtama ?? null };
}

/** JP penugasan DISETUJUI per WI pada diklat yang mulai di `bulan` ("YYYY-MM"). */
async function jpBulan(bulan: string, ids: string[]): Promise<Map<string, number>> {
  const r = rentangBulan(bulan);
  const rows = await prisma.penugasanApproval.findMany({
    where: { status: "disetujui", instructorId: { in: ids }, training: { startDate: { gte: utc(r.awal), lt: utc(r.akhirEksklusif) } } },
    select: { instructorId: true, jp: true },
  });
  const m = new Map<string, number>();
  for (const x of rows) m.set(x.instructorId, (m.get(x.instructorId) ?? 0) + x.jp);
  return m;
}

/**
 * Rincian satu jadwal diklat + semua pengajuan/penugasannya (terbaru dulu). Sama dengan
 * GET /api/training/[id] aplikasi lama: tanda "melebihi kapasitas" pengajuan yang MASIH MENUNGGU
 * dihitung ulang dari batas JP bulan mulai diklat; yang sudah diputuskan memakai potret tersimpan.
 */
export async function getRincian(id: string): Promise<RincianDiklat> {
  await sinkronStatusTraining();
  const t = await prisma.training.findUnique({ where: { id }, include: { timKerja: { select: { nama: true } } } });
  if (!t) throw new NotFoundError(`Training "${id}" tidak ditemukan`);

  const rows = await prisma.penugasanApproval.findMany({
    where: { trainingId: id },
    include: { instructor: { select: { id: true, nama: true, jabatan: true, jpMaksimal: true } }, sesi: { select: { jp: true } } },
    orderBy: { diajukanPada: "desc" },
  });

  const menunggu = rows.filter((r) => r.status === "menunggu");
  let kapasitas: ((r: (typeof rows)[number]) => boolean) | null = null;
  if (menunggu.length > 0) {
    const bulan = bulanDari(t.startDate);
    const [batas, terpakai] = await Promise.all([batasJenjang(), jpBulan(bulan, [...new Set(menunggu.map((r) => r.instructor.id))])]);
    kapasitas = (r) => melebihiKapasitas(terpakai.get(r.instructor.id) ?? 0, batasEfektif(r.instructor.jpMaksimal, jenjangWi(r.instructor.jabatan), batas).batas, r.jp);
  }

  const penugasan: Pengampu[] = rows.map((r) => ({
    id: r.id,
    instructorName: r.instructor.nama,
    instructorId: r.instructor.id,
    jp: r.jp,
    diajukanOleh: r.diajukanOleh,
    overCapacity: r.status === "menunggu" && kapasitas ? kapasitas(r) : r.overCapacity,
    status: r.status as Pengampu["status"],
    jpSesi: r.sesi.reduce((n, s) => n + s.jp, 0),
    jmlSesi: r.sesi.length,
    mataPelatihan: r.mataPelatihan ?? undefined,
    mataPelatihanNama: namaMataPelatihan(r.mataPelatihan) ?? undefined,
    catatan: r.catatan ?? undefined,
    alasanTolak: r.alasanTolak ?? undefined,
  }));

  return {
    id: t.id,
    name: t.name,
    category: t.category,
    participants: t.participants,
    startDate: isoTanggal(t.startDate),
    endDate: t.endDate ? isoTanggal(t.endDate) : undefined,
    jpDibutuhkan: t.jpDibutuhkan,
    tempat: t.tempat,
    status: t.status as RincianDiklat["status"],
    jenisPelatihan: t.jenisPelatihan ?? undefined,
    modePelatihan: t.modePelatihan ?? undefined,
    angkatan: t.angkatan ?? undefined,
    timKerjaId: t.timKerjaId ?? undefined,
    timKerjaNama: t.timKerja?.nama ?? undefined,
    penugasan,
  };
}
