import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { getTrainingByIdOrThrow, sinkronStatusTraining } from "@/lib/server/repositories/training";
import {
  isBentukSesi,
  isStatusKehadiran,
  labelMasaTempatKerja,
  periksaPresensiHarian,
  rapikanJam,
  wajibHadir,
  type JenisMasaTempatKerja,
  type StatusKehadiran,
} from "@/lib/kehadiran";
import { isMataPelatihanProgram, namaMataPelatihan } from "@/lib/kurikulum";
import { isStatusPeserta } from "@/lib/peserta";
import { bacaTautan, diluarPeriode, isTanggalIsoValid } from "@/lib/sesi";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { perKelompokKosong, type BarisKehadiran, type JadwalPembelajaran, type LembarKehadiran, type PerKelompok, type SesiPembelajaran } from "@/lib/data-pembelajaran";
import { labelKelompok } from "@/lib/kelompok";

/**
 * Jadwal pembelajaran + kehadiran. Aturan disalin dari repositories/pembelajaran.ts aplikasi lama.
 * Satu sesi = satu blok kegiatan pada satu tanggal dengan JP-nya; kehadiran dicatat per peserta per sesi.
 * Ini BUKAN sesi mengajar WI (dasar rekap JP pengampu); keduanya masih diisi terpisah.
 */
type SesiRow = {
  id: string;
  trainingId: string;
  tanggal: Date;
  jamMulai: string | null;
  kegiatan: string;
  jp: number;
  bentuk: string;
  mataPelatihan: string | null;
  keterangan: string | null;
  tautan: string | null;
  ruang: string | null;
  createdAt: Date;
};
type TrainingRow = { id: string; name: string; startDate: Date; endDate: Date | null; jenisPelatihan: string | null };
type Hitungan = { hadir: number; tidakHadir: number; dispensasi: number; jumlahCatatan: number };

const keTanggalDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const HITUNGAN_KOSONG: Hitungan = { hadir: 0, tidakHadir: 0, dispensasi: 0, jumlahCatatan: 0 };

async function trainingOrThrow(id: string): Promise<TrainingRow> {
  const t = await prisma.training.findUnique({ where: { id }, select: { id: true, name: true, startDate: true, endDate: true, jenisPelatihan: true } });
  if (!t) throw new NotFoundError(`Training "${id}" tidak ditemukan`);
  return t;
}

function toRecord(row: SesiRow, periode: TrainingRow, hitung: Hitungan, pesertaAktif: number, pengampu?: string[], perKelompok: PerKelompok[] = []): SesiPembelajaran {
  const tanggal = isoTanggal(row.tanggal);
  const dicatat = hitung.hadir + hitung.tidakHadir + hitung.dispensasi;
  return {
    id: row.id,
    trainingId: row.trainingId,
    tanggal,
    jamMulai: row.jamMulai ?? undefined,
    kegiatan: row.kegiatan,
    jp: row.jp,
    bentuk: row.bentuk,
    wajibHadir: wajibHadir(row.bentuk),
    mataPelatihan: row.mataPelatihan ?? undefined,
    mataPelatihanNama: namaMataPelatihan(row.mataPelatihan) ?? undefined,
    keterangan: row.keterangan ?? undefined,
    tautan: row.tautan ?? undefined,
    ruang: row.ruang ?? undefined,
    ...(pengampu && pengampu.length ? { pengampu } : {}),
    perKelompok,
    diluarPeriode: diluarPeriode(tanggal, isoTanggal(periode.startDate), periode.endDate ? isoTanggal(periode.endDate) : null),
    ...hitung,
    // Semua sesi dicatat presensinya (keputusan 14 Okt); asinkron/mandiri tidak masuk batas ketidakhadiran.
    belumDicatat: Math.max(0, pesertaAktif - dicatat),
  };
}

