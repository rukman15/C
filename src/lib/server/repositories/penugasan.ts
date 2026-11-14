import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { PendingApprovalRecord, AssignableTrainingRecord } from "@/lib/server/types";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { getTrainingByIdOrThrow, sinkronStatusTraining } from "@/lib/server/repositories/training";
import { getWiById } from "@/lib/server/repositories/widyaiswara";
import { getBatasJenjang, jpBulanMap } from "@/lib/server/repositories/batas-jp-wi";
import { batasEfektif, bulanDari, masihButuhWi, melebihiKapasitas } from "@/lib/kapasitas";
import { jenjangWi, periodeSurat } from "@/lib/dokumen";
import { isoTanggal } from "@/lib/tanggal";
import { cutiDisetujuiBeririsan } from "@/lib/server/repositories/cuti";
import { wajibTanpaBentrok } from "@/lib/server/repositories/bentrok-tugas";
import { isMataPelatihanProgram, namaMataPelatihan } from "@/lib/kurikulum";

/**
 * Port dari server/repositories/penugasan.ts (Next.js), dengan beberapa
 * perbaikan sesudahnya (ditandai di tiap fungsi).
 */
// `timeZone: "UTC"`: tanggal pelatihan disimpan sebagai tengah malam UTC (lihat
// @/lib/tanggal.ts), jadi dibaca dari UTC juga supaya tidak bergeser sehari kalau
// server berjalan di zona waktu lain — sama dengan `fmt` di bentrokan.ts.
function formatPeriode(startDate: Date, endDate: Date | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : fmt(startDate);
}

type ApprovalRow = {
  id: string;
  training: { id: string; name: string; startDate: Date; endDate: Date | null; tempat: string; timKerjaId?: string | null };
  instructor: { id: string; nama: string; jabatan?: string | null; jpMaksimal: number | null };
  sesi: { jp: number }[];
  jp: number;
  diajukanOleh: string;
  diajukanPada: Date;
  overCapacity: boolean;
  status: string;
  mataPelatihan: string | null;
  catatan: string | null;
  alasanTolak?: string | null;
};

function toRecord(row: ApprovalRow): PendingApprovalRecord {
  return {
    id: row.id,
    trainingName: row.training.name,
    instructorName: row.instructor.nama,
    instructorId: row.instructor.id,
    jp: row.jp,
    periode: formatPeriode(row.training.startDate, row.training.endDate),
    diajukanOleh: row.diajukanOleh,
    diajukanPada: row.diajukanPada.toISOString(),
    overCapacity: row.overCapacity,
    status: row.status as PendingApprovalRecord["status"],
    trainingId: row.training.id,
    timKerjaId: row.training.timKerjaId ?? undefined,
    tempat: row.training.tempat,
    jpSesi: row.sesi.reduce((sum, s) => sum + s.jp, 0),
    jmlSesi: row.sesi.length,
    mataPelatihan: row.mataPelatihan ?? undefined,
    mataPelatihanNama: namaMataPelatihan(row.mataPelatihan) ?? undefined,
    catatan: row.catatan ?? undefined,
    alasanTolak: row.alasanTolak ?? undefined,
  };
}

const INCLUDE = {
  training: { select: { id: true, name: true, startDate: true, endDate: true, tempat: true, timKerjaId: true } },
  instructor: { select: { id: true, nama: true, jabatan: true, jpMaksimal: true } },
  sesi: { select: { jp: true } },
} as const;

/**
 * PERBAIKAN: tanda "Melebihi kapasitas" pada pengajuan yang MASIH MENUNGGU
 * dihitung ulang saat daftar dibaca, bukan memakai potret saat diajukan.
 * Potret lama tidak tahu pengajuan lain yang disetujui sesudahnya — beberapa
 * pengajuan untuk WI yang sama bisa tampil "aman" semua padahal kalau
 * disetujui semuanya melewati kapasitas. Pengajuan yang sudah diputuskan
 * tetap memakai potret tersimpan (riwayat tidak berubah-ubah).
 */
export async function listPenugasan(status?: string): Promise<PendingApprovalRecord[]> {
  const rows: ApprovalRow[] = await prisma.penugasanApproval.findMany({
    where: status ? { status } : undefined,
    include: INCLUDE,
    orderBy: { diajukanPada: "desc" },
  });
  return keRecordDenganKapasitas(rows);
}

