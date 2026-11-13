import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { labelKelompok, labelJenisKelompok } from "@/lib/kelompok";
import { isoTanggal } from "@/lib/tanggal";
import {
  labelPeranAngkatan,
  periksaIsianPenugasan,
  periksaRangkap,
  periksaUsulanMentor,
  type IsianPenugasan,
  type IsianUsulanMentor,
  type OrangPenugasan,
} from "@/lib/penugasan-angkatan";

/**
 * Penugasan per angkatan (EB-035; docs/spesifikasi/Rancangan_Langkah3_Fondasi_Akses.md).
 * Sumber data:
 *  - tabel penugasan_angkatan (baru): penugasan yang dibuat di tab "Penugasan" dan usulan mentor peserta;
 *  - data lama yang TETAP dipakai fitur lain: coach di kelompok_peserta, penguji & mentor di seminar_peserta.
 *    Keduanya ikut ditampilkan (hanya baca) dan ikut dihitung saat memeriksa rangkap peran.
 */
export type SumberPenugasan = "PENUGASAN" | "KELOMPOK" | "SEMINAR";
export type BarisPenugasan = {
  id: string | null;
  sumber: SumberPenugasan;
  peran: string;
  peranLabel: string;
  status: string;
  pegawaiId: string | null;
  nama: string;
  jabatan: string | null;
  instansi: string | null;
  email: string | null;
  ponsel: string | null;
  lingkup: string;
  mulai: string | null;
  selesai: string | null;
  dasar: string | null;
  alasan: string | null;
  usulanPeserta: boolean;
};
export type PenugasanAngkatanRecord = {
  training: { id: string; name: string; jenisPelatihan: string | null; mulai: string; selesai: string | null };
  bolehKelola: boolean;
  baris: BarisPenugasan[];
  peserta: { id: string; nomor: number; nama: string }[];
  kelompok: { id: string; label: string }[];
  pilihanPegawai: { id: string; nama: string; jabatan: string | null }[];
  usulanMenunggu: number;
};

const tgl = (d: Date | null | undefined) => (d ? isoTanggal(new Date(d)) : null);
const keTanggal = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

async function muatTraining(trainingId: string) {
  const t: { id: string; name: string; jenisPelatihan: string | null; startDate: Date; endDate: Date | null } | null = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true, name: true, jenisPelatihan: true, startDate: true, endDate: true },
  });
  if (!t) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  return t;
}

