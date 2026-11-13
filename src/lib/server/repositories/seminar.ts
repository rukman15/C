import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { aksesDiklat, pembacaSemua } from "@/lib/server/akses";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { getJenjang } from "@/lib/kurikulum";
import { daftarAspek } from "@/lib/penilaian";
import { isoTanggal } from "@/lib/tanggal";
import { tambahHari } from "@/lib/sesi";
import {
  infoSeminar,
  periksaJadwalSeminar,
  urutkanJadwalSeminar,
  type IsianJadwalSeminar,
  type InfoSeminar,
  type JenisSeminar,
  type MentorHadir,
  type StatusPanggil,
} from "@/lib/seminar";
import type { FaktaSeminar } from "@/lib/perhatian";
import { JENIS_KELOMPOK_COACH } from "@/lib/kelompok";

/**
 * Seminar aksi perubahan RAP/LAP per peserta (src/lib/seminar.ts, CATATAN-SEMINAR-AKSI-PERUBAHAN.md).
 * Hak:
 *  - KELOLA (susun jadwal, ubah status panggilan): penyelenggara pemegang diklat — admin, Ketua Diklat, anggota tim.
 *    Evaluator (panitia) memakai akun penyelenggara.
 *  - BACA semua: Kepala Balai, Kabag TU, Koordinator WI.
 *  - Penguji: hanya baris peserta yang ia uji (lihat saja).
 * Nilai tidak diubah di sini — tetap lewat tab Penilaian (siapa yang menilai belum diputuskan).
 */

export type AksesSeminar = { kelola: boolean; semua: boolean; pegawaiId: string | null; email: string };

async function trainingSeminar(trainingId: string) {
  const t: { id: string; name: string; jenisPelatihan: string | null; modePelatihan: string | null; timKerjaId: string | null } | null =
    await prisma.training.findUnique({ where: { id: trainingId }, select: { id: true, name: true, jenisPelatihan: true, modePelatihan: true, timKerjaId: true } });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  if (!getJenjang(t.jenisPelatihan)) throw new ValidationError("Seminar aksi perubahan hanya untuk pelatihan PKA/PKP");
  return t;
}

export async function aksesSeminar(trainingId: string): Promise<AksesSeminar> {
  const a = await aksesDiklat();
  const t = await trainingSeminar(trainingId);
  const kelola = bolehKelolaDiklat(a, t.timKerjaId);
  const semua = kelola || pembacaSemua(a, ["kepala-balai", "kabag-tu"]);
  if (!semua) {
    const menguji = a.pegawaiId ? await prisma.seminarPeserta.findFirst({ where: { trainingId, pengujiPegawaiId: a.pegawaiId }, select: { id: true } }) : null;
    if (!menguji) throw new ForbiddenError("Hanya penyelenggara, pimpinan, dan penguji seminar ini.");
  }
  return { kelola, semua, pegawaiId: a.pegawaiId, email: a.email };
}

export async function wajibKelolaSeminar(trainingId: string): Promise<AksesSeminar> {
  const a = await aksesSeminar(trainingId);
  if (!a.kelola) throw new ForbiddenError("Jadwal seminar disusun penyelenggara pemegang diklat.");
  return a;
}

// ------------------------------------------------------------------ BACA

export type BarisSeminarRecord = {
  /** null = peserta belum dijadwalkan. */
  id: string | null;
  pesertaId: string;
  nomor: number;
  nama: string;
  instansi: string | null;
  judulAksiPerubahan: string | null;
  coachNama: string | null;
  tanggal: string | null;
  jamMulai: string | null;
  urutan: number | null;
  ruang: string | null;
  tautanDaring: string | null;
  pengujiPegawaiId: string | null;
  pengujiNama: string | null;
  mentorNama: string | null;
  mentorJabatan: string | null;
  mentorHadir: MentorHadir | null;
  evaluatorNama: string | null;
  status: StatusPanggil;
  statusPada: string | null;
  /** Aspek seminar ini yang sudah ada nilainya (dari tab Penilaian). */
  nilai: { terisi: number; jumlah: number };
};
export type SeminarRecord = {
  training: { id: string; name: string };
  jenis: JenisSeminar;
  info: InfoSeminar;
  bolehKelola: boolean;
  /** true = penguji: hanya peserta yang ia uji. */
  hanyaMilikSaya: boolean;
  baris: BarisSeminarRecord[];
  /** Pilihan penguji (Widyaiswara aktif) — hanya untuk yang boleh kelola. */
  pilihanPenguji: { id: string; nama: string }[];
};