/** Semua pengajuan/penugasan satu pelatihan (untuk halaman rincian diklat), terbaru dulu. */
export async function listPenugasanTraining(trainingId: string): Promise<PendingApprovalRecord[]> {
  const rows: ApprovalRow[] = await prisma.penugasanApproval.findMany({
    where: { trainingId },
    include: INCLUDE,
    orderBy: { diajukanPada: "desc" },
  });
  return keRecordDenganKapasitas(rows);
}

async function keRecordDenganKapasitas(rows: ApprovalRow[]): Promise<PendingApprovalRecord[]> {
  const menunggu = rows.filter((r) => r.status === "menunggu");
  if (menunggu.length === 0) return rows.map(toRecord);
  // Batas berlaku per bulan: JP disetujui pada diklat yang mulai di bulan yang sama dengan
  // diklat pengajuan ini (lihat batasEfektif di @/lib/kapasitas.ts).
  const ids = [...new Set(menunggu.map((r) => r.instructor.id))];
  const bulanList = [...new Set(menunggu.map((r) => bulanDari(r.training.startDate)))];
  const [batasJenjang, ...peta] = await Promise.all([getBatasJenjang(), ...bulanList.map((b) => jpBulanMap(b, ids))]);
  const terpakai = new Map(bulanList.map((b, i) => [b, peta[i]]));
  return rows.map((r) => {
    const record = toRecord(r);
    if (r.status !== "menunggu") return record;
    const { batas } = batasEfektif(r.instructor.jpMaksimal, jenjangWi(r.instructor.jabatan), batasJenjang);
    const jp = terpakai.get(bulanDari(r.training.startDate))?.get(r.instructor.id) ?? 0;
    return { ...record, overCapacity: melebihiKapasitas(jp, batas, r.jp) };
  });
}

type AssignableRow = {
  id: string;
  timKerjaId?: string | null;
  name: string;
  jpDibutuhkan: number;
  startDate: Date;
  endDate: Date | null;
  status: string;
  jenisPelatihan: string | null;
  approvals: { jp: number; instructorId: string }[];
};

/**
 * Pelatihan yang masih bisa diajukan WI baru — mengisi pilihan di "Tugaskan WI".
 * Aturannya di `masihButuhWi` (@/lib/kapasitas.ts).
 *
 * Pelatihan yang sudah selesai TETAP ikut (di urutan belakang, yang terbaru
 * dulu) supaya penugasan yang terlambat dicatat tetap bisa dimasukkan dan
 * JP-nya terhitung dalam rekap JP.
 */
export async function listAssignableTraining(): Promise<AssignableTrainingRecord[]> {
  await sinkronStatusTraining();
  const rows: AssignableRow[] = await prisma.training.findMany({
    orderBy: { startDate: "asc" },
    include: { approvals: { where: { status: "disetujui" }, select: { jp: true, instructorId: true } } },
  });
  const bisa = rows
    .map((t) => ({
      t,
      // Banyaknya ORANG, bukan baris: satu WI bisa punya beberapa penugasan (per mata pelatihan).
      wiDisetujui: new Set(t.approvals.map((a) => a.instructorId)).size,
      jpDisetujui: t.approvals.reduce((sum: number, a) => sum + a.jp, 0),
    }))
    .filter((x) => masihButuhWi(x.t, x.wiDisetujui, x.jpDisetujui));
  const belumSelesai = bisa.filter((x) => x.t.status !== "Selesai");
  const sudahSelesai = bisa.filter((x) => x.t.status === "Selesai").reverse(); // yang terbaru selesai lebih dulu
  return [...belumSelesai, ...sudahSelesai].map(({ t, wiDisetujui, jpDisetujui }) => ({
    id: t.id,
    name: t.name,
    jpDibutuhkan: t.jpDibutuhkan,
    periode: formatPeriode(t.startDate, t.endDate),
    jenisPelatihan: t.jenisPelatihan ?? undefined,
    wiDisetujui,
    jpDisetujui,
    timKerjaId: t.timKerjaId ?? undefined,
  }));
}

/**
 * Ketua Diklat (atau admin/tim diklat) menetapkan WI sebagai pengampu satu training.
 * Tanpa langkah persetujuan (keputusan 27 Okt 2026, docs/internal/USULAN-PENUGASAN-LEWAT-SURAT-TUGAS.md):
 * baris langsung berstatus "disetujui"; formalitasnya surat tugas yang di-TTE di luar aplikasi.
 * `overCapacity` dihitung sekali di sini (snapshot) dari `jpTerpakai` WI pada bulan mulai diklat.
 */
