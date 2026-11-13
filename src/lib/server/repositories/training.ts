import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { TEMPAT_DEFAULT } from "@/lib/sesi";
import { HARI_MS, awalHariWib, bacaTanggalIso, statusDariTanggal } from "@/lib/tanggal";
import { isKodeJenis, isModePelatihan } from "@/lib/kurikulum";
import type { IsianTraining } from "@/lib/skema-training";
import type { TrainingRecord } from "@/lib/server/types";

/**
 * Jadwal diklat (tabel `training`). Aturan disalin dari aplikasi lama
 * (src/lib/server/repositories/training.ts): status mengikuti tanggal, program
 * berkurikulum wajib punya mode, tim pemegang harus ada.
 */

const JEDA_SINKRON_MS = 60_000;
let sinkronTerakhir = 0;
let sedangSinkron: Promise<void> | null = null;

/**
 * Memajukan kolom `status` mengikuti tanggal (Terjadwal -> Berjalan -> Selesai). Paling sering
 * sekali per menit per proses; kegagalan hanya dicatat di log.
 */
export function sinkronStatusTraining(now: Date = new Date()): Promise<void> {
  if (sedangSinkron) return sedangSinkron;
  if (now.getTime() - sinkronTerakhir < JEDA_SINKRON_MS) return Promise.resolve();

  const hariIni = awalHariWib(now);
  const besok = new Date(hariIni.getTime() + HARI_MS);
  const jalankan = async () => {
    await prisma.training.updateMany({
      where: { status: { not: "Selesai" }, startDate: { lt: hariIni }, OR: [{ endDate: null }, { endDate: { lt: hariIni } }] },
      data: { status: "Selesai" },
    });
    await prisma.training.updateMany({
      where: { status: "Terjadwal", startDate: { lt: besok }, OR: [{ startDate: { gte: hariIni } }, { endDate: { gte: hariIni } }] },
      data: { status: "Berjalan" },
    });
    sinkronTerakhir = now.getTime();
  };
  const proses = jalankan()
    .catch((error: unknown) => console.error("[training] gagal menyinkronkan status pelatihan:", error))
    .finally(() => {
      sedangSinkron = null;
    });
  sedangSinkron = proses;
  return proses;
}

function bacaProgram(jenis: string | null | undefined, mode: string | null | undefined) {
  const kode = jenis?.trim() || null;
  if (!kode) return { jenisPelatihan: null, modePelatihan: null };
  if (!isKodeJenis(kode)) throw new ValidationError(`Program "${kode}" tidak dikenal`);
  if (!isModePelatihan(mode)) throw new ValidationError("Pilih mode pelatihan: blended atau klasikal");
  return { jenisPelatihan: kode, modePelatihan: mode };
}

async function bacaTim(timKerjaId: string | null | undefined): Promise<string | null | undefined> {
  if (timKerjaId === undefined) return undefined;
  if (timKerjaId === null || timKerjaId === "") return null;
  const tim = await prisma.timKerja.findUnique({ where: { id: timKerjaId }, select: { id: true } });
  if (!tim) throw new ValidationError("Tim kerja tidak ditemukan");
  return tim.id;
}

function bacaPeriode(mulai: string, selesai: string | null | undefined) {
  const mulaiIso = bacaTanggalIso(mulai);
  if (!mulaiIso) throw new ValidationError("Tanggal mulai tidak valid");
  const selesaiIso = selesai ? bacaTanggalIso(selesai) : null;
  if (selesai && !selesaiIso) throw new ValidationError("Tanggal selesai tidak valid");
  if (selesaiIso && selesaiIso < mulaiIso) throw new ValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai");
  return {
    startDate: new Date(`${mulaiIso}T00:00:00.000Z`),
    endDate: selesaiIso ? new Date(`${selesaiIso}T00:00:00.000Z`) : null,
  };
}

/** `status` tidak diterima dari pemanggil: selalu dihitung dari tanggal. */
export async function createTraining(input: IsianTraining): Promise<{ id: string; name: string }> {
  const { startDate, endDate } = bacaPeriode(input.startDate, input.endDate);
  const program = bacaProgram(input.jenisPelatihan, input.modePelatihan);
  const timKerjaId = await bacaTim(input.timKerjaId);

  return prisma.training.create({
    select: { id: true, name: true },
    data: {
      timKerjaId: timKerjaId ?? null,
      name: input.name.trim(),
      category: input.category,
      participants: input.participants ?? 0,
      startDate,
      endDate,
      jpDibutuhkan: input.jpDibutuhkan ?? 0,
      tempat: input.tempat?.trim() || TEMPAT_DEFAULT,
      status: statusDariTanggal(startDate, endDate),
      ...program,
      angkatan: input.angkatan?.trim() || null,
    },
  });
}

/**
 * Ubah jadwal diklat (sama dengan updateTraining aplikasi lama). Status dihitung ulang dari tanggal.
 * Program tidak boleh diganti bila sudah ada penugasan/sesi per mata pelatihan, dan program/mode
 * tidak boleh diganti bila peserta sudah punya nilai.
 */