type BarisDb = {
  id: string;
  pesertaId: string;
  tanggal: Date | null;
  jamMulai: string | null;
  urutan: number | null;
  ruang: string | null;
  tautanDaring: string | null;
  pengujiPegawaiId: string | null;
  pengujiNama: string | null;
  mentorNama: string | null;
  mentorJabatan: string | null;
  mentorHadir: string | null;
  evaluatorNama: string | null;
  status: string;
  statusPada: Date | null;
};

const EVALUASI_SEMINAR: Record<JenisSeminar, string> = { RAP: "AKTUALISASI_RANCANGAN", LAP: "AKTUALISASI_IMPLEMENTASI" };

export async function getSeminar(trainingId: string, jenis: JenisSeminar, a: AksesSeminar, hariIni: string): Promise<SeminarRecord> {
  const t = await trainingSeminar(trainingId);
  const peserta: { id: string; nomor: number; nama: string; instansi: string | null; status: string; judulAksiPerubahan: string | null }[] = await prisma.peserta.findMany({
    where: { trainingId, status: "AKTIF" },
    orderBy: { nomor: "asc" },
    select: { id: true, nomor: true, nama: true, instansi: true, status: true, judulAksiPerubahan: true },
  });
  const rows: BarisDb[] = await prisma.seminarPeserta.findMany({ where: { trainingId, jenis } });
  const rowDari = new Map(rows.map((r) => [r.pesertaId, r]));

  // Coach dari kelompok e-learning tiap peserta.
  const kel: { id: string; coachNama: string | null }[] = await prisma.kelompokPeserta.findMany({ where: { trainingId, jenis: JENIS_KELOMPOK_COACH }, select: { id: true, coachNama: true } });
  const anggota: { kelompokId: string; pesertaId: string }[] = kel.length
    ? await prisma.anggotaKelompok.findMany({ where: { kelompokId: { in: kel.map((k) => k.id) } }, select: { kelompokId: true, pesertaId: true } })
    : [];
  const coachDari = new Map(anggota.map((x) => [x.pesertaId, kel.find((k) => k.id === x.kelompokId)?.coachNama ?? null]));

  // Kemajuan nilai aspek seminar ini.
  const kodeAspek = daftarAspek(t.jenisPelatihan, t.modePelatihan)
    .filter((x) => x.jenisEvaluasi === EVALUASI_SEMINAR[jenis])
    .map((x) => x.kode);
  const nilai: { pesertaId: string; kodeAspek: string }[] =
    peserta.length && kodeAspek.length
      ? await prisma.nilaiPeserta.findMany({ where: { pesertaId: { in: peserta.map((p) => p.id) }, kodeAspek: { in: kodeAspek } }, select: { pesertaId: true, kodeAspek: true } })
      : [];

  let baris: BarisSeminarRecord[] = peserta.map((p) => {
    const r = rowDari.get(p.id);
    return {
      id: r?.id ?? null,
      pesertaId: p.id,
      nomor: p.nomor,
      nama: p.nama,
      instansi: p.instansi,
      judulAksiPerubahan: p.judulAksiPerubahan,
      coachNama: coachDari.get(p.id) ?? null,
      tanggal: r?.tanggal ? isoTanggal(r.tanggal) : null,
      jamMulai: r?.jamMulai ?? null,
      urutan: r?.urutan ?? null,
      ruang: r?.ruang ?? null,
      tautanDaring: r?.tautanDaring ?? null,
      pengujiPegawaiId: r?.pengujiPegawaiId ?? null,
      pengujiNama: r?.pengujiNama ?? null,
      mentorNama: r?.mentorNama ?? null,
      mentorJabatan: r?.mentorJabatan ?? null,
      mentorHadir: (r?.mentorHadir as MentorHadir | null) ?? null,
      evaluatorNama: r?.evaluatorNama ?? null,
      status: ((r?.status as StatusPanggil) ?? "MENUNGGU"),
      statusPada: r?.statusPada ? r.statusPada.toISOString() : null,
      nilai: { terisi: new Set(nilai.filter((n) => n.pesertaId === p.id).map((n) => n.kodeAspek)).size, jumlah: kodeAspek.length },
    };
  });
  const hanyaMilikSaya = !a.semua;
  if (hanyaMilikSaya) baris = baris.filter((b) => !!a.pegawaiId && b.pengujiPegawaiId === a.pegawaiId);

  const pilihanPenguji: { id: string; nama: string }[] = a.kelola
    ? await prisma.pegawai.findMany({
        where: { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" }, status: "AKTIF" },
        select: { id: true, nama: true },
        orderBy: { no: "asc" },
      })
    : [];

  return {
    training: { id: t.id, name: t.name },
    jenis,
    info: infoSeminar(t.jenisPelatihan, t.modePelatihan, [], hariIni).find((x) => x.jenis === jenis)!,
    bolehKelola: a.kelola,
    hanyaMilikSaya,
    baris: urutkanJadwalSeminar(baris),
    pilihanPenguji,
  };
}

// ------------------------------------------------------------------ TULIS

const rapikan = (t: string | null | undefined) => (t ?? "").trim() || null;
const barisKosong = (i: IsianJadwalSeminar) =>
  !i.tanggal && !i.jamMulai && i.urutan == null && ![i.ruang, i.tautanDaring, i.pengujiPegawaiId, i.pengujiNama, i.mentorNama, i.mentorJabatan, i.mentorHadir, i.evaluatorNama].some((x) => (x ?? "").trim());

/**
 * Simpan jadwal beberapa peserta sekaligus. Penguji dari daftar pegawai (nama diambil dari data pegawai) atau
 * nama bebas bila penguji dari luar balai. Baris yang dikosongkan seluruhnya = jadwal peserta itu dihapus.
 */
export async function simpanJadwal(trainingId: string, jenis: JenisSeminar, isian: IsianJadwalSeminar[], email: string): Promise<{ disimpan: number; dihapus: number }> {
  await trainingSeminar(trainingId);
  const pesertaIds = new Set(
    (await prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: { id: true } })).map((p: { id: string }) => p.id),
  );
  // Periksa semua dulu supaya tidak tersimpan setengah.
  const siap: { i: IsianJadwalSeminar; tautanDaring: string | null; pengujiNama: string | null }[] = [];
  for (const [n, i] of isian.entries()) {
    if (!pesertaIds.has(i.pesertaId)) throw new NotFoundError(`Baris ${n + 1}: peserta tidak ditemukan pada jadwal ini (atau tidak aktif)`);
    const hasil = periksaJadwalSeminar(i);
    if ("galat" in hasil) throw new ValidationError(`Baris ${n + 1}: ${hasil.galat}`);
    let pengujiNama = rapikan(i.pengujiNama);
    if (i.pengujiPegawaiId) {
      const pg: { nama: string } | null = await prisma.pegawai.findUnique({ where: { id: i.pengujiPegawaiId }, select: { nama: true } });
      if (!pg) throw new NotFoundError(`Baris ${n + 1}: penguji tidak ditemukan di data pegawai`);
      pengujiNama = pg.nama;
    }
    siap.push({ i, tautanDaring: hasil.tautanDaring, pengujiNama });
  }
  let disimpan = 0;
  let dihapus = 0;
  for (const { i, tautanDaring, pengujiNama } of siap) {
    const ada: { id: string } | null = await prisma.seminarPeserta.findFirst({ where: { pesertaId: i.pesertaId, jenis }, select: { id: true } });
    if (barisKosong(i)) {
      if (ada) {
        await prisma.seminarPeserta.deleteMany({ where: { id: ada.id } });
        dihapus++;
      }
      continue;
    }
    const data = {
      tanggal: i.tanggal ? new Date(`${i.tanggal}T00:00:00.000Z`) : null,
      jamMulai: i.jamMulai || null,
      urutan: i.urutan ?? null,
      ruang: rapikan(i.ruang),
      tautanDaring,
      pengujiPegawaiId: i.pengujiPegawaiId || null,
      pengujiNama,
      mentorNama: rapikan(i.mentorNama),
      mentorJabatan: rapikan(i.mentorJabatan),
      mentorHadir: i.mentorHadir || null,
      evaluatorNama: rapikan(i.evaluatorNama),
      diubahOleh: email,
    };
    if (ada) await prisma.seminarPeserta.update({ where: { id: ada.id }, data });
    else await prisma.seminarPeserta.create({ data: { ...data, trainingId, pesertaId: i.pesertaId, jenis } });
    disimpan++;
  }
  return { disimpan, dihapus };
}

