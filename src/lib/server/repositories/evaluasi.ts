import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { namaMataPelatihan } from "@/lib/kurikulum";
import { labelKelompok } from "@/lib/kelompok";
import { kelompokElearningPeserta } from "@/lib/server/repositories/kelompok";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { LABEL_KUALIFIKASI } from "@/lib/penilaian";
import {
  CATATAN_EVALUASI_MAKS,
  DEFINISI_FORMULIR,
  MIN_RESPONDEN_TAMPIL,
  kunciCoachKelompok,
  kunciPengampu,
  kunciSasaranLain,
  periksaIsianEvaluasi,
  rekapSasaran,
  type FormulirEvaluasi,
  type RekapSasaran,
} from "@/lib/evaluasi";
import {
  LABEL_KUALIFIKASI_23B,
  kualifikasi23B,
  mulaiIsi23B,
  pakaiFormulir23B,
  periksaIsian23B,
  rekap23B,
  type Rekap23B,
} from "@/lib/evaluasi-penyelenggaraan";

/**
 * Evaluasi oleh peserta (BARU — pengganti Google Form evaluasi WI & penyelenggara).
 *  - Sasaran PENGAMPU otomatis dari penugasan WI yang disetujui: satu per (WI, mata
 *    pelatihan). Bisa diisi sejak sesi pertama WI/mata pelatihan itu di jadwal.
 *  - Sasaran COACH otomatis dari coach tiap kelompok (tab Kelompok, PKA/PKP) — hanya
 *    anggota kelompok itu yang mengisi.
 *  - Sasaran lain (penceramah, coach, penguji, mentor) ditambahkan penyelenggara.
 *  - Isian peserta RAHASIA: rekap hanya rata-rata; WI melihat rekapnya sendiri bila
 *    respondennya ≥ MIN_RESPONDEN_TAMPIL.
 *  - Evaluasi penyelenggaraan (Formulir 23B, hanya PKA/PKP): satu isian per peserta,
 *    dibuka pada hari-hari terakhir pelatihan; ditutup bersama evaluasi pengajar.
 */

export type PelakuEvaluasi = { peran: "PENYELENGGARA" | "PIMPINAN" | "WI"; email: string; pegawaiId: string | null };

export type SasaranRecord = {
  kunci: string;
  formulir: FormulirEvaluasi;
  label: string; // "Pengampu Materi"
  nama: string;
  keterangan: string | null; // mata pelatihan / materi / kelompok
  pegawaiId: string | null;
  mataPelatihan: string | null;
  tersediaMulai: string; // YYYY-MM-DD
  sasaranId: string | null; // SasaranEvaluasi.id (bukan pengampu)
  kelompokId: string | null; // coach kelompok: hanya anggota kelompok ini yang mengisi
};

type TrainingEval = { id: string; name: string; startDate: Date; endDate: Date | null; evaluasiDitutup?: boolean | null; jenisPelatihan: string | null; angkatan: string | null };

async function trainingAtau404(id: string): Promise<TrainingEval> {
  const t: TrainingEval | null = await prisma.training.findUnique({ where: { id } });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  return t;
}

