import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { isoTanggal } from "@/lib/tanggal";
import { jenjangWi, rentangBulan } from "@/lib/dokumen";
import { batasEfektif } from "@/lib/kapasitas";
import { getBatasJenjang, jpBulanMap } from "@/lib/server/repositories/batas-jp-wi";
import { namaMataPelatihan } from "@/lib/kurikulum";
import type { BebanWiRecord, PeriodeBeban } from "@/lib/beban-wi";

/** Halaman Beban JP Widyaiswara (daftar + rincian satu WI). */

const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Rentang periode: bulan "YYYY-MM"; tahun = tahun dari bulan itu; semua = tanpa batas. */
export function rentangPeriode(periode: PeriodeBeban, bulan: string): { gte: Date; lt: Date } | null {
  if (periode === "semua") return null;
  if (periode === "bulan") {
    const r = rentangBulan(bulan);
    return { gte: utc(r.awal), lt: utc(r.akhirEksklusif) };
  }
  const y = Number(bulan.slice(0, 4));
  return { gte: utc(`${y}-01-01`), lt: utc(`${y + 1}-01-01`) };
}

export async function listBebanWi(periode: PeriodeBeban, bulan: string): Promise<BebanWiRecord[]> {
  const rentang = rentangPeriode(periode, bulan);
  const [wi, semua, diPeriode, sesi, batasJenjang, jpBulan]: [
    { id: string; no: number | null; nama: string; jabatan: string | null; status: string | null; jpMaksimal: number | null }[],
    { instructorId: string; jp: number }[],
    { instructorId: string; jp: number }[],
    { jp: number; penugasan: { instructorId: string } }[],
    Awaited<ReturnType<typeof getBatasJenjang>>,
    Map<string, number>,
  ] = await Promise.all([
    prisma.pegawai.findMany({
      where: WI_WHERE,
      select: { id: true, no: true, nama: true, jabatan: true, status: true, jpMaksimal: true },
      orderBy: { no: "asc" },
    }),
    prisma.penugasanApproval.findMany({ where: { status: "disetujui" }, select: { instructorId: true, jp: true } }),
    rentang
      ? prisma.penugasanApproval.findMany({
          where: { status: "disetujui", training: { startDate: rentang } },
          select: { instructorId: true, jp: true },
        })
      : Promise.resolve([]),
    prisma.penugasanSesi.findMany({
      where: { ...(rentang ? { tanggal: rentang } : {}), penugasan: { status: "disetujui" } },
      select: { jp: true, penugasan: { select: { instructorId: true } } },
    }),
    getBatasJenjang(),
    // Batas berlaku per bulan: selalu dihitung untuk `bulan` terpilih, apa pun periodenya.
    jpBulanMap(bulan),
  ]);
  const jumlah = (rows: { instructorId: string; jp: number }[], id: string) =>
    rows.filter((r) => r.instructorId === id).reduce((a, r) => a + r.jp, 0);
  return wi.map((w) => {
    const jpTotal = jumlah(semua, w.id);
    const periodeRows = rentang ? diPeriode : semua;
    const status = (w.status ?? "AKTIF").toUpperCase();
    const jenjang = jenjangWi(w.jabatan);
    const batas = batasEfektif(w.jpMaksimal, jenjang, batasJenjang);
    return {
      id: w.id,
      no: w.no,
      nama: w.nama,
      jabatan: w.jabatan ?? "",
      jenjang,
      status,
      cuti: status === "CUTI",
      jpMaksimal: batas.batas,
      sumberBatas: batas.sumber,
      jpTotal,
      jpBulan: jpBulan.get(w.id) ?? 0,
      jpPeriode: rentang ? jumlah(diPeriode, w.id) : jpTotal,
      penugasanPeriode: periodeRows.filter((r) => r.instructorId === w.id).length,
      jpSesi: sesi.filter((s) => s.penugasan.instructorId === w.id).reduce((a, s) => a + s.jp, 0),
    };
  });
}

export type RincianBebanWiRecord = {
  id: string;
  nama: string;
  jabatan: string;
  /** Batas JP per bulan yang berlaku; null = belum diatur. */
  jpMaksimal: number | null;
  sumberBatas: "wi" | "jenjang" | null;
  jpTotal: number;
  /** JP disetujui pada diklat yang mulai di `bulan`. */
  jpBulan: number;
  penugasan: {
    id: string;
    trainingId: string;
    trainingName: string;
    mulai: string;
    selesai: string | null;
    jp: number;
    status: string;
    mataPelatihan: string | null;
  }[];
  sesiBulan: { id: string; tanggal: string; kegiatan: string; jp: number }[];
  bulan: string;
};

/** Rincian satu WI: penugasan terbaru (disetujui & menunggu) + sesi mengajar pada bulan terpilih. */
export async function rincianBebanWi(id: string, bulan: string): Promise<RincianBebanWiRecord> {
  const w: { id: string; nama: string; jabatan: string | null; jpMaksimal: number | null } | null = await prisma.pegawai.findFirst({
    where: { id, ...WI_WHERE },
    select: { id: true, nama: true, jabatan: true, jpMaksimal: true },
  });
  if (!w) throw new NotFoundError("Widyaiswara tidak ditemukan");
  const r = rentangBulan(bulan);
  const [penugasan, sesi, batasJenjang]: [
    {
      id: string;
      jp: number;
      status: string;
      mataPelatihan: string | null;
      training: { id: string; name: string; startDate: Date; endDate: Date | null };
    }[],
    { id: string; tanggal: Date; kegiatan: string; jp: number }[],
    Awaited<ReturnType<typeof getBatasJenjang>>,
  ] = await Promise.all([
    prisma.penugasanApproval.findMany({
      where: { instructorId: id, status: { in: ["disetujui", "menunggu"] } },
      select: {
        id: true,
        jp: true,
        status: true,
        mataPelatihan: true,
        training: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    }),
    prisma.penugasanSesi.findMany({
      where: { tanggal: { gte: utc(r.awal), lt: utc(r.akhirEksklusif) }, penugasan: { instructorId: id, status: "disetujui" } },
      select: { id: true, tanggal: true, kegiatan: true, jp: true },
      orderBy: { tanggal: "asc" },
    }),
    getBatasJenjang(),
  ]);
  const batas = batasEfektif(w.jpMaksimal, jenjangWi(w.jabatan), batasJenjang);
  const disetujui = penugasan.filter((p) => p.status === "disetujui");
  return {
    id: w.id,
    nama: w.nama,
    jabatan: w.jabatan ?? "",
    jpMaksimal: batas.batas,
    sumberBatas: batas.sumber,
    jpTotal: disetujui.reduce((a, p) => a + p.jp, 0),
    jpBulan: disetujui
      .filter((p) => isoTanggal(p.training.startDate).slice(0, 7) === bulan)
      .reduce((a, p) => a + p.jp, 0),
    penugasan: penugasan
      .sort((a, b) => b.training.startDate.getTime() - a.training.startDate.getTime())
      .slice(0, 30)
      .map((p) => ({
        id: p.id,
        trainingId: p.training.id,
        trainingName: p.training.name,
        mulai: isoTanggal(p.training.startDate),
        selesai: p.training.endDate ? isoTanggal(p.training.endDate) : null,
        jp: p.jp,
        status: p.status,
        mataPelatihan: namaMataPelatihan(p.mataPelatihan) ?? null,
      })),
    sesiBulan: sesi.map((s) => ({ id: s.id, tanggal: isoTanggal(s.tanggal), kegiatan: s.kegiatan, jp: s.jp })),
    bulan,
  };
}