/** Evaluator mengubah status panggilan satu peserta (menunggu → dipanggil → presentasi → selesai / tidak hadir). */
export async function aturStatus(trainingId: string, id: string, status: StatusPanggil, email: string, now: Date = new Date()): Promise<void> {
  const r: { id: string } | null = await prisma.seminarPeserta.findFirst({ where: { id, trainingId }, select: { id: true } });
  if (!r) throw new NotFoundError("Jadwal seminar tidak ditemukan");
  await prisma.seminarPeserta.update({ where: { id }, data: { status, statusPada: now, diubahOleh: email } });
}

// ------------------------------------------------------------------ PESERTA & PENGUJI

export type SeminarSayaRecord = {
  jenis: JenisSeminar;
  tanggal: string | null;
  jamMulai: string | null;
  urutan: number | null;
  ruang: string | null;
  tautanDaring: string | null;
  pengujiNama: string | null;
  mentorHadir: MentorHadir | null;
  status: StatusPanggil;
};

/** Jadwal seminar milik satu peserta (ruang belajar). */
export async function seminarPeserta(pesertaId: string): Promise<SeminarSayaRecord[]> {
  const rows: (BarisDb & { jenis: string })[] = await prisma.seminarPeserta.findMany({ where: { pesertaId } });
  return rows
    .map((r) => ({
      jenis: r.jenis as JenisSeminar,
      tanggal: r.tanggal ? isoTanggal(r.tanggal) : null,
      jamMulai: r.jamMulai,
      urutan: r.urutan,
      ruang: r.ruang,
      tautanDaring: r.tautanDaring,
      pengujiNama: r.pengujiNama,
      mentorHadir: r.mentorHadir as MentorHadir | null,
      status: r.status as StatusPanggil,
    }))
    .sort((a, b) => (a.jenis === "RAP" ? 0 : 1) - (b.jenis === "RAP" ? 0 : 1));
}