/** Semua sasaran evaluasi satu jadwal. */
export async function daftarSasaran(trainingId: string): Promise<SasaranRecord[]> {
  const t = await trainingAtau404(trainingId);
  const mulaiDiklat = isoTanggal(t.startDate);
  const pen: { id: string; instructorId: string; mataPelatihan: string | null; instructor: { nama: string } | null; sesi: { tanggal: Date }[] }[] =
    await prisma.penugasanApproval.findMany({
      where: { trainingId, status: "disetujui" },
      select: { id: true, instructorId: true, mataPelatihan: true, instructor: { select: { nama: true } }, sesi: { select: { tanggal: true } } },
    });
  const sesiMp: { tanggal: Date; mataPelatihan: string | null }[] = await prisma.sesiPembelajaran.findMany({
    where: { trainingId },
    select: { tanggal: true, mataPelatihan: true },
  });
  const pengampu = new Map<string, SasaranRecord>();
  for (const p of pen) {
    const kunci = kunciPengampu(p.instructorId, p.mataPelatihan);
    // Tanggal pertama WI mengajar (sesi mengajar) atau sesi mata pelatihan itu di jadwal kelas.
    const tgl = [
      ...p.sesi.map((s) => isoTanggal(s.tanggal)),
      ...(p.mataPelatihan ? sesiMp.filter((s) => s.mataPelatihan === p.mataPelatihan).map((s) => isoTanggal(s.tanggal)) : []),
    ].sort();
    const ada = pengampu.get(kunci);
    const mulai = tgl[0] ?? mulaiDiklat;
    if (ada) {
      if (mulai < ada.tersediaMulai) ada.tersediaMulai = mulai;
      continue;
    }
    pengampu.set(kunci, {
      kunci,
      formulir: "PENGAMPU",
      label: DEFINISI_FORMULIR.PENGAMPU.label,
      nama: p.instructor?.nama ?? "(Widyaiswara)",
      keterangan: p.mataPelatihan ? (namaMataPelatihan(p.mataPelatihan) ?? p.mataPelatihan) : null,
      pegawaiId: p.instructorId,
      mataPelatihan: p.mataPelatihan,
      tersediaMulai: mulai < mulaiDiklat ? mulaiDiklat : mulai,
      sasaranId: null,
      kelompokId: null,
    });
  }
  const lain: { id: string; formulir: string; nama: string; pegawaiId: string | null; keterangan: string | null }[] = await prisma.sasaranEvaluasi.findMany({
    where: { trainingId },
    orderBy: { createdAt: "asc" },
  });
  const coach: { id: string; nomor: number; nama: string | null; coachNama: string | null; coachPegawaiId: string | null }[] = await prisma.kelompokPeserta.findMany({
    where: { trainingId, jenis: "ELEARNING", coachNama: { not: null } },
    orderBy: { nomor: "asc" },
  });
  return [
    ...[...pengampu.values()].sort((a, b) => a.tersediaMulai.localeCompare(b.tersediaMulai) || a.nama.localeCompare(b.nama)),
    ...coach.map((k) => ({
      kunci: kunciCoachKelompok(k.id),
      formulir: "COACH" as const,
      label: DEFINISI_FORMULIR.COACH.label,
      nama: k.coachNama ?? "",
      keterangan: labelKelompok(k),
      pegawaiId: k.coachPegawaiId,
      mataPelatihan: null,
      tersediaMulai: mulaiDiklat,
      sasaranId: null,
      kelompokId: k.id,
    })),
    ...lain.map((s) => {
      const formulir = s.formulir as FormulirEvaluasi;
      return {
        kunci: kunciSasaranLain(s.id),
        formulir,
        label: DEFINISI_FORMULIR[formulir]?.label ?? s.formulir,
        nama: s.nama,
        keterangan: s.keterangan,
        pegawaiId: s.pegawaiId,
        mataPelatihan: null,
        tersediaMulai: mulaiDiklat,
        sasaranId: s.id,
        kelompokId: null,
      };
    }),
  ];
}

// ------------------------------------------------------------------ PESERTA

export type EvaluasiPesertaRecord = {
  training: { id: string; name: string };
  ditutup: boolean;
  pratinjau: boolean;
  sasaran: (SasaranRecord & {
    tersedia: boolean;
    sudah: boolean;
    isian: { nilai: Record<string, number>; catatan: string | null } | null;
  })[];
  /** Formulir 23B; null bila jadwal bukan PKA/PKP. */
  penyelenggaraan: {
    tersediaMulai: string;
    tersedia: boolean;
    sudah: boolean;
    isian: { nilai: Record<string, number>; catatan: string | null } | null;
  } | null;
};

