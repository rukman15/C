import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { BATAS_JENJANG_KOSONG, batasEfektif, bulanDari, melebihiKapasitas, type BatasJenjang } from "@/lib/kapasitas";
import { isMataPelatihanProgram } from "@/lib/kurikulum";
import { isoTanggal } from "@/lib/tanggal";
import { jenjangWi, rentangBulan } from "@/lib/wi";
import { periodeSurat, labelJenisCuti } from "@/lib/rentang";
import { wajibTanpaBentrok } from "@/lib/server/repositories/bentrok";

/**
 * Pengampu (penugasan WI) satu diklat. Aturan disalin dari aplikasi lama
 * (repositories/penugasan.ts, widyaiswara.ts, keputusan 27 Okt 2026): tanpa langkah persetujuan,
 * baris langsung "disetujui"; formalitasnya surat tugas.
 */

const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export type WiPilihan = {
  id: string;
  nama: string;
  jabatan: string;
  /** Hanya status pegawai "CUTI" yang dianggap tidak bisa ditugaskan. */
  cuti: boolean;
  /** JP disetujui pada diklat yang mulai di bulan yang sama. */
  jpTerpakai: number;
  /** Batas efektif bulan itu; null = tanpa batas. */
  jpMaksimal: number | null;
};

async function batasJenjang(): Promise<BatasJenjang> {
  const r = await prisma.pengaturanJp.findUnique({ where: { id: "singleton" } });
  if (!r) return { ...BATAS_JENJANG_KOSONG };
  return { pertama: r.batasWiPertama ?? null, muda: r.batasWiMuda ?? null, madya: r.batasWiMadya ?? null, utama: r.batasWiUtama ?? null };
}

async function jpBulan(bulan: string, ids?: string[]): Promise<Map<string, number>> {
  const r = rentangBulan(bulan);
  const rows = await prisma.penugasanApproval.findMany({
    where: { status: "disetujui", ...(ids ? { instructorId: { in: ids } } : {}), training: { startDate: { gte: utc(r.awal), lt: utc(r.akhirEksklusif) } } },
    select: { instructorId: true, jp: true },
  });
  const m = new Map<string, number>();
  for (const x of rows) m.set(x.instructorId, (m.get(x.instructorId) ?? 0) + x.jp);
  return m;
}

const rapikanJabatan = (v: string) =>
  v
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");

/** Semua Widyaiswara dengan beban JP pada `bulan` ("YYYY-MM", bulan mulai diklat). */
export async function daftarWi(bulan: string, id?: string): Promise<WiPilihan[]> {
  const [rows, terpakai, batas] = await Promise.all([
    prisma.pegawai.findMany({ where: { ...WI_WHERE, ...(id ? { id } : {}) }, orderBy: { no: "asc" }, select: { id: true, nama: true, jabatan: true, status: true, jpMaksimal: true } }),
    jpBulan(bulan, id ? [id] : undefined),
    batasJenjang(),
  ]);
  return rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    jabatan: rapikanJabatan(r.jabatan ?? ""),
    cuti: (r.status ?? "").toUpperCase() === "CUTI",
    jpTerpakai: terpakai.get(r.id) ?? 0,
    jpMaksimal: batasEfektif(r.jpMaksimal, jenjangWi(r.jabatan), batas).batas ?? null,
  }));
}

