import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { UserRole } from "@/lib/roles";
import { listTrainingWithUrgensi } from "@/lib/server/repositories/training";
import { masalahPresensi } from "@/lib/server/repositories/pembelajaran";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { tambahHari } from "@/lib/sesi";
import { statusTes, isJenisTes } from "@/lib/tes";
import { MIN_RESPONDEN_TAMPIL } from "@/lib/evaluasi";
import {
  HARI_JADWAL_DEPAN,
  HARI_KABAR_BARU,
  perhatianCoaching,
  perhatianSeminar,
  perhatianPegawai,
  perhatianPenyelenggara,
  perhatianWi,
  urutkanPerhatian,
  type ButirPerhatian,
  type FaktaPegawai,
  type FaktaPenyelenggara,
  type FaktaWi,
} from "@/lib/perhatian";
import { labelJenisCuti } from "@/lib/persuratan";
import { suratTugasSaya } from "@/lib/server/repositories/saya";
import { faktaCoaching } from "@/lib/server/repositories/coaching";
import { faktaSeminar } from "@/lib/server/repositories/seminar";

/**
 * Kumpulkan fakta "Perlu perhatian" untuk akun yang login (lihat @/lib/perhatian.ts).
 * Read-only. Hanya data milik akun itu sendiri untuk WI; ringkasan seluruh balai
 * untuk penyelenggara (admin, Ketua Diklat). Peran lain: kosong.
 */
export type PembacaPerhatian = { role: UserRole; email: string; pegawaiId: string | null };

/** Tanggal kalender WIB "YYYY-MM-DD" dari sebuah waktu. */
const tglWib = (d: Date | null | undefined) => (d ? isoTanggal(awalHariWib(d)) : null);

