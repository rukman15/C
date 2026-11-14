import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { RingkasanLembagaRecord } from "@/lib/server/types";
import { susunRingkasan, type SpdRingkas, type SuratTugasRingkas } from "@/lib/ringkasan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { trainingLewatBatasTanpaWI } from "@/lib/server/repositories/penugasan";
import { sinkronStatusTraining } from "@/lib/server/repositories/training";
import { listWidyaiswara } from "@/lib/server/repositories/widyaiswara";

/**
 * Ringkasan lembaga buat dashboard Kepala Balai. FITUR BARU di luar port
 * apa adanya dari Next.js (lihat CATATAN-RINGKASAN-LEMBAGA.md) — read-only,
 * tidak mengubah data apa pun. Semua angka diturunkan dari tabel yang sudah
 * ada; tidak ada tabel/kolom baru, jadi TIDAK butuh migrasi tambahan.
 */
export async function getRingkasanLembaga(o: { persuratan?: boolean } = {}): Promise<RingkasanLembagaRecord> {
  // Status pelatihan disamakan dulu dengan tanggalnya, supaya hitungan
  // Terjadwal/Berjalan/Selesai di bawah benar (lihat sinkronStatusTraining).
  await sinkronStatusTraining();
  const [
    trainingGroup,
    pesertaAgg,
    penugasanGroup,
    widyaiswara,
    pegawaiTotal,
    pegawaiAktif,
    trainingButuhWi,
  ] = await Promise.all([
    prisma.training.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.training.aggregate({
      where: { status: { not: "Selesai" } },
      _sum: { participants: true },
    }),
    prisma.penugasanApproval.groupBy({ by: ["status"], _count: { _all: true } }),
    listWidyaiswara(),
    prisma.pegawai.count(),
    // `status` nullable di skema (default "AKTIF"); repositories/pegawai.ts
    // memperlakukan null sebagai AKTIF, jadi dihitung sama di sini.
    prisma.pegawai.count({ where: { OR: [{ status: "AKTIF" }, { status: null }] } }),
    trainingLewatBatasTanpaWI(),
  ]);

  // Tugas keluar tahun berjalan: surat tugas bernomor (umum & mengajar) dan status SPD-nya.
  const tahun = Number(isoTanggal(awalHariWib()).slice(0, 4));
  const tahunIni = { gte: new Date(Date.UTC(tahun, 0, 1)), lt: new Date(Date.UTC(tahun + 1, 0, 1)) };
  const [naskahTugas, suratMengajar, spdSudah] = await Promise.all([
    prisma.naskahDinas.findMany({ where: { jenis: "SURAT_TUGAS", nomor: { not: null }, tanggal: tahunIni }, select: { id: true, trainingId: true, pegawaiIds: true } }) as Promise<
      { id: string; trainingId: string | null; pegawaiIds: string[] }[]
    >,
    prisma.suratTugas.findMany({ where: { nomor: { not: null }, tanggal: tahunIni }, select: { id: true, pegawaiIds: true } }) as Promise<{ id: string; pegawaiIds: string[] }[]>,
    prisma.spd.findMany({ select: { sumber: true, sumberId: true, pegawaiId: true } }) as Promise<SpdRingkas[]>,
  ]);
  const suratTugas: SuratTugasRingkas[] = [
    ...naskahTugas.map((n) => ({ sumber: "naskah" as const, sumberId: n.id, pegawaiIds: n.pegawaiIds, terkaitDiklat: !!n.trainingId })),
    ...suratMengajar.map((s) => ({ sumber: "surat-tugas" as const, sumberId: s.id, pegawaiIds: s.pegawaiIds, terkaitDiklat: true })),
  ];

  return susunRingkasan({
    trainingPerStatus: trainingGroup.map((r: { status: string; _count: { _all: number } }) => ({
      status: r.status,
      jumlah: r._count._all,
    })),
    pesertaAktif: pesertaAgg._sum.participants ?? 0,
    penugasanPerStatus: penugasanGroup.map((r: { status: string; _count: { _all: number } }) => ({
      status: r.status,
      jumlah: r._count._all,
    })),
    widyaiswara: widyaiswara.map((w) => ({
      jpTerpakai: w.jpTerpakai ?? null,
      jpMaksimal: w.jpMaksimal ?? null,
    })),
    pegawaiTotal,
    pegawaiAktif,
    trainingButuhWi,
    suratTugas,
    spd: spdSudah,
    tugasKeluar: o.persuratan ?? false,
  });
}