const mulai23B = (t: TrainingEval) => mulaiIsi23B(isoTanggal(t.startDate), t.endDate ? isoTanggal(t.endDate) : null);

async function pesertaMilik(pesertaId: string, pembaca: { pratinjau: true } | { pratinjau: false; email: string }) {
  const baris: { id: string; trainingId: string; status: string; akunId: string | null } | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { id: true, trainingId: true, status: true, akunId: true },
  });
  // Kelompok e-learning (coach) — membatasi sasaran evaluasi coach.
  const ps = baris ? { ...baris, kelompokId: await kelompokElearningPeserta(baris.id) } : null;
  if (!ps) throw new NotFoundError("Data peserta tidak ditemukan");
  if (!pembaca.pratinjau) {
    const akun: { id: string } | null = await prisma.akun.findUnique({ where: { email: pembaca.email }, select: { id: true } });
    if (!akun || ps.akunId !== akun.id) throw new NotFoundError("Data peserta tidak ditemukan");
  }
  return ps;
}

export async function getEvaluasiPeserta(
  pesertaId: string,
  pembaca: { pratinjau: true } | { pratinjau: false; email: string },
  now: Date = new Date(),
): Promise<EvaluasiPesertaRecord> {
  const ps = await pesertaMilik(pesertaId, pembaca);
  const t = await trainingAtau404(ps.trainingId);
  const hariIni = isoTanggal(awalHariWib(now));
  // Pratinjau penyelenggara melihat semua; peserta hanya coach kelompoknya sendiri.
  const sasaran = (await daftarSasaran(ps.trainingId)).filter((s) => pembaca.pratinjau || untukPeserta(s, ps.kelompokId));
  const isian: { sasaranKunci: string; nilai: unknown; catatan: string | null }[] = pembaca.pratinjau
    ? []
    : await prisma.evaluasiPengajar.findMany({ where: { pesertaId }, select: { sasaranKunci: true, nilai: true, catatan: true } });
  const per = new Map(isian.map((i) => [i.sasaranKunci, i]));
  let penyelenggaraan: EvaluasiPesertaRecord["penyelenggaraan"] = null;
  if (pakaiFormulir23B(t.jenisPelatihan)) {
    const i23: { nilai: unknown; catatan: string | null } | null = pembaca.pratinjau
      ? null
      : await prisma.evaluasiPenyelenggaraan.findUnique({ where: { pesertaId }, select: { nilai: true, catatan: true } });
    const tersediaMulai = mulai23B(t);
    penyelenggaraan = {
      tersediaMulai,
      tersedia: tersediaMulai <= hariIni,
      sudah: !!i23,
      isian: i23 ? { nilai: (i23.nilai ?? {}) as Record<string, number>, catatan: i23.catatan } : null,
    };
  }
  return {
    training: { id: t.id, name: t.name },
    ditutup: !!t.evaluasiDitutup,
    pratinjau: pembaca.pratinjau,
    sasaran: sasaran.map((s) => {
      const i = per.get(s.kunci);
      return {
        ...s,
        tersedia: s.tersediaMulai <= hariIni,
        sudah: !!i,
        isian: i ? { nilai: (i.nilai ?? {}) as Record<string, number>, catatan: i.catatan } : null,
      };
    }),
    penyelenggaraan,
  };
}

const untukPeserta = (s: SasaranRecord, kelompokId: string | null) => !s.kelompokId || s.kelompokId === kelompokId;

