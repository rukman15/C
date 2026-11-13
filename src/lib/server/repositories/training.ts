import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ValidationError } from "@/lib/server/errors";
import { TEMPAT_DEFAULT } from "@/lib/sesi";
import { HARI_MS, awalHariWib, bacaTanggalIso, statusDariTanggal } from "@/lib/tanggal";
import { isKodeJenis, isModePelatihan } from "@/lib/kurikulum";
import type { IsianTraining } from "@/lib/skema-training";

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