/** Tetapkan WI sebagai pengampu. Mencegah: WI cuti, cuti disetujui beririsan, bentrok surat tugas, kembar. */
export async function tetapkanPengampu(input: {
  trainingId: string;
  instructorId: string;
  jp: number;
  diajukanOleh: string;
  catatan?: string;
  mataPelatihan?: string | null;
}): Promise<{ id: string }> {
  if (input.jp <= 0) throw new ValidationError("JP harus lebih dari 0");
  const training = await prisma.training.findUnique({ where: { id: input.trainingId }, select: { id: true, startDate: true, endDate: true, jenisPelatihan: true } });
  if (!training) throw new NotFoundError(`Training "${input.trainingId}" tidak ditemukan`);
  // Beban dibandingkan dengan batas pada BULAN MULAI diklat ini.
  const [wi] = await daftarWi(bulanDari(training.startDate), input.instructorId);
  if (!wi) throw new NotFoundError(`Widyaiswara "${input.instructorId}" tidak ditemukan`);
  if (wi.cuti) throw new ValidationError("Widyaiswara ini sedang cuti dan tidak bisa ditugaskan");

  const mulai = isoTanggal(training.startDate);
  const selesai = isoTanggal(training.endDate ?? training.startDate);
  const cuti = await prisma.cutiPegawai.findFirst({
    where: { pegawaiId: wi.id, status: "DISETUJUI", mulai: { lte: utc(selesai) }, selesai: { gte: utc(mulai) } },
    select: { jenis: true, mulai: true, selesai: true },
  });
  if (cuti) {
    throw new ValidationError(
      `Widyaiswara ini ${labelJenisCuti(cuti.jenis).toLowerCase()} pada ${periodeSurat(isoTanggal(cuti.mulai), isoTanggal(cuti.selesai))}, beririsan dengan jadwal diklat ini`,
    );
  }

  // Surat tugas lain pada hari WI mengajar. PKA/PKP: hari sesi mata pelatihannya; belum ada -> periode diklat (perkiraan).
  const mataPelatihan = input.mataPelatihan?.trim() || null;
  const hariSesi =
    training.jenisPelatihan && mataPelatihan
      ? await prisma.sesiPembelajaran.findMany({ where: { trainingId: training.id, mataPelatihan }, select: { tanggal: true } })
      : [];
  await wajibTanpaBentrok([wi.id], hariSesi.length ? hariSesi.map((h) => ({ mulai: isoTanggal(h.tanggal), selesai: isoTanggal(h.tanggal) })) : [{ mulai, selesai }], {
    konteks: "penugasan",
    trainingId: training.id,
    perkiraan: !!training.jenisPelatihan && !hariSesi.length,
  });

  if (mataPelatihan) {
    if (!training.jenisPelatihan) throw new ValidationError("Jadwal ini bukan program berkurikulum, jadi tidak punya mata pelatihan");
    if (!isMataPelatihanProgram(training.jenisPelatihan, mataPelatihan)) {
      throw new ValidationError(`Mata pelatihan "${mataPelatihan}" tidak ada di kurikulum ${training.jenisPelatihan}`);
    }
  }

  const kembar = await prisma.penugasanApproval.count({
    where: { trainingId: training.id, instructorId: wi.id, status: { in: ["menunggu", "disetujui"] }, mataPelatihan },
  });
  if (kembar > 0) {
    throw new ConflictError(
      mataPelatihan
        ? "WI ini sudah tercatat sebagai pengampu mata pelatihan ini. Hapus dulu kalau ingin mengubah JP-nya."
        : "WI ini sudah tercatat sebagai pengampu diklat ini. Hapus dulu kalau ingin mengubah JP-nya.",
    );
  }

  try {
    return await prisma.penugasanApproval.create({
      select: { id: true },
      data: {
        trainingId: training.id,
        instructorId: wi.id,
        jp: input.jp,
        diajukanOleh: input.diajukanOleh,
        status: "disetujui",
        disetujuiOleh: input.diajukanOleh,
        diputuskanPada: new Date(),
        overCapacity: melebihiKapasitas(wi.jpTerpakai, wi.jpMaksimal, input.jp),
        catatan: input.catatan?.trim() || null,
        mataPelatihan,
      },
    });
  } catch (e) {
    if (kodePrisma(e) === "P2003") throw new NotFoundError("Jadwal diklat atau widyaiswara ini sudah tidak ada");
    throw e;
  }
}

/** Pengajuan LAMA yang masih "menunggu" ditetapkan menjadi pengampu (syarat ikut di perintah update). */
export async function tetapkanPengajuanLama(id: string, oleh: string): Promise<void> {
  const { count } = await prisma.penugasanApproval.updateMany({
    where: { id, status: "menunggu" },
    data: { status: "disetujui", disetujuiOleh: oleh, diputuskanPada: new Date() },
  });
  if (count === 0) {
    const ada = await prisma.penugasanApproval.findUnique({ where: { id }, select: { status: true } });
    if (!ada) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
    throw new ConflictError(`Penugasan ini sudah ${ada.status}`);
  }
}

/**
 * Hapus pengampu. Ditolak bila sudah ada sesi mengajar, atau WI ini tercantum di surat tugas BERNOMOR
 * diklat itu dan ini satu-satunya penugasannya di sana.
 */
export async function hapusPengampu(id: string): Promise<void> {
  const p = await prisma.penugasanApproval.findUnique({ where: { id }, select: { trainingId: true, instructorId: true } });
  if (!p) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
  if ((await prisma.penugasanSesi.count({ where: { penugasanId: id } })) > 0) {
    throw new ConflictError("Pengampu ini sudah punya sesi mengajar. Hapus sesinya dulu bila memang salah catat.");
  }
  const lain = await prisma.penugasanApproval.count({ where: { trainingId: p.trainingId, instructorId: p.instructorId, status: "disetujui", NOT: { id } } });
  if (lain === 0) {
    const bernomor = await prisma.suratTugas.count({ where: { trainingId: p.trainingId, pegawaiIds: { has: p.instructorId }, nomor: { not: null } } });
    if (bernomor > 0) throw new ConflictError("WI ini tercantum di surat tugas yang sudah bernomor. Ubah surat tugasnya dulu.");
  }
  await prisma.penugasanApproval.deleteMany({ where: { id } });
}
