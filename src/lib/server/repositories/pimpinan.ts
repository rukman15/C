import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { DashboardPimpinanRecord, KelulusanRingkasRecord } from "@/lib/server/types";
import { listTrainingWithUrgensi, type TrainingWithUrgensi } from "@/lib/server/repositories/training";
import { listPeserta } from "@/lib/server/repositories/peserta";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import { daftarAspek, bulat2 } from "@/lib/penilaian";
import { awalHariWib } from "@/lib/tanggal";

/**
 * Home Kepala Balai: yang perlu diputuskan, kinerja tahun berjalan, dan hasil
 * diklat yang baru selesai. Read-only; semua angka dihitung dari tabel yang ada.
 */
const tahunDari = (iso: string) => new Date(iso).getUTCFullYear();
const berprogram = (t: TrainingWithUrgensi) => daftarAspek(t.jenisPelatihan, t.modePelatihan).length > 0;

/** Banyaknya peserta AKTIF per jadwal (jadwal tanpa peserta tidak ada di peta). */
async function hitungPesertaAktif(trainingIds: string[]): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (trainingIds.length === 0) return peta;
  const rows: { trainingId: string }[] = await prisma.peserta.findMany({
    where: { trainingId: { in: trainingIds }, status: "AKTIF" },
    select: { trainingId: true },
  });
  for (const r of rows) peta.set(r.trainingId, (peta.get(r.trainingId) ?? 0) + 1);
  return peta;
}

async function ringkasKelulusan(trainingId: string): Promise<KelulusanRingkasRecord | null> {
  const lembar = await getLembarPenilaian(trainingId, { peran: "PIMPINAN", email: "" });
  const aktif = lembar.peserta.filter((p) => p.status === "AKTIF" && p.hasil);
  if (aktif.length === 0) return null;
  const n = { lulus: 0, ditunda: 0, tidakLulus: 0, belumLengkap: 0 };
  const nilai: number[] = [];
  for (const p of aktif) {
    const h = p.hasil!;
    if (h.status === "LULUS") n.lulus++;
    else if (h.status === "DITUNDA") n.ditunda++;
    else if (h.status === "TIDAK_LULUS") n.tidakLulus++;
    else n.belumLengkap++;
    if (h.nilaiAkhir !== null) nilai.push(h.nilaiAkhir);
  }
  return { ...n, rataNilai: nilai.length ? bulat2(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null };
}

export async function getDashboardPimpinan(now: Date = new Date()): Promise<DashboardPimpinanRecord> {
  const list = await listTrainingWithUrgensi();
  const tahun = awalHariWib(now).getUTCFullYear();
  const aktif = list.filter((t) => t.status !== "Selesai");

  // --- perlu tindakan
  const tanpaWi = aktif
    .filter((t) => t.wiDisetujui === 0 && t.urgensi !== "aman")
    .map((t) => ({ id: t.id, name: t.name, startDate: t.startDate, urgensi: t.urgensi }));
  const kehadiranBatas: DashboardPimpinanRecord["tindakan"]["kehadiranBatas"] = [];
  for (const t of list.filter((t) => t.status === "Berjalan" && t.jenisPelatihan)) {
    const d = await listPeserta(t.id);
    const jumlah = d.peserta.filter((p) => p.status === "AKTIF" && p.rekap.tingkat === "batas").length;
    if (jumlah > 0) kehadiranBatas.push({ id: t.id, name: t.name, jumlah });
  }

  // --- kinerja tahun berjalan
  const selesaiTahunIni = list.filter((t) => t.status === "Selesai" && tahunDari(t.endDate ?? t.startDate) === tahun);
  const idSelesai = selesaiTahunIni.map((t) => t.id);
  const pesertaPerTraining = await hitungPesertaAktif(idSelesai);
  const jumlahPeserta = (t: TrainingWithUrgensi) => pesertaPerTraining.get(t.id) ?? t.participants;
  const jp: { _sum: { jp: number | null } } = await prisma.sesiPembelajaran.aggregate({
    where: { tanggal: { gte: new Date(Date.UTC(tahun, 0, 1)), lt: new Date(Date.UTC(tahun + 1, 0, 1)) } },
    _sum: { jp: true },
  });

  const memo = new Map<string, KelulusanRingkasRecord | null>();
  const kelulusanDari = async (t: TrainingWithUrgensi) => {
    if (!berprogram(t)) return null;
    if (!memo.has(t.id)) memo.set(t.id, await ringkasKelulusan(t.id));
    return memo.get(t.id) ?? null;
  };

  let gabung: KelulusanRingkasRecord | null = null;
  let jumlahNilai = 0;
  let totalNilai = 0;
  for (const t of selesaiTahunIni) {
    const k = await kelulusanDari(t);
    if (!k) continue;
    gabung ??= { lulus: 0, ditunda: 0, tidakLulus: 0, belumLengkap: 0, rataNilai: null };
    gabung.lulus += k.lulus;
    gabung.ditunda += k.ditunda;
    gabung.tidakLulus += k.tidakLulus;
    gabung.belumLengkap += k.belumLengkap;
    if (k.rataNilai !== null) {
      // rata-rata tertimbang banyaknya peserta bernilai lengkap
      const bernilai = k.lulus + k.ditunda + k.tidakLulus;
      totalNilai += k.rataNilai * bernilai;
      jumlahNilai += bernilai;
    }
  }
  if (gabung && jumlahNilai > 0) gabung.rataNilai = bulat2(totalNilai / jumlahNilai);
  const diputus = gabung ? gabung.lulus + gabung.ditunda + gabung.tidakLulus : 0;

  // --- baru selesai (5 terakhir)
  const baru = list
    .filter((t) => t.status === "Selesai")
    .sort((a, b) => (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate))
    .slice(0, 5);
  const pesertaBaru = await hitungPesertaAktif(baru.map((t) => t.id));
  const baruSelesai: DashboardPimpinanRecord["baruSelesai"] = [];
  for (const t of baru) {
    baruSelesai.push({
      id: t.id,
      name: t.name,
      endDate: t.endDate ?? t.startDate,
      program: t.jenisPelatihan ? `${t.jenisPelatihan}${t.modePelatihan ? ` · ${t.modePelatihan === "BLENDED" ? "Blended" : "Klasikal"}` : ""}` : undefined,
      peserta: pesertaBaru.get(t.id) ?? t.participants,
      kelulusan: await kelulusanDari(t),
    });
  }

  return {
    tahun,
    tindakan: {
      cutiMenunggu: await prisma.cutiPegawai.count({ where: { status: "DIAJUKAN" } }),
      tanpaWi,
      kehadiranBatas,
    },
    kinerja: {
      diklatSelesai: selesaiTahunIni.length,
      diklatBerjalan: list.filter((t) => t.status === "Berjalan").length,
      diklatTerjadwal: list.filter((t) => t.status === "Terjadwal" && tahunDari(t.startDate) === tahun).length,
      pesertaDilatih: selesaiTahunIni.reduce((n, t) => n + jumlahPeserta(t), 0),
      jpPembelajaran: jp._sum.jp ?? 0,
      kelulusan: gabung ? { ...gabung, persenLulus: diputus ? bulat2((gabung.lulus / diputus) * 100) : null } : null,
    },
    baruSelesai,
  };
}