/** Urutan tampil: tanggal, lalu jam mulai (yang tanpa jam di belakang), lalu urutan dibuat. */
function urutkan(rows: SesiRow[]): SesiRow[] {
  return [...rows].sort(
    (a, b) => a.tanggal.getTime() - b.tanggal.getTime() || (a.jamMulai ?? "99:99").localeCompare(b.jamMulai ?? "99:99") || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/** Rekap per sesi: hadir/tidakHadir/dispensasi hanya peserta AKTIF; jumlahCatatan semua baris. */
async function hitungPerSesi(trainingId: string): Promise<{ perSesi: Map<string, Hitungan>; pesertaAktif: number }> {
  const [aktif, hadirRows] = await Promise.all([
    prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: { id: true } }),
    prisma.kehadiran.findMany({ where: { sesi: { trainingId } }, select: { sesiId: true, pesertaId: true, status: true } }),
  ]);
  const idAktif = new Set(aktif.map((p) => p.id));
  const perSesi = new Map<string, Hitungan>();
  for (const h of hadirRows) {
    const x = perSesi.get(h.sesiId) ?? { ...HITUNGAN_KOSONG };
    perSesi.set(h.sesiId, x);
    x.jumlahCatatan++;
    if (!idAktif.has(h.pesertaId)) continue;
    if (h.status === "HADIR") x.hadir++;
    else if (h.status === "TIDAK_HADIR") x.tidakHadir++;
    else if (h.status === "DISPENSASI") x.dispensasi++;
  }
  return { perSesi, pesertaAktif: idAktif.size };
}

/** Pengampu tiap mata pelatihan: WI dari penugasan "disetujui" (EB-022) yang mata pelatihannya diisi. */
async function pengampuPerMataPelatihan(trainingId: string): Promise<Map<string, string[]>> {
  const rows = await prisma.penugasanApproval.findMany({
    where: { trainingId, status: "disetujui", mataPelatihan: { not: null } },
    select: { mataPelatihan: true, instructor: { select: { nama: true } } },
  });
  const hasil = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.mataPelatihan || !r.instructor?.nama) continue;
    const daftar = hasil.get(r.mataPelatihan) ?? [];
    if (!daftar.includes(r.instructor.nama)) daftar.push(r.instructor.nama);
    hasil.set(r.mataPelatihan, daftar);
  }
  return hasil;
}

type MasaRow = { id: string; trainingId: string; jenis: string; mulai: Date; selesai: Date };
const masaJadwal = (trainingId: string): Promise<MasaRow[]> => prisma.masaTempatKerja.findMany({ where: { trainingId }, orderBy: { mulai: "asc" } });

/** Presensi harian (keputusan 14 & 16 Okt): belumLengkap semua hari; tanpaSesi hari kerja di luar masa di tempat kerja. */
function periksaPresensi(training: TrainingRow, rows: SesiRow[], hitung: Awaited<ReturnType<typeof hitungPerSesi>>, masa: MasaRow[], sampai: string) {
  const dasar = {
    mulai: isoTanggal(training.startDate),
    selesai: training.endDate ? isoTanggal(training.endDate) : null,
    hariIni: sampai,
    pesertaAktif: hitung.pesertaAktif,
    sesi: rows.map((r) => {
      const h = hitung.perSesi.get(r.id) ?? HITUNGAN_KOSONG;
      return { tanggal: isoTanggal(r.tanggal), tercatat: h.hadir + h.tidakHadir + h.dispensasi };
    }),
  };
  return {
    belumLengkap: periksaPresensiHarian(dasar).belumLengkap,
    tanpaSesi: periksaPresensiHarian({ ...dasar, lewatiAkhirPekan: true, kecuali: masa.map((m) => ({ mulai: isoTanggal(m.mulai), selesai: isoTanggal(m.selesai) })) }).tanpaSesi,
  };
}