async function namaTraining(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows: { id: string; name: string }[] = await prisma.training.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function faktaWi(email: string, pegawaiId: string | null, now: Date): Promise<FaktaWi> {
  const hariIni = awalHariWib(now);

  // Soal milik WI ini — filter sama dengan Bank Soal untuk peran WI.
  const soalRows: { status: string; catatanPeriksa: string | null; diperiksaOleh: string | null; updatedAt: Date }[] =
    await prisma.soalTes.findMany({
      where: { OR: [{ dibuatOleh: email }, ...(pegawaiId ? [{ pegawaiId }] : [])] },
      select: { status: true, catatanPeriksa: true, diperiksaOleh: true, updatedAt: true },
    });

  if (!pegawaiId) {
    return {
      soal: soalRows.map((s) => ({ status: s.status, catatanPeriksa: s.catatanPeriksa, diperiksa: !!s.diperiksaOleh, diperbarui: tglWib(s.updatedAt)! })),
      penugasan: [],
      sesi: [],
      evaluasi: [],
      minResponden: MIN_RESPONDEN_TAMPIL,
    };
  }

  const penugasanRows: { id: string; trainingId: string; status: string; diputuskanPada: Date | null; catatan: string | null }[] =
    await prisma.penugasanApproval.findMany({
      where: { instructorId: pegawaiId },
      select: { id: true, trainingId: true, status: true, diputuskanPada: true, catatan: true },
    });

  const idDisetujui = penugasanRows.filter((p) => p.status === "disetujui").map((p) => p.id);
  const sesiRows: { penugasanId: string; tanggal: Date; kegiatan: string; jp: number }[] = idDisetujui.length
    ? await prisma.penugasanSesi.findMany({
        where: {
          penugasanId: { in: idDisetujui },
          tanggal: { gte: hariIni, lte: new Date(`${tambahHari(isoTanggal(hariIni), HARI_JADWAL_DEPAN)}T00:00:00Z`) },
        },
        select: { penugasanId: true, tanggal: true, kegiatan: true, jp: true },
        orderBy: { tanggal: "asc" },
      })
    : [];

  const evaluasiRows: { trainingId: string; sasaranKunci: string; createdAt: Date; updatedAt: Date }[] = await prisma.evaluasiPengajar.findMany({
    where: { pegawaiId },
    select: { trainingId: true, sasaranKunci: true, createdAt: true, updatedAt: true },
  });

  const nama = await namaTraining([...penugasanRows.map((p) => p.trainingId), ...evaluasiRows.map((e) => e.trainingId)]);
  const trainingPenugasan = new Map(penugasanRows.map((p) => [p.id, p.trainingId]));

  const grupEvaluasi = new Map<string, { trainingId: string; responden: number; terbaru: Date }>();
  for (const e of evaluasiRows) {
    const k = `${e.trainingId}|${e.sasaranKunci}`;
    const t = e.updatedAt > e.createdAt ? e.updatedAt : e.createdAt;
    const g = grupEvaluasi.get(k);
    if (g) {
      g.responden++;
      if (t > g.terbaru) g.terbaru = t;
    } else grupEvaluasi.set(k, { trainingId: e.trainingId, responden: 1, terbaru: t });
  }

  return {
    soal: soalRows.map((s) => ({ status: s.status, catatanPeriksa: s.catatanPeriksa, diperiksa: !!s.diperiksaOleh, diperbarui: tglWib(s.updatedAt)! })),
    penugasan: penugasanRows.map((p) => ({
      training: nama.get(p.trainingId) ?? "(jadwal dihapus)",
      status: p.status,
      diputuskanPada: tglWib(p.diputuskanPada),
      catatan: p.catatan,
    })),
    sesi: sesiRows.map((s) => ({
      tanggal: isoTanggal(s.tanggal),
      kegiatan: s.kegiatan,
      jp: s.jp,
      training: nama.get(trainingPenugasan.get(s.penugasanId) ?? "") ?? "",
    })),
    evaluasi: [...grupEvaluasi.values()].map((g) => ({
      training: nama.get(g.trainingId) ?? "",
      responden: g.responden,
      terbaru: tglWib(g.terbaru)!,
    })),
    minResponden: MIN_RESPONDEN_TAMPIL,
  };
}

async function faktaPenyelenggara(now: Date): Promise<FaktaPenyelenggara> {
  const list = await listTrainingWithUrgensi();
  const namaDari = new Map(list.map((t) => [t.id, t.name]));

  const soal: { program: string }[] = await prisma.soalTes.findMany({ where: { status: "DIAJUKAN" }, select: { program: true } });
  const penugasanMenunggu: number = await prisma.penugasanApproval.count({ where: { status: "menunggu" } });
  const registrasiMenunggu: number = await prisma.profilPeserta.count({ where: { status: "MENUNGGU" } });

  const tesRows: { trainingId: string; jenis: string; status: string; buka: Date | null; tutup: Date | null }[] = await prisma.tes.findMany({
    where: { status: "TERBIT" },
    select: { trainingId: true, jenis: true, status: true, buka: true, tutup: true },
  });

  // Presensi harian (keputusan 14 Okt): hari yang sudah lewat, sesi ada, catatan belum lengkap.
  const kemarin = isoTanggal(new Date(awalHariWib(now).getTime() - 86_400_000));
  const presensiBelumLengkap: FaktaPenyelenggara["presensiBelumLengkap"] = [];
  for (const t of list.filter((x) => x.status === "Berjalan")) {
    const m = await masalahPresensi(t.id, kemarin);
    if (m.belumLengkap.length || m.tanpaSesi.length)
      presensiBelumLengkap.push({ id: t.id, name: t.name, hari: m.belumLengkap.length, tanpaSesi: m.tanpaSesi.length });
  }

  const selesai = list.filter((t) => t.status === "Selesai").map((t) => t.id);
  const belumDitutup: { id: string }[] = selesai.length
    ? await prisma.training.findMany({ where: { id: { in: selesai }, evaluasiDitutup: false }, select: { id: true } })
    : [];
  const idBelum = { trainingId: { in: belumDitutup.map((t) => t.id) } };
  const adaIsian = new Set(
    belumDitutup.length
      ? [
          ...(await prisma.evaluasiPengajar.findMany({ where: idBelum, select: { trainingId: true } })),
          ...(await prisma.evaluasiPenyelenggaraan.findMany({ where: idBelum, select: { trainingId: true } })),
        ].map((e: { trainingId: string }) => e.trainingId)
      : [],
  );

  return {
    soalMenunggu: soal.map((s) => s.program),
    penugasanMenunggu,
    diklatTanpaWi: list
      .filter((t) => t.status !== "Selesai" && t.wiDisetujui === 0)
      .map((t) => ({ id: t.id, name: t.name, startDate: t.startDate.slice(0, 10) })),
    tes: tesRows
      .filter((t) => isJenisTes(t.jenis))
      .map((t) => ({
        trainingId: t.trainingId,
        training: namaDari.get(t.trainingId) ?? "",
        jenis: t.jenis as "PRE" | "POST",
        status: statusTes(t, now),
        buka: tglWib(t.buka),
        tutup: tglWib(t.tutup),
      }))
      .sort((a, b) => (a.buka ?? "").localeCompare(b.buka ?? "")),
    registrasiMenunggu,
    evaluasiBelumDitutup: belumDitutup.filter((t) => adaIsian.has(t.id)).map((t) => ({ id: t.id, name: namaDari.get(t.id) ?? "" })),
    presensiBelumLengkap,
  };
}

const termasuk = (role: UserRole, daftar: UserRole[]) => role === "admin" || daftar.includes(role);

/**
 * Fakta semua pegawai: disposisi & cuti milik sendiri, surat tugas beberapa hari ke depan, dan
 * antrean kerja menurut peran (pemutus cuti, pemberi disposisi, penomor). `persuratan` = modul
 * persuratan (surat tugas umum ikut dibaca).
 */
async function faktaPegawai(p: PembacaPerhatian, now: Date, persuratan: boolean): Promise<FaktaPegawai> {
  const hariIni = isoTanggal(awalHariWib(now));
  const batasDepan = tambahHari(hariIni, HARI_JADWAL_DEPAN);
  const fakta: FaktaPegawai = { disposisiBaru: [], cutiSayaDiputuskan: [], suratTugasSaya: [], cutiMenunggu: null, suratMasukBelumDisposisi: null, cutiBelumBernomor: null };
  if (p.pegawaiId) {
    const id = p.pegawaiId;
    if (persuratan) {
      const disp: { suratMasuk: { hal: string } }[] = await prisma.disposisi.findMany({ where: { kepadaPegawaiId: id, status: "BARU" }, select: { suratMasuk: { select: { hal: true } } } });
      fakta.disposisiBaru = disp.map((d) => ({ hal: d.suratMasuk.hal }));
      const batasKabar = new Date(`${tambahHari(hariIni, -HARI_KABAR_BARU)}T00:00:00Z`);
      const cuti: { jenis: string; status: string; diputuskanPada: Date | null; alasanTolak: string | null }[] = await prisma.cutiPegawai.findMany({
        where: { pegawaiId: id, status: { in: ["DISETUJUI", "DITOLAK"] }, diputuskanPada: { gte: batasKabar } },
        select: { jenis: true, status: true, diputuskanPada: true, alasanTolak: true },
      });
      fakta.cutiSayaDiputuskan = cuti.map((c) => ({ label: labelJenisCuti(c.jenis), status: c.status, diputuskanPada: tglWib(c.diputuskanPada)!, alasanTolak: c.alasanTolak }));
    }
    for (const s of await suratTugasSaya(id, { umum: persuratan })) {
      if (!s.nomor) continue;
      const hari = s.tanggalTugas.find((r) => r.selesai >= hariIni && r.mulai <= batasDepan);
      if (hari) fakta.suratTugasSaya.push({ hal: s.hal, tanggal: hari.mulai < hariIni ? hariIni : hari.mulai });
    }
  }
  if (persuratan) {
    if (termasuk(p.role, ["kabag-tu", "kepala-balai"]))
      fakta.cutiMenunggu = await prisma.cutiPegawai.count({ where: { status: "DIAJUKAN", ...(p.pegawaiId ? { pegawaiId: { not: p.pegawaiId } } : {}) } });
    if (termasuk(p.role, ["kabag-tu", "kepala-balai"])) {
      const masuk: { id: string }[] = await prisma.suratMasuk.findMany({ where: { selesai: false }, select: { id: true } });
      const sudah = new Set(
        masuk.length ? (await prisma.disposisi.findMany({ where: { suratMasukId: { in: masuk.map((m) => m.id) } }, select: { suratMasukId: true } })).map((d: { suratMasukId: string }) => d.suratMasukId) : [],
      );
      fakta.suratMasukBelumDisposisi = masuk.filter((m) => !sudah.has(m.id)).length;
    }
    if (termasuk(p.role, ["kabag-tu", "kepegawaian"])) fakta.cutiBelumBernomor = await prisma.cutiPegawai.count({ where: { status: "DISETUJUI", nomorNotaDinas: null } });
  }
  return fakta;
}

export async function getPerhatian(p: PembacaPerhatian, now: Date = new Date(), o: { persuratan?: boolean } = {}): Promise<ButirPerhatian[]> {
  const hariIni = isoTanggal(awalHariWib(now));
  const peran =
    p.role === "widyaiswara"
      ? perhatianWi(await faktaWi(p.email, p.pegawaiId, now), hariIni)
      : p.role === "admin" || p.role === "ketua-diklat"
        ? perhatianPenyelenggara(await faktaPenyelenggara(now), hariIni)
        : [];
  // Ruang Coaching: coach (pertanyaan belum terjawab) & peserta (tulisan baru, video pengantar) — semua peran.
  const akun: { id: string } | null = await prisma.akun.findUnique({ where: { email: p.email }, select: { id: true } });
  const coaching = akun ? perhatianCoaching(await faktaCoaching({ akunId: akun.id, pegawaiId: p.pegawaiId })) : [];
  const seminar = perhatianSeminar(await faktaSeminar(p.pegawaiId, hariIni), hariIni);
  return urutkanPerhatian([...perhatianPegawai(await faktaPegawai(p, now, o.persuratan ?? false), hariIni), ...peran, ...coaching, ...seminar]);
}