/** Semua penugasan angkatan (tabel baru + data lama) dalam bentuk baris tampilan. */
async function semuaBaris(trainingId: string) {
  const [baru, kelompok, seminar, peserta] = await Promise.all([
    prisma.penugasanAngkatan.findMany({ where: { trainingId }, include: { pegawai: { select: { nama: true, jabatan: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.kelompokPeserta.findMany({ where: { trainingId }, select: { id: true, jenis: true, nomor: true, nama: true, coachNama: true, coachPegawaiId: true }, orderBy: { nomor: "asc" } }),
    prisma.seminarPeserta.findMany({ where: { trainingId }, select: { pesertaId: true, jenis: true, pengujiPegawaiId: true, pengujiNama: true, mentorNama: true, mentorJabatan: true } }),
    prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: { id: true, nomor: true, nama: true }, orderBy: { nomor: "asc" } }),
  ]);
  const namaPeserta = new Map((peserta as { id: string; nama: string }[]).map((p) => [p.id, p.nama]));
  const labelKel = new Map(
    (kelompok as { id: string; jenis: string; nomor: number; nama: string | null }[]).map((k) => [k.id, `${labelKelompok(k)} (${labelJenisKelompok(k.jenis)})`]),
  );
  const lingkupDari = (pesertaIds: string[], kelompokIds: string[]) => {
    const bagian = [
      ...kelompokIds.map((id) => labelKel.get(id) ?? "kelompok terhapus"),
      ...pesertaIds.map((id) => namaPeserta.get(id) ?? "peserta tidak aktif"),
    ];
    return bagian.length ? bagian.join(", ") : "Seluruh angkatan";
  };

  const baris: BarisPenugasan[] = (baru as any[]).map((b) => ({
    id: b.id,
    sumber: "PENUGASAN",
    peran: b.peran,
    peranLabel: labelPeranAngkatan(b.peran),
    status: b.status,
    pegawaiId: b.pegawaiId,
    nama: b.pegawai?.nama ?? b.namaLuar ?? "(tanpa nama)",
    jabatan: b.pegawai?.jabatan ?? b.jabatanLuar,
    instansi: b.pegawaiId ? null : b.instansiLuar,
    email: b.pegawaiId ? null : b.emailLuar,
    ponsel: b.pegawaiId ? null : b.ponselLuar,
    lingkup: lingkupDari(b.pesertaIds ?? [], b.kelompokIds ?? []),
    mulai: tgl(b.mulai),
    selesai: tgl(b.selesai),
    dasar: b.dasar,
    alasan: b.alasan,
    usulanPeserta: !!b.diusulkanOleh,
  }));
  const lama = (o: Partial<BarisPenugasan> & { peran: string; nama: string; lingkup: string; sumber: SumberPenugasan; pegawaiId: string | null }): BarisPenugasan => ({
    id: null,
    peranLabel: labelPeranAngkatan(o.peran),
    status: "AKTIF",
    jabatan: null,
    instansi: null,
    email: null,
    ponsel: null,
    mulai: null,
    selesai: null,
    dasar: null,
    alasan: null,
    usulanPeserta: false,
    ...o,
  });
  for (const k of kelompok as any[]) {
    if (k.coachNama || k.coachPegawaiId) baris.push(lama({ sumber: "KELOMPOK", peran: "COACH", pegawaiId: k.coachPegawaiId, nama: k.coachNama ?? "(coach)", lingkup: labelKel.get(k.id) ?? "" }));
  }
  for (const s of seminar as any[]) {
    const siapa = namaPeserta.get(s.pesertaId) ?? "peserta";
    if (s.pengujiPegawaiId || s.pengujiNama) baris.push(lama({ sumber: "SEMINAR", peran: "PENGUJI", pegawaiId: s.pengujiPegawaiId, nama: s.pengujiNama ?? "(penguji)", lingkup: `${siapa} (seminar ${s.jenis})` }));
    if (s.mentorNama) baris.push(lama({ sumber: "SEMINAR", peran: "MENTOR", pegawaiId: null, nama: s.mentorNama, jabatan: s.mentorJabatan, lingkup: `${siapa} (seminar ${s.jenis})` }));
  }
  return { baris, kelompok, peserta, baru: baru as any[] };
}

const orangDari = (b: BarisPenugasan): OrangPenugasan => ({ pegawaiId: b.pegawaiId, nama: b.nama, email: b.email });

export async function getPenugasanAngkatan(trainingId: string, bolehKelola: boolean): Promise<PenugasanAngkatanRecord> {
  const t = await muatTraining(trainingId);
  const { baris, kelompok, peserta } = await semuaBaris(trainingId);
  const pilihanPegawai = bolehKelola
    ? ((await prisma.pegawai.findMany({ where: { status: "AKTIF" }, select: { id: true, nama: true, jabatan: true }, orderBy: { nama: "asc" } })) as { id: string; nama: string; jabatan: string | null }[])
    : [];
  return {
    training: { id: t.id, name: t.name, jenisPelatihan: t.jenisPelatihan, mulai: isoTanggal(new Date(t.startDate)), selesai: tgl(t.endDate) },
    bolehKelola,
    baris,
    peserta: (peserta as { id: string; nomor: number; nama: string }[]).map((p) => ({ id: p.id, nomor: p.nomor, nama: p.nama })),
    kelompok: (kelompok as { id: string; jenis: string; nomor: number; nama: string | null }[]).map((k) => ({ id: k.id, label: `${labelKelompok(k)} (${labelJenisKelompok(k.jenis)})` })),
    pilihanPegawai,
    usulanMenunggu: baris.filter((b) => b.status === "USULAN").length,
  };
}

export type IsianPenugasanServer = IsianPenugasan & {
  jabatanLuar?: string | null;
  instansiLuar?: string | null;
  emailLuar?: string | null;
  ponselLuar?: string | null;
  dasar?: string | null;
};

/** Tambah penugasan (status AKTIF) setelah lolos isian, lingkup, dan larangan rangkap. Mengembalikan ringkasan untuk log. */
export async function tambahPenugasan(trainingId: string, isian: IsianPenugasanServer, oleh: string): Promise<string> {
  const t = await muatTraining(trainingId);
  const periode = { mulai: isoTanggal(new Date(t.startDate)), selesai: tgl(t.endDate) };
  const galat = periksaIsianPenugasan(isian, periode);
  if (galat) throw new ValidationError(galat);
  const { baris, kelompok, peserta } = await semuaBaris(trainingId);
  const idPeserta = new Set((peserta as { id: string }[]).map((p) => p.id));
  const idKelompok = new Set((kelompok as { id: string }[]).map((k) => k.id));
  const pesertaIds = [...new Set(isian.pesertaIds ?? [])];
  const kelompokIds = [...new Set(isian.kelompokIds ?? [])];
  if (pesertaIds.some((id) => !idPeserta.has(id))) throw new ValidationError("Ada peserta yang bukan peserta aktif diklat ini.");
  if (kelompokIds.some((id) => !idKelompok.has(id))) throw new ValidationError("Ada kelompok yang bukan milik diklat ini.");

  let nama = isian.namaLuar?.trim() ?? "";
  if (isian.pegawaiId) {
    const p: { nama: string } | null = await prisma.pegawai.findUnique({ where: { id: isian.pegawaiId }, select: { nama: true } });
    if (!p) throw new NotFoundError("Pegawai tidak ditemukan");
    nama = p.nama;
  }
  const orang: OrangPenugasan = { pegawaiId: isian.pegawaiId || null, nama, email: isian.pegawaiId ? null : isian.emailLuar?.trim() || null };
  const rangkap = periksaRangkap(baris.map((b) => ({ peran: b.peran, status: b.status, orang: orangDari(b) })), { peran: isian.peran as string, orang });
  if (rangkap) throw new ConflictError(rangkap);

  const luar = !isian.pegawaiId;
  await prisma.penugasanAngkatan.create({
    data: {
      trainingId,
      peran: isian.peran as string,
      pegawaiId: isian.pegawaiId || null,
      namaLuar: luar ? nama : null,
      jabatanLuar: luar ? isian.jabatanLuar?.trim() || null : null,
      instansiLuar: luar ? isian.instansiLuar?.trim() || null : null,
      emailLuar: luar ? isian.emailLuar?.trim() || null : null,
      ponselLuar: luar ? isian.ponselLuar?.trim() || null : null,
      pesertaIds,
      kelompokIds,
      mulai: keTanggal(isian.mulai),
      selesai: keTanggal(isian.selesai),
      dasar: isian.dasar?.trim() || null,
      status: "AKTIF",
      diubahOleh: oleh,
    },
  });
  return `${labelPeranAngkatan(isian.peran as string)}: ${nama}`;
}

export type AksiPenugasan = "setujui" | "tolak" | "cabut";

/** Setujui/tolak usulan mentor, atau cabut penugasan aktif. Alasan wajib untuk tolak & cabut. */
export async function ubahStatusPenugasan(trainingId: string, id: string, aksi: AksiPenugasan, alasan: string | null, oleh: string): Promise<string> {
  const row: any = await prisma.penugasanAngkatan.findFirst({ where: { id, trainingId }, include: { pegawai: { select: { nama: true } } } });
  if (!row) throw new NotFoundError("Penugasan tidak ditemukan");
  const nama = row.pegawai?.nama ?? row.namaLuar ?? "";
  const ringkas = `${labelPeranAngkatan(row.peran)}: ${nama}`;
  if ((aksi === "tolak" || aksi === "cabut") && !alasan?.trim()) throw new ValidationError("Tulis alasannya.");
  if (aksi === "setujui") {
    if (row.status !== "USULAN") throw new ConflictError("Hanya usulan yang bisa disetujui.");
    const { baris } = await semuaBaris(trainingId);
    const lain = baris.filter((b) => b.id !== id);
    const rangkap = periksaRangkap(lain.map((b) => ({ peran: b.peran, status: b.status, orang: orangDari(b) })), {
      peran: row.peran,
      orang: { pegawaiId: row.pegawaiId, nama, email: row.emailLuar },
    });
    if (rangkap) throw new ConflictError(rangkap);
    await prisma.penugasanAngkatan.update({ where: { id }, data: { status: "AKTIF", alasan: null, diubahOleh: oleh } });
    return `${ringkas} disetujui`;
  }
  if (aksi === "tolak") {
    if (row.status !== "USULAN") throw new ConflictError("Hanya usulan yang bisa ditolak.");
    await prisma.penugasanAngkatan.update({ where: { id }, data: { status: "DITOLAK", alasan: alasan!.trim(), diubahOleh: oleh } });
    return `${ringkas} ditolak: ${alasan!.trim()}`;
  }
  if (row.status !== "AKTIF") throw new ConflictError("Hanya penugasan aktif yang bisa dicabut.");
  await prisma.penugasanAngkatan.update({ where: { id }, data: { status: "DICABUT", alasan: alasan!.trim(), diubahOleh: oleh } });
  return `${ringkas} dicabut: ${alasan!.trim()}`;
}

// --- Usulan mentor oleh peserta (keputusan Hamzah 5 Nov 2026) ---

export type MentorSayaRecord = {
  status: string | null; // USULAN | AKTIF | DITOLAK | null (belum ada)
  nama: string | null;
  jabatan: string | null;
  instansi: string | null;
  email: string | null;
  ponsel: string | null;
  alasan: string | null;
  /** Mentor tercatat di jadwal seminar (data lama), bila belum ada penugasan mentor. */
  dariSeminar: boolean;
};

async function pesertaSendiri(pesertaId: string, email: string): Promise<{ id: string; trainingId: string }> {
  const p: { id: string; trainingId: string; status: string; akun: { email: string } | null } | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { id: true, trainingId: true, status: true, akun: { select: { email: true } } },
  });
  if (!p) throw new NotFoundError("Peserta tidak ditemukan");
  if (!p.akun || p.akun.email !== email) throw new ForbiddenError("Ini bukan ruang belajar Anda.");
  return p;
}

export async function getMentorSaya(pesertaId: string, email: string): Promise<MentorSayaRecord> {
  const p = await pesertaSendiri(pesertaId, email);
  const daftar: any[] = await prisma.penugasanAngkatan.findMany({ where: { trainingId: p.trainingId, peran: "MENTOR" }, orderBy: { updatedAt: "desc" } });
  const milik = daftar.filter((b) => (b.pesertaIds ?? []).includes(pesertaId) && b.status !== "DICABUT");
  const pilih = milik.find((b) => b.status === "AKTIF") ?? milik.find((b) => b.status === "USULAN") ?? milik[0];
  if (pilih) {
    return { status: pilih.status, nama: pilih.namaLuar, jabatan: pilih.jabatanLuar, instansi: pilih.instansiLuar, email: pilih.emailLuar, ponsel: pilih.ponselLuar, alasan: pilih.alasan, dariSeminar: false };
  }
  const sem: { mentorNama: string | null; mentorJabatan: string | null } | null = await prisma.seminarPeserta.findFirst({
    where: { pesertaId, mentorNama: { not: null } },
    select: { mentorNama: true, mentorJabatan: true },
  });
  if (sem?.mentorNama) return { status: "AKTIF", nama: sem.mentorNama, jabatan: sem.mentorJabatan, instansi: null, email: null, ponsel: null, alasan: null, dariSeminar: true };
  return { status: null, nama: null, jabatan: null, instansi: null, email: null, ponsel: null, alasan: null, dariSeminar: false };
}

/** Peserta mengusulkan (atau memperbaiki usulan) mentornya. Ditolak bila mentor sudah disetujui. */
export async function usulkanMentor(pesertaId: string, isian: IsianUsulanMentor, email: string): Promise<void> {
  const p = await pesertaSendiri(pesertaId, email);
  if ((await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { status: true } }))?.status !== "AKTIF") {
    throw new ForbiddenError("Hanya peserta aktif yang bisa mengusulkan mentor.");
  }
  const galat = periksaUsulanMentor(isian);
  if (galat) throw new ValidationError(galat);
  const daftar: any[] = await prisma.penugasanAngkatan.findMany({ where: { trainingId: p.trainingId, peran: "MENTOR" } });
  const milik = daftar.filter((b) => (b.pesertaIds ?? []).includes(pesertaId));
  if (milik.some((b) => b.status === "AKTIF")) throw new ConflictError("Mentor Anda sudah disetujui penyelenggara. Hubungi penyelenggara bila perlu diganti.");
  const data = {
    namaLuar: isian.nama!.trim(),
    jabatanLuar: isian.jabatan!.trim(),
    instansiLuar: isian.instansi?.trim() || null,
    emailLuar: isian.email?.trim() || null,
    ponselLuar: isian.ponsel?.trim() || null,
    alasan: null,
    diubahOleh: email,
  };
  const usulan = milik.find((b) => b.status === "USULAN");
  if (usulan) {
    await prisma.penugasanAngkatan.update({ where: { id: usulan.id }, data });
    return;
  }
  await prisma.penugasanAngkatan.create({ data: { trainingId: p.trainingId, peran: "MENTOR", pesertaIds: [pesertaId], kelompokIds: [], status: "USULAN", diusulkanOleh: email, ...data } });
}