export async function listSesiPembelajaran(trainingId: string): Promise<JadwalPembelajaran> {
  await sinkronStatusTraining();
  const training = await trainingOrThrow(trainingId);
  const [rows, hitung, masa, pengampu, kelompokEl, perKel, wi] = await Promise.all([
    prisma.sesiPembelajaran.findMany({ where: { trainingId } }) as Promise<SesiRow[]>,
    hitungPerSesi(trainingId),
    masaJadwal(trainingId),
    pengampuPerMataPelatihan(trainingId),
    prisma.kelompokPeserta.findMany({ where: { trainingId, jenis: "ELEARNING" }, orderBy: { nomor: "asc" }, select: { id: true, nomor: true, nama: true } }),
    perKelompokJadwal(trainingId),
    wiJadwal(trainingId),
  ]);
  const presensi = periksaPresensi(training, rows, hitung, masa, isoTanggal(awalHariWib(new Date())));
  return {
    training: {
      id: training.id,
      name: training.name,
      startDate: isoTanggal(training.startDate),
      endDate: training.endDate ? isoTanggal(training.endDate) : null,
      jenisPelatihan: training.jenisPelatihan,
    },
    sesi: urutkan(rows).map((r) =>
      toRecord(r, training, hitung.perSesi.get(r.id) ?? HITUNGAN_KOSONG, hitung.pesertaAktif, r.mataPelatihan ? pengampu.get(r.mataPelatihan) : undefined, perKel.get(r.id) ?? []),
    ),
    pesertaAktif: hitung.pesertaAktif,
    presensiBelumLengkap: presensi.belumLengkap,
    presensiTanpaSesi: presensi.tanpaSesi,
    masaTempatKerja: masa.map((m) => ({ id: m.id, jenis: m.jenis, label: labelMasaTempatKerja(m.jenis), mulai: isoTanggal(m.mulai), selesai: isoTanggal(m.selesai) })),
    kelompokElearning: kelompokEl.map((k) => ({ id: k.id, nomor: k.nomor, label: labelKelompok(k) })),
    wi,
  };
}

// --- Pengajar & Zoom per kelompok e-learning (EB-052) ---------------------------------------

/** Isian per kelompok semua sesi satu jadwal: sesiId → daftar per kelompok (urut nomor kelompok). */
async function perKelompokJadwal(trainingId: string): Promise<Map<string, PerKelompok[]>> {
  const rows = await prisma.sesiKelompok.findMany({
    where: { sesi: { trainingId } },
    select: { sesiId: true, kelompokId: true, pengajarPegawaiId: true, pengajarNama: true, tautan: true, kelompok: { select: { nomor: true } } },
  });
  const peta = new Map<string, PerKelompok[]>();
  for (const r of rows) {
    const isi: PerKelompok = { kelompokId: r.kelompokId, nomor: r.kelompok.nomor, pengajarPegawaiId: r.pengajarPegawaiId, pengajarNama: r.pengajarNama, tautan: r.tautan };
    peta.set(
      r.sesiId,
      [...(peta.get(r.sesiId) ?? []), isi].sort((a, b) => a.nomor - b.nomor),
    );
  }
  return peta;
}

