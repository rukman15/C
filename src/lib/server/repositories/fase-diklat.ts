import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { pembacaSemua, type AksesDiklat } from "@/lib/server/akses";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { getJenjang, labelMode, tahapKurikulum } from "@/lib/kurikulum";
import { hariPelatihan, labelPendekTahap, tahapAktif, type HariPelatihan } from "@/lib/beranda-peserta";
import { rentangTahap, URUTAN_PERAN, urutkanFase, type PeranDiklat } from "@/lib/fase-diklat";
import { isoTanggal } from "@/lib/tanggal";
import { tambahHari } from "@/lib/sesi";

/**
 * Timeline fase PKA/PKP untuk akun yang login (src/lib/fase-diklat.ts). Diklat yang tampil = yang melibatkan akun
 * ini: peserta (akun tertaut), pengampu (penugasan disetujui), coach (kelompok e-learning), penguji (seminar),
 * penyelenggara (boleh mengelola jadwal), pemantau (Kepala Balai, Kabag TU, Koordinator WI).
 * Daftar Beranda: diklat berjalan + terjadwal mulai ≤ HARI_DEPAN hari; dengan `trainingId`: diklat itu saja.
 */
export const HARI_DEPAN = 30;

export type FaseDiklatRecord = {
  trainingId: string;
  nama: string;
  program: string;
  mode: string;
  status: string;
  mulai: string;
  selesai: string | null;
  hari: HariPelatihan | null;
  peran: PeranDiklat[];
  /** Untuk tautan: ruang belajar peserta. */
  pesertaId: string | null;
  /** Untuk tautan: ruang coaching yang dibimbing. */
  kelompokCoachId: string | null;
  tahap: { nama: string; label: string; kode: string; jp: number; mulai: string | null; selesai: string | null }[];
  /** Indeks tahap berjalan (-1 belum mulai; = jumlah tahap bila selesai). */
  aktif: number;
};

type BarisTraining = { id: string; name: string; status: string; startDate: Date; endDate: Date | null; jenisPelatihan: string | null; modePelatihan: string | null; timKerjaId: string | null };

export async function faseDiklat(a: AksesDiklat, hariIni: string, trainingId?: string | null): Promise<FaseDiklatRecord[]> {
  const akun: { id: string } | null = await prisma.akun.findUnique({ where: { email: a.email }, select: { id: true } });
  const batas = new Date(`${tambahHari(hariIni, HARI_DEPAN)}T00:00:00.000Z`);
  const semua: BarisTraining[] = await prisma.training.findMany({
    where: trainingId ? { id: trainingId } : { OR: [{ status: "Berjalan" }, { status: "Terjadwal", startDate: { lte: batas } }] },
    select: { id: true, name: true, status: true, startDate: true, endDate: true, jenisPelatihan: true, modePelatihan: true, timKerjaId: true },
  });
  const pka = semua.filter((t) => !!getJenjang(t.jenisPelatihan));
  if (!pka.length) {
    if (trainingId) throw new NotFoundError("Timeline hanya untuk pelatihan PKA/PKP");
    return [];
  }
  const ids = pka.map((t) => t.id);
  const pid = a.pegawaiId;
  const [peserta, pengampu, coach, penguji, sesiHariIni]: [
    { id: string; trainingId: string }[],
    { trainingId: string }[],
    { id: string; trainingId: string }[],
    { trainingId: string }[],
    { trainingId: string; bentuk: string }[],
  ] = await Promise.all([
    akun ? prisma.peserta.findMany({ where: { akunId: akun.id, trainingId: { in: ids }, status: "AKTIF" }, select: { id: true, trainingId: true } }) : [],
    pid ? prisma.penugasanApproval.findMany({ where: { instructorId: pid, trainingId: { in: ids }, status: "disetujui" }, select: { trainingId: true } }) : [],
    pid ? prisma.kelompokPeserta.findMany({ where: { coachPegawaiId: pid, trainingId: { in: ids }, jenis: "ELEARNING" }, select: { id: true, trainingId: true } }) : [],
    pid ? prisma.seminarPeserta.findMany({ where: { pengujiPegawaiId: pid, trainingId: { in: ids } }, select: { trainingId: true } }) : [],
    prisma.sesiPembelajaran.findMany({ where: { trainingId: { in: ids }, tanggal: new Date(`${hariIni}T00:00:00.000Z`) }, select: { trainingId: true, bentuk: true } }),
  ]);
  const pemantau = pembacaSemua(a, ["kepala-balai", "kabag-tu"]);

  const out: FaseDiklatRecord[] = [];
  for (const t of pka) {
    const peran = new Set<PeranDiklat>();
    if (peserta.some((p) => p.trainingId === t.id)) peran.add("peserta");
    if (pengampu.some((p) => p.trainingId === t.id)) peran.add("pengampu");
    if (coach.some((c) => c.trainingId === t.id)) peran.add("coach");
    if (penguji.some((p) => p.trainingId === t.id)) peran.add("penguji");
    if (bolehKelolaDiklat(a, t.timKerjaId)) peran.add("penyelenggara");
    if (pemantau && !peran.has("penyelenggara")) peran.add("pemantau");
    if (!peran.size) continue;

    const mulai = isoTanggal(t.startDate);
    const selesai = t.endDate ? isoTanggal(t.endDate) : null;
    const kur = tahapKurikulum(t.jenisPelatihan, t.modePelatihan);
    const hari = hariPelatihan(mulai, selesai, hariIni);
    const label = labelPendekTahap(kur.map((x) => ({ nama: x.nama, kode: x.tipe })));
    const tanggal = rentangTahap(kur, mulai, selesai);
    out.push({
      trainingId: t.id,
      nama: t.name,
      program: t.jenisPelatihan ?? "",
      mode: labelMode(t.modePelatihan),
      status: t.status,
      mulai,
      selesai,
      hari,
      peran: URUTAN_PERAN.filter((p) => peran.has(p)),
      pesertaId: peserta.find((p) => p.trainingId === t.id)?.id ?? null,
      kelompokCoachId: coach.find((c) => c.trainingId === t.id)?.id ?? null,
      tahap: kur.map((x, i) => ({ nama: x.nama, label: label[i], kode: x.tipe, jp: x.jp, mulai: tanggal[i]?.mulai ?? null, selesai: tanggal[i]?.selesai ?? null })),
      aktif: tahapAktif(kur.map((x) => ({ kode: x.tipe, hari: x.hari })), hari, sesiHariIni.find((s) => s.trainingId === t.id)?.bentuk),
    });
  }
  if (trainingId && !out.length) throw new NotFoundError("Diklat tidak ditemukan");
  return urutkanFase(out);
}