export async function createPenugasan(input: {
  trainingId: string;
  instructorId: string;
  jp: number;
  diajukanOleh: string;
  catatan?: string;
  /** Kode mata pelatihan (@/lib/kurikulum.ts) — hanya untuk jadwal berprogram PKA/PKP. */
  mataPelatihan?: string | null;
}): Promise<PendingApprovalRecord> {
  if (input.jp <= 0) throw new ValidationError("JP harus lebih dari 0");
  const training = await getTrainingByIdOrThrow(input.trainingId);
  // Beban dibandingkan dengan batas pada BULAN MULAI diklat ini (batas JP WI per bulan).
  const wi = await getWiById(input.instructorId, bulanDari(training.startDate));
  if (!wi) throw new NotFoundError(`Widyaiswara "${input.instructorId}" tidak ditemukan`);
  // Halaman Tugaskan WI sudah menonaktifkan pilihan WI yang cuti; aturan yang
  // sama dijaga di server supaya tidak bisa dilewati lewat panggilan API langsung.
  if (wi.status === "Cuti") {
    throw new ValidationError("Widyaiswara ini sedang cuti dan tidak bisa ditugaskan");
  }
  // Cuti yang sudah DISETUJUI (modul persuratan) dan beririsan dengan periode diklat.
  const cuti = await cutiDisetujuiBeririsan(wi.id, {
    mulai: isoTanggal(training.startDate),
    selesai: isoTanggal(training.endDate ?? training.startDate),
  });
  if (cuti.length) {
    throw new ValidationError(
      `Widyaiswara ini ${cuti[0].label.toLowerCase()} pada ${periodeSurat(cuti[0].mulai, cuti[0].selesai)}, beririsan dengan jadwal diklat ini`,
    );
  }
  // Surat tugas lain yang sudah bernomor pada hari WI ini mengajar (CATATAN-SURAT-MENYURAT.md G).
  // Diklat non-kurikulum: WI mengajar sepanjang periode diklat (tanggal pasti). PKA/PKP: hari sesi
  // mata pelatihannya di Jadwal Pembelajaran; belum ada -> periode diklat sebagai perkiraan (peringatan).
  const periode = [{ mulai: isoTanggal(training.startDate), selesai: isoTanggal(training.endDate ?? training.startDate) }];
  const mpBentrok = input.mataPelatihan?.trim() || null;
  const hariSesi: { tanggal: Date }[] =
    training.jenisPelatihan && mpBentrok
      ? await prisma.sesiPembelajaran.findMany({ where: { trainingId: training.id, mataPelatihan: mpBentrok }, select: { tanggal: true } })
      : [];
  await wajibTanpaBentrok([wi.id], hariSesi.length ? hariSesi.map((h) => ({ mulai: isoTanggal(h.tanggal), selesai: isoTanggal(h.tanggal) })) : periode, {
    konteks: "penugasan",
    trainingId: training.id,
    perkiraan: !!training.jenisPelatihan && !hariSesi.length,
  });

  const mataPelatihan = input.mataPelatihan?.trim() || null;
  if (mataPelatihan) {
    if (!training.jenisPelatihan) {
      throw new ValidationError("Jadwal ini bukan program berkurikulum, jadi tidak punya mata pelatihan");
    }
    if (!isMataPelatihanProgram(training.jenisPelatihan, mataPelatihan)) {
      throw new ValidationError(`Mata pelatihan "${mataPelatihan}" tidak ada di kurikulum ${training.jenisPelatihan}`);
    }
  }

  // WI yang sudah tercatat untuk mata pelatihan yang sama (atau pengajuan lama yang belum
  // ditetapkan) ditolak — biasanya tersimpan dua kali karena lupa. WI yang sama boleh untuk mata
  // pelatihan lain. Ini cek-lalu-tulis biasa, bukan kunci: dua permintaan yang benar-benar
  // bersamaan masih bisa sama-sama lolos; kalau terjadi, salah satunya tinggal dihapus.
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

  // Batas kosong = belum diatur (tanpa batas) — lihat batasEfektif di @/lib/kapasitas.ts.
  const overCapacity = melebihiKapasitas(wi.jpTerpakai ?? 0, wi.jpMaksimal, input.jp);

  let row: ApprovalRow;
  try {
    row = await prisma.penugasanApproval.create({
      data: {
        trainingId: training.id,
        instructorId: wi.id,
        jp: input.jp,
        diajukanOleh: input.diajukanOleh,
        status: "disetujui",
        disetujuiOleh: input.diajukanOleh,
        diputuskanPada: new Date(),
        overCapacity,
        catatan: input.catatan?.trim() || null,
        mataPelatihan,
      },
      include: INCLUDE,
    });
  } catch (e) {
    // Jadwal (atau pegawainya) dihapus tepat sesudah dicek di atas.
    if (kodePrisma(e) === "P2003") throw new NotFoundError("Jadwal diklat atau widyaiswara ini sudah tidak ada");
    throw e;
  }
  return toRecord(row);
}