/** Perlu perhatian penguji: seminar yang ia uji hari ini s.d. `hari` ke depan. */
export async function faktaSeminar(pegawaiId: string | null, hariIni: string, hari = 7): Promise<FaktaSeminar> {
  if (!pegawaiId) return { menguji: [] };
  const rows: { trainingId: string; jenis: string; tanggal: Date | null }[] = await prisma.seminarPeserta.findMany({
    where: { pengujiPegawaiId: pegawaiId, tanggal: { gte: new Date(`${hariIni}T00:00:00.000Z`), lte: new Date(`${tambahHari(hariIni, hari)}T00:00:00.000Z`) } },
    select: { trainingId: true, jenis: true, tanggal: true },
  });
  const grup = new Map<string, { trainingId: string; jenis: JenisSeminar; tanggal: string; jumlah: number }>();
  for (const r of rows) {
    if (!r.tanggal) continue;
    const tanggal = isoTanggal(r.tanggal);
    const k = `${r.trainingId}|${r.jenis}|${tanggal}`;
    const g = grup.get(k);
    if (g) g.jumlah++;
    else grup.set(k, { trainingId: r.trainingId, jenis: r.jenis as JenisSeminar, tanggal, jumlah: 1 });
  }
  const ids = [...new Set([...grup.values()].map((g) => g.trainingId))];
  const nama: { id: string; name: string }[] = ids.length ? await prisma.training.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  return {
    menguji: [...grup.values()]
      .map((g) => ({ ...g, training: nama.find((n) => n.id === g.trainingId)?.name ?? "" }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
  };
}