export async function updateTraining(id: string, input: IsianTraining): Promise<{ id: string; name: string }> {
  const lama = await prisma.training.findUnique({ where: { id }, select: { jenisPelatihan: true, modePelatihan: true } });
  if (!lama) throw new NotFoundError(`Training "${id}" tidak ditemukan`);
  const { startDate, endDate } = bacaPeriode(input.startDate, input.endDate);
  const program = bacaProgram(input.jenisPelatihan, input.modePelatihan);
  const timKerjaId = await bacaTim(input.timKerjaId);

  if (program.jenisPelatihan !== lama.jenisPelatihan) {
    const [terikat, sesiTerikat] = await Promise.all([
      prisma.penugasanApproval.count({ where: { trainingId: id, mataPelatihan: { not: null } } }),
      prisma.sesiPembelajaran.count({ where: { trainingId: id, mataPelatihan: { not: null } } }),
    ]);
    if (terikat > 0) throw new ConflictError("Program tidak bisa diganti karena sudah ada penugasan WI per mata pelatihan pada jadwal ini");
    if (sesiTerikat > 0) throw new ConflictError("Program tidak bisa diganti karena jadwal pembelajarannya sudah memakai mata pelatihan program ini");
  }
  if (program.jenisPelatihan !== lama.jenisPelatihan || program.modePelatihan !== lama.modePelatihan) {
    const bernilai = await prisma.nilaiPeserta.count({ where: { peserta: { trainingId: id } } });
    if (bernilai > 0) throw new ConflictError("Program atau mode tidak bisa diganti karena peserta jadwal ini sudah punya nilai");
  }

  try {
    return await prisma.training.update({
      where: { id },
      select: { id: true, name: true },
      data: {
        ...(timKerjaId !== undefined ? { timKerjaId } : {}),
        name: input.name.trim(),
        category: input.category,
        participants: input.participants ?? 0,
        startDate,
        endDate,
        jpDibutuhkan: input.jpDibutuhkan ?? 0,
        tempat: input.tempat?.trim() || TEMPAT_DEFAULT,
        status: statusDariTanggal(startDate, endDate),
        ...program,
        angkatan: input.angkatan?.trim() || null,
      },
    });
  } catch (e) {
    if (kodePrisma(e) === "P2025") throw new NotFoundError(`Training "${id}" tidak ditemukan`);
    throw e;
  }
}

/**
 * Hapus jadwal diklat yang masih kosong: belum punya pengajuan/penugasan WI (termasuk yang ditolak),
 * peserta, maupun jadwal pembelajaran. Sama dengan deleteTraining aplikasi lama.
 */
export async function deleteTraining(id: string): Promise<void> {
  const ada = await prisma.training.findUnique({ where: { id }, select: { id: true } });
  if (!ada) throw new NotFoundError(`Training "${id}" tidak ditemukan`);
  const [penugasan, peserta, sesi] = await Promise.all([
    prisma.penugasanApproval.count({ where: { trainingId: id } }),
    prisma.peserta.count({ where: { trainingId: id } }),
    prisma.sesiPembelajaran.count({ where: { trainingId: id } }),
  ]);
  if (penugasan > 0) throw new ConflictError("Jadwal ini sudah punya pengajuan atau penugasan WI, jadi tidak bisa dihapus. Ubah tanggal atau namanya saja.");
  if (peserta > 0 || sesi > 0) {
    throw new ConflictError("Jadwal ini sudah punya peserta atau jadwal pembelajaran, jadi tidak bisa dihapus. Hapus dulu isinya kalau jadwal ini memang batal.");
  }
  try {
    await prisma.training.deleteMany({ where: { id } });
  } catch (e) {
    if (kodePrisma(e) === "P2003") throw new ConflictError("Jadwal ini baru saja mendapat isian baru, jadi tidak bisa dihapus.");
    throw e;
  }
}

// --- Rekaman jadwal (dipakai ruang belajar peserta, tes, seminar), sama dengan aplikasi lama ---
export type TrainingRow = {
  id: string;
  name: string;
  category: string;
  participants: number;
  startDate: Date;
  endDate: Date | null;
  jpDibutuhkan: number;
  tempat: string;
  status: string;
  jenisPelatihan: string | null;
  modePelatihan: string | null;
  angkatan: string | null;
  timKerjaId?: string | null;
  timKerja?: { nama: string } | null;
};

const SERTA_TIM = { timKerja: { select: { nama: true } } } as const;

export function toTrainingRecord(row: TrainingRow): TrainingRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    participants: row.participants,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : undefined,
    jpDibutuhkan: row.jpDibutuhkan,
    tempat: row.tempat,
    status: row.status as TrainingRecord["status"],
    jenisPelatihan: row.jenisPelatihan ?? undefined,
    modePelatihan: row.modePelatihan ?? undefined,
    angkatan: row.angkatan ?? undefined,
    timKerjaId: row.timKerjaId ?? undefined,
    timKerjaNama: row.timKerja?.nama ?? undefined,
  };
}

export async function getTrainingByIdOrThrow(id: string): Promise<TrainingRow> {
  const row: TrainingRow | null = await prisma.training.findUnique({ where: { id }, include: SERTA_TIM });
  if (!row) throw new NotFoundError(`Training "${id}" tidak ditemukan`);
  return row;
}