/** WI dengan penugasan disetujui di jadwal ini (pilihan pengajar per kelompok). */
async function wiJadwal(trainingId: string): Promise<{ id: string; nama: string }[]> {
  const pen = await prisma.penugasanApproval.findMany({ where: { trainingId, status: "disetujui" }, select: { instructorId: true, instructor: { select: { nama: true } } } });
  const m = new Map<string, string>();
  for (const p of pen) if (p.instructor?.nama) m.set(p.instructorId, p.instructor.nama);
  return [...m.entries()].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/**
 * Simpan pengajar & tautan Zoom per kelompok untuk satu sesi. Kelompok harus kelompok e-learning jadwal yang sama;
 * baris tanpa pengajar dan tanpa tautan dihapus. Nama pengajar diambil dari data pegawai bila WI dipilih.
 */
export async function aturPerKelompok(
  sesiId: string,
  baris: { kelompokId: string; pengajarPegawaiId?: string | null; pengajarNama?: string | null; tautan?: string | null }[],
  diubahOleh: string,
): Promise<SesiPembelajaran> {
  const sesi = await sesiOrThrow(sesiId);
  const kelompok = await prisma.kelompokPeserta.findMany({ where: { id: { in: baris.map((b) => b.kelompokId) } }, select: { id: true, trainingId: true, jenis: true } });
  for (const b of baris) {
    const k = kelompok.find((x) => x.id === b.kelompokId);
    if (!k || k.trainingId !== sesi.trainingId) throw new ForbiddenError("Kelompok bukan milik jadwal ini");
    if (k.jenis !== "ELEARNING") throw new ValidationError("Pengajar per kelompok hanya untuk kelompok e-learning");
  }
  const pegawaiIds = baris.map((b) => b.pengajarPegawaiId).filter((x): x is string => !!x);
  const pegawai = pegawaiIds.length ? await prisma.pegawai.findMany({ where: { id: { in: pegawaiIds } }, select: { id: true, nama: true } }) : [];
  const perintah = [];
  for (const b of baris) {
    if (perKelompokKosong(b)) {
      perintah.push(prisma.sesiKelompok.deleteMany({ where: { sesiId, kelompokId: b.kelompokId } }));
      continue;
    }
    const pg = b.pengajarPegawaiId ? pegawai.find((p) => p.id === b.pengajarPegawaiId) : null;
    if (b.pengajarPegawaiId && !pg) throw new ValidationError("Pengajar tidak ditemukan di data pegawai");
    const tautan = bacaTautan(b.tautan);
    if (tautan === undefined) throw new ValidationError("Tautan Zoom harus alamat web lengkap (https://…)");
    const data = { pengajarPegawaiId: pg?.id ?? null, pengajarNama: pg?.nama ?? (b.pengajarNama?.trim() || null), tautan, diubahOleh };
    perintah.push(
      prisma.sesiKelompok.upsert({ where: { sesiId_kelompokId: { sesiId, kelompokId: b.kelompokId } }, create: { sesiId, kelompokId: b.kelompokId, ...data }, update: data }),
    );
  }
  if (perintah.length) await prisma.$transaction(perintah);
  return satuRecord(sesi);
}

/** Tambah masa di tempat kerja (rentang tanggal di dalam periode pelatihan). */
export async function tambahMasaTempatKerja(trainingId: string, input: { jenis: JenisMasaTempatKerja; mulai: string; selesai: string }, dibuatOleh: string): Promise<string> {
  const training = await trainingOrThrow(trainingId);
  if (input.selesai < input.mulai) throw new ValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai");
  const awal = isoTanggal(training.startDate);
  const akhir = training.endDate ? isoTanggal(training.endDate) : null;
  if (input.mulai < awal || (akhir && input.selesai > akhir)) throw new ValidationError("Rentang harus di dalam periode pelatihan");
  const r = await prisma.masaTempatKerja.create({
    data: { trainingId, jenis: input.jenis, mulai: keTanggalDb(input.mulai), selesai: keTanggalDb(input.selesai), dibuatOleh },
    select: { id: true },
  });
  return r.id;
}

export async function hapusMasaTempatKerja(trainingId: string, id: string): Promise<void> {
  const m = await prisma.masaTempatKerja.findUnique({ where: { id } });
  if (!m || m.trainingId !== trainingId) throw new NotFoundError("Masa di tempat kerja tidak ditemukan");
  await prisma.masaTempatKerja.deleteMany({ where: { id } });
}

export type SesiPembelajaranInput = {
  tanggal: string;
  jamMulai?: string | null;
  kegiatan: string;
  jp: number;
  bentuk?: string;
  mataPelatihan?: string | null;
  keterangan?: string | null;
  tautan?: string | null;
  ruang?: string | null;
};

/** Periksa + rapikan satu isian sesi terhadap pelatihannya. `label` dipakai di pesan galat. */
export function bacaIsian(input: SesiPembelajaranInput, jenisPelatihan: string | null, label: string) {
  if (!isTanggalIsoValid(input.tanggal)) throw new ValidationError(`${label}tanggal tidak valid`);
  const kegiatan = input.kegiatan.trim();
  if (!kegiatan) throw new ValidationError(`${label}nama kegiatan wajib diisi`);
  if (!Number.isInteger(input.jp) || input.jp < 1) throw new ValidationError(`${label}JP harus bilangan bulat minimal 1`);
  const bentuk = input.bentuk ?? "KLASIKAL";
  if (!isBentukSesi(bentuk)) throw new ValidationError(`${label}bentuk sesi "${bentuk}" tidak dikenal`);

  let jamMulai: string | null = null;
  if (input.jamMulai?.trim()) {
    jamMulai = rapikanJam(input.jamMulai);
    if (!jamMulai) throw new ValidationError(`${label}jam mulai "${input.jamMulai}" tidak valid (contoh: 08:00)`);
  }

  const mataPelatihan = input.mataPelatihan?.trim() || null;
  if (mataPelatihan) {
    if (!jenisPelatihan) throw new ValidationError(`${label}jadwal ini bukan program berkurikulum, jadi tidak punya mata pelatihan`);
    if (!isMataPelatihanProgram(jenisPelatihan, mataPelatihan)) throw new ValidationError(`${label}mata pelatihan "${mataPelatihan}" tidak ada di kurikulum ${jenisPelatihan}`);
  }
  const tautan = bacaTautan(input.tautan);
  if (tautan === undefined) throw new ValidationError(`${label}tautan harus alamat web lengkap (https://…)`);
  return {
    tanggal: keTanggalDb(input.tanggal),
    jamMulai,
    kegiatan,
    jp: input.jp,
    bentuk,
    mataPelatihan,
    keterangan: input.keterangan?.trim() || null,
    tautan,
    ruang: input.ruang?.trim() || null,
  };
}

/** Tambah satu atau banyak sesi. Kalau satu baris salah, tidak ada yang disimpan. */
export async function tambahSesiPembelajaran(trainingId: string, inputs: SesiPembelajaranInput[], dibuatOleh: string): Promise<SesiPembelajaran[]> {
  if (inputs.length === 0) throw new ValidationError("Tidak ada sesi untuk disimpan");
  const training = await trainingOrThrow(trainingId);
  const data = inputs.map((s, i) => bacaIsian(s, training.jenisPelatihan, inputs.length > 1 ? `Sesi ke-${i + 1}: ` : ""));
  let rows: SesiRow[];
  try {
    rows = await prisma.$transaction(data.map((d) => prisma.sesiPembelajaran.create({ data: { trainingId, dibuatOleh, ...d } })));
  } catch (e) {
    if (kodePrisma(e) === "P2003") throw new NotFoundError("Jadwal diklat ini sudah tidak ada");
    throw e;
  }
  const { pesertaAktif } = await hitungPerSesi(trainingId);
  return urutkan(rows).map((r) => toRecord(r, training, HITUNGAN_KOSONG, pesertaAktif));
}

async function sesiOrThrow(id: string): Promise<SesiRow> {
  const row = (await prisma.sesiPembelajaran.findUnique({ where: { id } })) as SesiRow | null;
  if (!row) throw new NotFoundError(`Sesi pembelajaran "${id}" tidak ditemukan`);
  return row;
}

async function satuRecord(row: SesiRow): Promise<SesiPembelajaran> {
  const training = await trainingOrThrow(row.trainingId);
  const hitung = await hitungPerSesi(row.trainingId);
  const perKel = await perKelompokJadwal(row.trainingId);
  return toRecord(row, training, hitung.perSesi.get(row.id) ?? HITUNGAN_KOSONG, hitung.pesertaAktif, undefined, perKel.get(row.id) ?? []);
}

/** Ubah sesi. Bentuk tidak boleh diganti menjadi asinkron/mandiri kalau sesi sudah punya catatan kehadiran. */
export async function ubahSesiPembelajaran(id: string, patch: Partial<SesiPembelajaranInput>): Promise<SesiPembelajaran> {
  const lama = await sesiOrThrow(id);
  const training = await trainingOrThrow(lama.trainingId);
  const gabung: SesiPembelajaranInput = {
    tanggal: patch.tanggal ?? isoTanggal(lama.tanggal),
    jamMulai: patch.jamMulai !== undefined ? patch.jamMulai : lama.jamMulai,
    kegiatan: patch.kegiatan ?? lama.kegiatan,
    jp: patch.jp ?? lama.jp,
    bentuk: patch.bentuk ?? lama.bentuk,
    mataPelatihan: patch.mataPelatihan !== undefined ? patch.mataPelatihan : lama.mataPelatihan,
    keterangan: patch.keterangan !== undefined ? patch.keterangan : lama.keterangan,
    tautan: patch.tautan !== undefined ? patch.tautan : lama.tautan,
    ruang: patch.ruang !== undefined ? patch.ruang : lama.ruang,
  };
  const data = bacaIsian(gabung, training.jenisPelatihan, "");
  if (wajibHadir(lama.bentuk) && !wajibHadir(data.bentuk)) {
    const tercatat = await prisma.kehadiran.count({ where: { sesiId: id } });
    if (tercatat > 0) {
      throw new ConflictError("Sesi ini sudah punya catatan kehadiran, jadi bentuknya tidak bisa diganti menjadi asinkron/mandiri. Kosongkan kehadirannya dulu.");
    }
  }
  let row: SesiRow;
  try {
    row = (await prisma.sesiPembelajaran.update({ where: { id }, data })) as SesiRow;
  } catch (e) {
    if (kodePrisma(e) === "P2025") throw new NotFoundError(`Sesi pembelajaran "${id}" tidak ditemukan`);
    throw e;
  }
  return satuRecord(row);
}

/** Hapus sesi: hanya yang belum punya catatan kehadiran. Mengembalikan sesi yang dihapus (untuk log). */
export async function hapusSesiPembelajaran(id: string): Promise<SesiRow> {
  const sesi = await sesiOrThrow(id);
  const tercatat = await prisma.kehadiran.count({ where: { sesiId: id } });
  if (tercatat > 0) {
    throw new ConflictError(`Sesi ini sudah punya ${tercatat} catatan kehadiran, jadi tidak bisa dihapus. Kosongkan kehadirannya dulu kalau sesi ini memang batal.`);
  }
  await prisma.sesiPembelajaran.deleteMany({ where: { id } });
  return sesi;
}

type PesertaRow = { id: string; nomor: number; nama: string; instansi: string | null; status: string };
type HadirRow = { id: string; pesertaId: string; status: string; keterangan: string | null };

/** Lembar kehadiran satu sesi: peserta AKTIF + peserta tidak aktif yang sudah punya catatan pada sesi ini. */
export async function getLembarKehadiran(sesiId: string): Promise<LembarKehadiran> {
  const sesi = await sesiOrThrow(sesiId);
  const [peserta, hadir]: [PesertaRow[], HadirRow[]] = await Promise.all([
    prisma.peserta.findMany({
      where: { trainingId: sesi.trainingId },
      select: { id: true, nomor: true, nama: true, instansi: true, status: true },
      orderBy: [{ nomor: "asc" }, { nama: "asc" }],
    }),
    prisma.kehadiran.findMany({ where: { sesiId }, select: { id: true, pesertaId: true, status: true, keterangan: true } }),
  ]);
  const catatan = new Map(hadir.map((h) => [h.pesertaId, h]));
  const baris: BarisKehadiran[] = peserta
    .filter((p) => p.status === "AKTIF" || catatan.has(p.id))
    .map((p) => {
      const c = catatan.get(p.id);
      return {
        pesertaId: p.id,
        nomor: p.nomor,
        nama: p.nama,
        instansi: p.instansi ?? undefined,
        statusPeserta: isStatusPeserta(p.status) ? p.status : "AKTIF",
        status: c && isStatusKehadiran(c.status) ? c.status : null,
        keterangan: c?.keterangan ?? undefined,
      };
    });
  return { sesi: await satuRecord(sesi), baris };
}

export type KehadiranInput = { pesertaId: string; status: StatusKehadiran | null; keterangan?: string | null };

/**
 * Simpan kehadiran satu sesi. Hanya baris yang dikirim yang berubah; `status: null` menghapus catatannya.
 * Ditolak untuk peserta pelatihan lain dan catatan BARU bagi peserta yang sudah tidak aktif.
 */
export async function simpanKehadiran(sesiId: string, items: KehadiranInput[], dicatatOleh: string): Promise<LembarKehadiran> {
  const sesi = await sesiOrThrow(sesiId);
  const idKiriman = items.map((x) => x.pesertaId);
  if (new Set(idKiriman).size !== idKiriman.length) throw new ValidationError("Ada peserta yang dikirim dua kali");
  const [peserta, lama] = await Promise.all([
    prisma.peserta.findMany({ where: { trainingId: sesi.trainingId, id: { in: idKiriman } }, select: { id: true, status: true } }),
    prisma.kehadiran.findMany({ where: { sesiId, pesertaId: { in: idKiriman } }, select: { id: true, pesertaId: true } }),
  ]);
  if (peserta.length !== idKiriman.length) throw new ValidationError("Ada peserta yang bukan peserta pelatihan ini");
  const idLama = new Map(lama.map((k) => [k.pesertaId, k.id]));
  const tidakAktif = new Set(peserta.filter((p) => p.status !== "AKTIF").map((p) => p.id));

  const perintah = [];
  for (const x of items) {
    const ada = idLama.get(x.pesertaId);
    if (x.status === null) {
      if (ada) perintah.push(prisma.kehadiran.deleteMany({ where: { id: ada } }));
      continue;
    }
    if (!isStatusKehadiran(x.status)) throw new ValidationError(`Status kehadiran "${String(x.status)}" tidak dikenal`);
    // Catatan lama peserta tidak aktif boleh diperbaiki/dikosongkan, tapi tidak ditambah yang baru.
    if (!ada && tidakAktif.has(x.pesertaId)) throw new ValidationError("Peserta yang sudah mengundurkan diri atau diberhentikan tidak bisa dicatat pada sesi baru");
    // Keterangan hanya bermakna untuk yang tidak hadir/dispensasi.
    const keterangan = x.status === "HADIR" ? null : x.keterangan?.trim() || null;
    perintah.push(
      ada
        ? prisma.kehadiran.update({ where: { id: ada }, data: { status: x.status, keterangan, dicatatOleh } })
        : prisma.kehadiran.create({ data: { sesiId, pesertaId: x.pesertaId, status: x.status, keterangan, dicatatOleh } }),
    );
  }
  try {
    if (perintah.length > 0) await prisma.$transaction(perintah);
  } catch (e) {
    const kode = kodePrisma(e);
    if (kode === "P2002" || kode === "P2025" || kode === "P2003") throw new ConflictError("Lembar kehadiran ini baru saja diubah orang lain. Muat ulang lalu simpan lagi.");
    throw e;
  }
  return getLembarKehadiran(sesiId);
}


/** Masalah presensi harian satu jadwal sampai tanggal `sampai` — untuk kartu "Perlu perhatian". */
export async function masalahPresensi(trainingId: string, sampai: string): Promise<{ belumLengkap: string[]; tanpaSesi: string[] }> {
  const training = await getTrainingByIdOrThrow(trainingId);
  const [rows, hitung, masa] = await Promise.all([
    prisma.sesiPembelajaran.findMany({ where: { trainingId } }) as Promise<SesiRow[]>,
    hitungPerSesi(trainingId),
    masaJadwal(trainingId),
  ]);
  return periksaPresensi(training, rows, hitung, masa, sampai);
}