/** Jumlah evaluasi yang bisa diisi tetapi belum (untuk beranda), termasuk Formulir 23B. */
export async function evaluasiTertunda(trainingId: string, pesertaId: string, now: Date = new Date()): Promise<number> {
  const t = await trainingAtau404(trainingId);
  if (t.evaluasiDitutup) return 0;
  const hariIni = isoTanggal(awalHariWib(now));
  let n = 0;
  if (pakaiFormulir23B(t.jenisPelatihan) && mulai23B(t) <= hariIni) {
    const ada: number = await prisma.evaluasiPenyelenggaraan.count({ where: { pesertaId } });
    if (!ada) n++;
  }
  const kelompokId = await kelompokElearningPeserta(pesertaId);
  const sasaran = (await daftarSasaran(trainingId)).filter((s) => s.tersediaMulai <= hariIni && untukPeserta(s, kelompokId));
  if (!sasaran.length) return n;
  const sudah = new Set(
    (await prisma.evaluasiPengajar.findMany({ where: { pesertaId }, select: { sasaranKunci: true } })).map((x: { sasaranKunci: string }) => x.sasaranKunci),
  );
  return n + sasaran.filter((s) => !sudah.has(s.kunci)).length;
}

export async function simpanEvaluasi(
  pesertaId: string,
  email: string,
  input: { sasaranKunci: string; nilai: Record<string, number | null>; catatan?: string | null },
  now: Date = new Date(),
): Promise<void> {
  const ps = await pesertaMilik(pesertaId, { pratinjau: false, email });
  if (ps.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const t = await trainingAtau404(ps.trainingId);
  if (t.evaluasiDitutup) throw new ConflictError("Evaluasi sudah ditutup penyelenggara");
  const s = (await daftarSasaran(ps.trainingId)).find((x) => x.kunci === input.sasaranKunci);
  if (!s || !untukPeserta(s, ps.kelompokId)) throw new NotFoundError("Sasaran evaluasi tidak ditemukan");
  if (s.tersediaMulai > isoTanggal(awalHariWib(now))) throw new ConflictError("Evaluasi ini baru bisa diisi setelah sesinya berlangsung");
  const hasil = periksaIsianEvaluasi(s.formulir, input.nilai);
  if ("galat" in hasil) throw new ValidationError(hasil.galat);
  const catatan = input.catatan?.trim().slice(0, CATATAN_EVALUASI_MAKS) || null;
  const data = {
    trainingId: ps.trainingId,
    formulir: s.formulir,
    namaSasaran: s.nama,
    pegawaiId: s.pegawaiId,
    mataPelatihan: s.mataPelatihan,
    nilai: hasil.nilai,
    rataRata: hasil.rata,
    catatan,
  };
  await prisma.evaluasiPengajar.upsert({
    where: { pesertaId_sasaranKunci: { pesertaId, sasaranKunci: s.kunci } },
    update: data,
    create: { ...data, pesertaId, sasaranKunci: s.kunci },
  });
}

/** Isi/ubah Formulir 23B milik peserta sendiri (selama belum ditutup). */
export async function simpanEvaluasiPenyelenggaraan(
  pesertaId: string,
  email: string,
  input: { nilai: Record<string, number | null>; catatan?: string | null },
  now: Date = new Date(),
): Promise<void> {
  const ps = await pesertaMilik(pesertaId, { pratinjau: false, email });
  if (ps.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const t = await trainingAtau404(ps.trainingId);
  if (!pakaiFormulir23B(t.jenisPelatihan)) throw new NotFoundError("Evaluasi penyelenggaraan tidak tersedia untuk pelatihan ini");
  if (t.evaluasiDitutup) throw new ConflictError("Evaluasi sudah ditutup penyelenggara");
  const mulai = mulai23B(t);
  if (mulai > isoTanggal(awalHariWib(now))) throw new ConflictError("Evaluasi penyelenggaraan baru bisa diisi pada hari-hari terakhir pelatihan");
  const hasil = periksaIsian23B(input.nilai);
  if ("galat" in hasil) throw new ValidationError(hasil.galat);
  const data = { nilai: hasil.nilai, rataRata: hasil.rata, catatan: input.catatan?.trim().slice(0, CATATAN_EVALUASI_MAKS) || null };
  await prisma.evaluasiPenyelenggaraan.upsert({
    where: { pesertaId },
    update: data,
    create: { ...data, pesertaId, trainingId: ps.trainingId },
  });
}

// ------------------------------------------------------------------ PENYELENGGARA

export type RekapSasaranRecord = SasaranRecord & RekapSasaran & { labelKualifikasi: string | null; catatan: string[] };

export type RekapEvaluasiRecord = {
  training: { id: string; name: string; jenisPelatihan: string | null; angkatan: string | null };
  ditutup: boolean;
  bolehKelola: boolean;
  pesertaAktif: number;
  pesertaBerakun: number;
  sasaran: RekapSasaranRecord[];
  /** Rekap Formulir 23B; null bila jadwal bukan PKA/PKP. */
  penyelenggaraan: (Rekap23B & { tersediaMulai: string; labelKualifikasi: string | null; catatan: string[] }) | null;
};

type IsianRow = { sasaranKunci: string; nilai: unknown; rataRata: number; catatan: string | null };

function kelompokkan(rows: IsianRow[]): Map<string, IsianRow[]> {
  const m = new Map<string, IsianRow[]>();
  for (const r of rows) {
    const a = m.get(r.sasaranKunci);
    if (a) a.push(r);
    else m.set(r.sasaranKunci, [r]);
  }
  return m;
}

const rekapDari = (formulir: FormulirEvaluasi, rows: IsianRow[]) =>
  rekapSasaran(formulir, rows.map((r) => ({ nilai: (r.nilai ?? {}) as Record<string, number>, rata: r.rataRata })));

// Saran ditampilkan urut abjad, bukan urut waktu — urutan masuk tidak membuka siapa pengisinya.
const daftarCatatan = (rows: IsianRow[]) => rows.map((r) => r.catatan?.trim()).filter((c): c is string => !!c).sort((a, b) => a.localeCompare(b));

export async function getRekapEvaluasi(trainingId: string, p: PelakuEvaluasi): Promise<RekapEvaluasiRecord> {
  if (p.peran === "WI") throw new ForbiddenError("Widyaiswara melihat hasil evaluasinya di menu Evaluasi Saya");
  const t = await trainingAtau404(trainingId);
  const sasaran = await daftarSasaran(trainingId);
  const rows: IsianRow[] = await prisma.evaluasiPengajar.findMany({
    where: { trainingId, peserta: { status: "AKTIF" } },
    select: { sasaranKunci: true, nilai: true, rataRata: true, catatan: true },
  });
  const grup = kelompokkan(rows);
  const peserta: { status: string; akunId: string | null }[] = await prisma.peserta.findMany({ where: { trainingId }, select: { status: true, akunId: true } });
  let penyelenggaraan: RekapEvaluasiRecord["penyelenggaraan"] = null;
  if (pakaiFormulir23B(t.jenisPelatihan)) {
    const r23: { nilai: unknown; rataRata: number; catatan: string | null }[] = await prisma.evaluasiPenyelenggaraan.findMany({
      where: { trainingId, peserta: { status: "AKTIF" } },
      select: { nilai: true, rataRata: true, catatan: true },
    });
    const rk = rekap23B(r23.map((x) => ({ nilai: (x.nilai ?? {}) as Record<string, number>, rata: x.rataRata })));
    penyelenggaraan = {
      ...rk,
      tersediaMulai: mulai23B(t),
      labelKualifikasi: rk.kualifikasi ? LABEL_KUALIFIKASI_23B[rk.kualifikasi] : null,
      catatan: r23.map((x) => x.catatan?.trim()).filter((c): c is string => !!c).sort((a, b) => a.localeCompare(b)),
    };
  }
  return {
    training: { id: t.id, name: t.name, jenisPelatihan: t.jenisPelatihan, angkatan: t.angkatan },
    ditutup: !!t.evaluasiDitutup,
    bolehKelola: p.peran === "PENYELENGGARA",
    pesertaAktif: peserta.filter((x) => x.status === "AKTIF").length,
    pesertaBerakun: peserta.filter((x) => x.status === "AKTIF" && x.akunId).length,
    sasaran: sasaran.map((s) => {
      const r = rekapDari(s.formulir, grup.get(s.kunci) ?? []);
      return { ...s, ...r, labelKualifikasi: r.kualifikasi ? LABEL_KUALIFIKASI[r.kualifikasi] : null, catatan: daftarCatatan(grup.get(s.kunci) ?? []) };
    }),
    penyelenggaraan,
  };
}

function wajibKelola(p: PelakuEvaluasi) {
  if (p.peran !== "PENYELENGGARA") throw new ForbiddenError("Pengaturan evaluasi oleh admin atau Ketua Diklat");
}

export async function tambahSasaran(
  trainingId: string,
  input: { formulir: FormulirEvaluasi; nama: string; keterangan?: string | null; pegawaiId?: string | null },
  p: PelakuEvaluasi,
): Promise<string> {
  wajibKelola(p);
  await trainingAtau404(trainingId);
  if (input.formulir === "PENGAMPU") throw new ValidationError("Pengampu materi otomatis dari penugasan WI yang disetujui");
  const nama = input.nama.trim();
  if (!nama) throw new ValidationError("Nama wajib diisi");
  if (input.pegawaiId) {
    const ada: { id: string } | null = await prisma.pegawai.findUnique({ where: { id: input.pegawaiId }, select: { id: true } });
    if (!ada) throw new ValidationError("Pegawai tidak ditemukan");
  }
  const r: { id: string } = await prisma.sasaranEvaluasi.create({
    data: { trainingId, formulir: input.formulir, nama, keterangan: input.keterangan?.trim() || null, pegawaiId: input.pegawaiId || null, dibuatOleh: p.email },
    select: { id: true },
  });
  return r.id;
}

export async function hapusSasaran(trainingId: string, id: string, p: PelakuEvaluasi): Promise<string> {
  wajibKelola(p);
  const s: { id: string; trainingId: string; nama: string } | null = await prisma.sasaranEvaluasi.findUnique({ where: { id }, select: { id: true, trainingId: true, nama: true } });
  if (!s || s.trainingId !== trainingId) throw new NotFoundError("Sasaran evaluasi tidak ditemukan");
  const terisi: number = await prisma.evaluasiPengajar.count({ where: { sasaranKunci: kunciSasaranLain(id) } });
  if (terisi > 0) throw new ConflictError(`Sudah diisi ${terisi} peserta — tidak bisa dihapus`);
  await prisma.sasaranEvaluasi.deleteMany({ where: { id } });
  return s.nama;
}

export async function setEvaluasiDitutup(trainingId: string, ditutup: boolean, p: PelakuEvaluasi): Promise<void> {
  wajibKelola(p);
  await trainingAtau404(trainingId);
  await prisma.training.update({ where: { id: trainingId }, data: { evaluasiDitutup: ditutup } });
}

/** CSV rekap (Formulir 22). */
export function csvRekap(d: RekapEvaluasiRecord, sel: (v: unknown) => string): string {
  const judul = ["No", "Unsur", "Nama", "Mata pelatihan/keterangan", "Responden", "Rata-rata", "Kualifikasi"];
  const baris = d.sasaran.map((s, i) => [i + 1, s.label, s.nama, s.keterangan ?? "", s.responden, s.rata ?? "", s.labelKualifikasi ?? ""].map(sel).join(";"));
  return "﻿" + [judul.join(";"), ...baris].join("\r\n") + "\r\n";
}

/** CSV rekap Formulir 23B: rata-rata tiap kelompok & aspek, lalu saran (tanpa nama). */
export function csvRekap23B(d: RekapEvaluasiRecord, sel: (v: unknown) => string): string {
  const p = d.penyelenggaraan;
  if (!p) throw new NotFoundError("Evaluasi penyelenggaraan tidak tersedia untuk pelatihan ini");
  const label = (v: number | null) => (v == null ? "" : LABEL_KUALIFIKASI_23B[kualifikasi23B(v)]);
  const baris: unknown[][] = [["No", "Aspek", "Responden", "Rata-rata", "Kualifikasi"]];
  for (const k of p.kelompok) {
    baris.push([k.no, k.nama, k.perAspek.length === 1 ? k.perAspek[0].n : "", k.rata ?? "", label(k.rata)]);
    if (k.perAspek.length > 1) for (const a of k.perAspek) baris.push(["", a.induk ? `${a.induk}: ${a.nama}` : a.nama, a.n, a.rata ?? "", label(a.rata)]);
  }
  baris.push(["", "Rata-rata keseluruhan", p.responden, p.rata ?? "", p.labelKualifikasi ?? ""]);
  baris.push([]);
  baris.push(["", "Catatan dan saran perbaikan"]);
  for (const c of p.catatan) baris.push(["", c]);
  return "\uFEFF" + baris.map((b) => b.map(sel).join(";")).join("\r\n") + "\r\n";
}

// ------------------------------------------------------------------ WIDYAISWARA

export type EvaluasiSayaRecord = {
  minResponden: number;
  daftar: {
    trainingId: string;
    training: string;
    mulai: string;
    formulir: FormulirEvaluasi;
    label: string;
    keterangan: string | null;
    responden: number;
    tampil: boolean; // responden ≥ minimal
    rekap: RekapSasaran | null;
    labelKualifikasi: string | null;
    catatan: string[];
  }[];
};

/** Rekap evaluasi milik seorang WI di semua jadwal (rahasia: hanya bila responden ≥ minimal). */
export async function getEvaluasiSaya(pegawaiId: string | null): Promise<EvaluasiSayaRecord> {
  if (!pegawaiId) return { minResponden: MIN_RESPONDEN_TAMPIL, daftar: [] };
  const rows: (IsianRow & { trainingId: string; formulir: string; mataPelatihan: string | null })[] = await prisma.evaluasiPengajar.findMany({
    where: { pegawaiId },
    select: { sasaranKunci: true, nilai: true, rataRata: true, catatan: true, trainingId: true, formulir: true, mataPelatihan: true },
  });
  const per = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.trainingId}|${r.sasaranKunci}`;
    const a = per.get(k);
    if (a) a.push(r);
    else per.set(k, [r]);
  }
  const daftar: EvaluasiSayaRecord["daftar"] = [];
  for (const grup of per.values()) {
    const r0 = grup[0];
    const t: { id: string; name: string; startDate: Date } | null = await prisma.training.findUnique({
      where: { id: r0.trainingId },
      select: { id: true, name: true, startDate: true },
    });
    if (!t) continue;
    const formulir = r0.formulir as FormulirEvaluasi;
    const tampil = grup.length >= MIN_RESPONDEN_TAMPIL;
    const rekap = tampil ? rekapDari(formulir, grup) : null;
    daftar.push({
      trainingId: t.id,
      training: t.name,
      mulai: isoTanggal(t.startDate),
      formulir,
      label: DEFINISI_FORMULIR[formulir]?.label ?? formulir,
      keterangan: r0.mataPelatihan ? (namaMataPelatihan(r0.mataPelatihan) ?? r0.mataPelatihan) : null,
      responden: grup.length,
      tampil,
      rekap,
      labelKualifikasi: rekap?.kualifikasi ? LABEL_KUALIFIKASI[rekap.kualifikasi] : null,
      catatan: tampil ? daftarCatatan(grup) : [],
    });
  }
  return { minResponden: MIN_RESPONDEN_TAMPIL, daftar: daftar.sort((a, b) => b.mulai.localeCompare(a.mulai)) };
}