/**
 * Pengajuan LAMA yang masih "menunggu" (dibuat sebelum langkah persetujuan dihapus) ditetapkan
 * pengelola diklat menjadi pengampu. Syarat "masih menunggu" ikut di dalam perintah update-nya,
 * jadi dua klik bersamaan tidak saling menimpa.
 */
export async function tetapkanPenugasan(id: string, oleh: string): Promise<PendingApprovalRecord> {
  const { count } = await prisma.penugasanApproval.updateMany({
    where: { id, status: "menunggu" },
    data: { status: "disetujui", disetujuiOleh: oleh, diputuskanPada: new Date() },
  });
  if (count === 0) {
    const existing = await prisma.penugasanApproval.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
    throw new ConflictError(`Penugasan ini sudah ${existing.status}`);
  }
  const row: ApprovalRow | null = await prisma.penugasanApproval.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
  return toRecord(row);
}

/**
 * Menghapus pengampu (salah pilih WI, JP, atau mata pelatihan; WI berhalangan). Ditolak bila
 * sudah ada sesi mengajar (dasar rekap JP), atau WI ini tercantum di surat tugas BERNOMOR diklat
 * itu dan ini satu-satunya penugasannya di sana — ubah surat tugasnya dulu.
 */
export async function hapusPenugasan(id: string): Promise<void> {
  const p: { trainingId: string; instructorId: string } | null = await prisma.penugasanApproval.findUnique({
    where: { id },
    select: { trainingId: true, instructorId: true },
  });
  if (!p) throw new NotFoundError(`Penugasan "${id}" tidak ditemukan`);
  if ((await prisma.penugasanSesi.count({ where: { penugasanId: id } })) > 0) {
    throw new ConflictError("Pengampu ini sudah punya sesi mengajar. Hapus sesinya dulu bila memang salah catat.");
  }
  const lain = await prisma.penugasanApproval.count({
    where: { trainingId: p.trainingId, instructorId: p.instructorId, status: "disetujui", NOT: { id } },
  });
  if (lain === 0) {
    const bernomor = await prisma.suratTugas.count({
      where: { trainingId: p.trainingId, pegawaiIds: { has: p.instructorId }, nomor: { not: null } },
    });
    if (bernomor > 0) {
      throw new ConflictError("WI ini tercantum di surat tugas yang sudah bernomor. Ubah surat tugasnya dulu.");
    }
  }
  await prisma.penugasanApproval.deleteMany({ where: { id } });
}

/**
 * Hook otomasi (BELUM disambungkan ke cron — lihat CATATAN-PENUGASAN-WI.md
 * sumber): scan training yang udah masuk window H-3 (lewat batas pengajuan)
 * TAPI belum ada WI disetujui, lalu bikin 1 `RoleUpdate` (role
 * "ketua-diklat") per training kalau belum pernah dibikin sebelumnya.
 * Idempotent lewat id deterministik (`AUTO-DEADLINE-<trainingId>`) —
 * createUpdate nggak dicek dobel di sini, jadi caller (route) yang jaga:
 * lihat listUpdates dulu.
 */
export async function trainingLewatBatasTanpaWI(): Promise<
  { id: string; name: string; startDate: Date }[]
> {
  await sinkronStatusTraining();
  const now = new Date();
  const rows: { id: string; name: string; startDate: Date }[] = await prisma.training.findMany({
    where: {
      status: { not: "Selesai" },
      startDate: { gt: now },
      approvals: { none: { status: "disetujui" } },
    },
  });
  return rows
    .filter((t) => {
      const batas = new Date(t.startDate);
      batas.setDate(batas.getDate() - 3);
      return now >= batas;
    })
    .map((t) => ({ id: t.id, name: t.name, startDate: t.startDate }));
}
