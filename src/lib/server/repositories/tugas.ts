import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { BUCKET_DOKUMEN_PESERTA, hapusBerkas, tautanUnduh, unggahBerkas } from "@/lib/server/penyimpanan";
import { bolehKelolaTraining, pembacaSemua, type AksesDiklat } from "@/lib/server/akses";
import { catatAktivitas } from "@/lib/server/aktivitas";
import { WEWENANG_ATUR_PENUGASAN, punyaWewenang } from "@/lib/wewenang-penyelenggara";
import { daftarMataPelatihan, namaMataPelatihan } from "@/lib/kurikulum";
import { isoTanggal } from "@/lib/tanggal";
import {
  LABEL_PERAN_PENINJAU,
  TIPE_BERKAS_TUGAS,
  isiSesuaiTipeTugas,
  labelJenisTugas,
  labelStatusKiriman,
  lamaMenunggu,
  menungguTinjauan,
  peninjauJenis,
  peranBolehAksi,
  periksaBerkasTugas,
  periksaIsianTugas,
  rekapKiriman,
  statusSesudah,
  tipeDariNama,
  type AksiPeninjau,
  type IsianTugas,
  type PeranPeninjau,
  type RekapKiriman,
  type StatusKiriman,
} from "@/lib/tugas";
import type { JenisAktivitas } from "@/lib/aktivitas";

/**
 * Alur tugas peserta (EB-038; docs/spesifikasi/Rancangan_Dasbor_Pengelola_dan_Tugas.md bagian 5).
 *  - Pengelola diklat (Ketua Diklat/admin, tim pemegang diklat, Admin Penyelenggara "atur-penugasan") membuat
 *    semua jenis tugas; pengampu yang disetujui membuat tugas pembelajaran mata pelatihannya (TG-2).
 *  - Peserta mengunggah & mengirim. Peninjau: coach (penugasan angkatan + coach kelompok lama), mentor
 *    (penugasan angkatan), pengampu (penugasan WI disetujui untuk mata pelatihan tugas itu).
 *  - Pengelola melihat semua kiriman di diklatnya dan boleh mencatat tinjauan ATAS NAMA peninjau tanpa akun
 *    (Dokumen Induk 5.3); identitas pencatat tetap tersimpan.
 *  - Tidak mengubah nilai.
 */

export type Pengguna = { akses: AksesDiklat; email: string; name: string; pegawaiId: string | null };
export type Aktor = { email: string; name: string };

const tgl = (d: Date | null | undefined) => (d ? isoTanggal(new Date(d)) : null);
const keTanggal = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

type TrainingTugas = { id: string; name: string; jenisPelatihan: string | null; startDate: Date; endDate: Date | null; timKerjaId: string | null };
async function muatTraining(id: string): Promise<TrainingTugas> {
  const t: TrainingTugas | null = await prisma.training.findUnique({
    where: { id },
    select: { id: true, name: true, jenisPelatihan: true, startDate: true, endDate: true, timKerjaId: true },
  });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  return t;
}

/** Pengelola tugas satu diklat. */
async function kelolaTugas(p: Pengguna, trainingId: string): Promise<boolean> {
  return punyaWewenang(p.akses.wewenang, WEWENANG_ATUR_PENUGASAN) || (await bolehKelolaTraining(p.akses, trainingId));
}

/** Diklat yang dikelola: null = semua diklat. */
async function diklatKelolaan(p: Pengguna): Promise<string[] | null> {
  if (p.akses.global || punyaWewenang(p.akses.wewenang, WEWENANG_ATUR_PENUGASAN)) return null;
  if (!p.akses.timIds.length) return [];
  const rows: { id: string }[] = await prisma.training.findMany({ where: { timKerjaId: { in: p.akses.timIds } }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Mata pelatihan yang diampu (penugasan WI disetujui) di satu diklat. */
async function mataPelatihanDiampu(trainingId: string, pegawaiId: string | null): Promise<string[]> {
  if (!pegawaiId) return [];
  const rows: { mataPelatihan: string | null }[] = await prisma.penugasanApproval.findMany({
    where: { trainingId, instructorId: pegawaiId, status: "disetujui" },
    select: { mataPelatihan: true },
  });
  return [...new Set(rows.map((r) => r.mataPelatihan).filter((m): m is string => !!m))];
}

// --- Konteks peninjau --------------------------------------------------------------------

type KonteksPeninjau = {
  trainingIds: Set<string>;
  peranUntuk: (trainingId: string, pesertaId: string, jenis: string, mataPelatihan: string | null) => PeranPeninjau[];
};

/**
 * Semua penugasan peninjau milik satu pegawai, lalu fungsi untuk menentukan perannya terhadap satu kiriman.
 * Coach: penugasan angkatan COACH (lingkup peserta/kelompok) + coach kelompok lama. Mentor: penugasan MENTOR
 * (lingkup peserta). Pengampu: penugasan WI disetujui untuk mata pelatihan tugas.
 */
async function konteksPeninjau(pegawaiId: string | null, hanyaTraining?: string): Promise<KonteksPeninjau> {
  const kosong: KonteksPeninjau = { trainingIds: new Set(), peranUntuk: () => [] };
  if (!pegawaiId) return kosong;
  const saring = hanyaTraining ? { trainingId: hanyaTraining } : {};
  const [pa, kelLama, ampu] = await Promise.all([
    prisma.penugasanAngkatan.findMany({ where: { ...saring, pegawaiId, status: "AKTIF", peran: { in: ["COACH", "MENTOR"] } }, select: { trainingId: true, peran: true, pesertaIds: true, kelompokIds: true } }),
    prisma.kelompokPeserta.findMany({ where: { ...saring, coachPegawaiId: pegawaiId }, select: { id: true, trainingId: true } }),
    prisma.penugasanApproval.findMany({ where: { ...saring, instructorId: pegawaiId, status: "disetujui" }, select: { trainingId: true, mataPelatihan: true } }),
  ]) as [
    { trainingId: string; peran: string; pesertaIds: string[]; kelompokIds: string[] }[],
    { id: string; trainingId: string }[],
    { trainingId: string; mataPelatihan: string | null }[],
  ];
  const kelompokCoach = new Set<string>([...kelLama.map((k) => k.id), ...pa.filter((b) => b.peran === "COACH").flatMap((b) => b.kelompokIds ?? [])]);
  // Anggota kelompok yang dibimbing (tabel anggota_kelompok + kolom lama peserta.kelompokId).
  const anggota = new Map<string, Set<string>>(); // pesertaId -> kelompokIds
  if (kelompokCoach.size) {
    const ids = [...kelompokCoach];
    const [a1, a2] = (await Promise.all([
      prisma.anggotaKelompok.findMany({ where: { kelompokId: { in: ids } }, select: { pesertaId: true, kelompokId: true } }),
      prisma.peserta.findMany({ where: { kelompokId: { in: ids } }, select: { id: true, kelompokId: true } }),
    ])) as [{ pesertaId: string; kelompokId: string }[], { id: string; kelompokId: string | null }[]];
    for (const r of a1) anggota.set(r.pesertaId, (anggota.get(r.pesertaId) ?? new Set()).add(r.kelompokId));
    for (const r of a2) if (r.kelompokId) anggota.set(r.id, (anggota.get(r.id) ?? new Set()).add(r.kelompokId));
  }
  const kelLamaIds = new Set(kelLama.map((k) => k.id));
  const trainingIds = new Set<string>([...pa.map((b) => b.trainingId), ...kelLama.map((k) => k.trainingId), ...ampu.map((a) => a.trainingId)]);

  return {
    trainingIds,
    peranUntuk(trainingId, pesertaId, jenis, mataPelatihan) {
      const boleh = peninjauJenis(jenis);
      const peran: PeranPeninjau[] = [];
      const kel = anggota.get(pesertaId) ?? new Set<string>();
      if (boleh.includes("COACH")) {
        const lewatPa = pa.some(
          (b) => b.trainingId === trainingId && b.peran === "COACH" && ((b.pesertaIds ?? []).includes(pesertaId) || (b.kelompokIds ?? []).some((k) => kel.has(k))),
        );
        const lewatKelompok = kelLama.some((k) => k.trainingId === trainingId && kel.has(k.id) && kelLamaIds.has(k.id));
        if (lewatPa || lewatKelompok) peran.push("COACH");
      }
      if (boleh.includes("MENTOR") && pa.some((b) => b.trainingId === trainingId && b.peran === "MENTOR" && (b.pesertaIds ?? []).includes(pesertaId))) {
        peran.push("MENTOR");
      }
      if (boleh.includes("PENGAMPU") && ampu.some((a) => a.trainingId === trainingId && (!mataPelatihan || a.mataPelatihan === mataPelatihan))) {
        peran.push("PENGAMPU");
      }
      return peran;
    },
  };
}

// --- Tugas per diklat (pengelola & pengampu) ------------------------------------------------

type TugasRow = {
  id: string;
  trainingId: string;
  jenis: string;
  judul: string;
  petunjuk: string | null;
  tenggat: Date | null;
  mataPelatihan: string | null;
  dibuatOleh: string;
  createdAt: Date;
};
type KirimanRow = {
  id: string;
  tugasId: string;
  pesertaId: string;
  status: string;
  versi: number;
  berkasPath: string | null;
  berkasNama: string | null;
  berkasTipe: string | null;
  berkasUkuran: number | null;
  dikirimPada: Date | null;
  mentorSetuju: boolean;
  updatedAt: Date;
};

export type TugasRecord = {
  id: string;
  jenis: string;
  jenisLabel: string;
  judul: string;
  petunjuk: string | null;
  tenggat: string | null;
  mataPelatihan: string | null;
  mataPelatihanNama: string | null;
  bolehUbah: boolean;
  rekap: RekapKiriman;
  kiriman: { id: string; pesertaId: string; pesertaNama: string; nomor: number; status: string; statusLabel: string; versi: number; dikirimPada: string | null }[];
};
export type TugasDiklatRecord = {
  training: { id: string; name: string; jenisPelatihan: string | null; mulai: string; selesai: string | null };
  bolehKelola: boolean;
  /** Pengampu: kode mata pelatihan yang boleh dibuatkan tugas. */
  mataPelatihanSaya: string[];
  pilihanMataPelatihan: { kode: string; nama: string }[];
  jumlahPeserta: number;
  tugas: TugasRecord[];
};

const keTugasDasar = (t: TugasRow) => ({
  id: t.id,
  jenis: t.jenis,
  jenisLabel: labelJenisTugas(t.jenis),
  judul: t.judul,
  petunjuk: t.petunjuk,
  tenggat: tgl(t.tenggat),
  mataPelatihan: t.mataPelatihan,
  mataPelatihanNama: namaMataPelatihan(t.mataPelatihan),
});

async function hakDiklat(p: Pengguna, trainingId: string) {
  const kelola = await kelolaTugas(p, trainingId);
  const mpSaya = await mataPelatihanDiampu(trainingId, p.pegawaiId);
  const baca = kelola || mpSaya.length > 0 || pembacaSemua(p.akses, ["kepala-balai", "kabag-tu"]);
  return { kelola, mpSaya, baca };
}

const bolehUbahTugas = (t: { jenis: string; mataPelatihan: string | null }, kelola: boolean, mpSaya: string[]) =>
  kelola || (t.jenis === "TUGAS_PEMBELAJARAN" && !!t.mataPelatihan && mpSaya.includes(t.mataPelatihan));

export async function getTugasDiklat(p: Pengguna, trainingId: string): Promise<TugasDiklatRecord> {
  const t = await muatTraining(trainingId);
  const h = await hakDiklat(p, trainingId);
  if (!h.baca) throw new ForbiddenError();
  const [tugas, peserta] = (await Promise.all([
    prisma.tugas.findMany({ where: { trainingId }, orderBy: [{ tenggat: "asc" }, { createdAt: "asc" }] }),
    prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: { id: true, nomor: true, nama: true }, orderBy: { nomor: "asc" } }),
  ])) as [TugasRow[], { id: string; nomor: number; nama: string }[]];
  const kiriman: KirimanRow[] = tugas.length ? await prisma.kirimanTugas.findMany({ where: { tugasId: { in: tugas.map((x) => x.id) } } }) : [];
  const pesertaMap = new Map(peserta.map((x) => [x.id, x]));
  return {
    training: { id: t.id, name: t.name, jenisPelatihan: t.jenisPelatihan, mulai: tgl(t.startDate)!, selesai: tgl(t.endDate) },
    bolehKelola: h.kelola,
    mataPelatihanSaya: h.mpSaya,
    pilihanMataPelatihan: daftarMataPelatihan(t.jenisPelatihan).map((m) => ({ kode: m.kode, nama: m.nama })),
    jumlahPeserta: peserta.length,
    tugas: tugas.map((x) => {
      const milik = kiriman.filter((k) => k.tugasId === x.id && pesertaMap.has(k.pesertaId));
      return {
        ...keTugasDasar(x),
        bolehUbah: bolehUbahTugas(x, h.kelola, h.mpSaya),
        rekap: rekapKiriman(peserta.length, milik.map((k) => k.status)),
        kiriman: milik
          .map((k) => {
            const ps = pesertaMap.get(k.pesertaId)!;
            return { id: k.id, pesertaId: k.pesertaId, pesertaNama: ps.nama, nomor: ps.nomor, status: k.status, statusLabel: labelStatusKiriman(k.status), versi: k.versi, dikirimPada: k.dikirimPada?.toISOString() ?? null };
          })
          .sort((a, b) => a.nomor - b.nomor),
      };
    }),
  };
}

function rapikanIsian(isian: IsianTugas) {
  return {
    jenis: isian.jenis as string,
    judul: (isian.judul ?? "").trim(),
    petunjuk: isian.petunjuk?.trim() || null,
    tenggat: keTanggal(isian.tenggat || null),
    mataPelatihan: isian.jenis === "TUGAS_PEMBELAJARAN" ? isian.mataPelatihan || null : null,
  };
}

async function periksaHakUbah(p: Pengguna, t: TrainingTugas, isian: { jenis?: string; mataPelatihan?: string | null }) {
  const kelola = await kelolaTugas(p, t.id);
  if (kelola) return;
  const mp = await mataPelatihanDiampu(t.id, p.pegawaiId);
  if (!mp.length) throw new ForbiddenError();
  if (isian.jenis !== "TUGAS_PEMBELAJARAN" || !isian.mataPelatihan || !mp.includes(isian.mataPelatihan)) {
    throw new ForbiddenError("Pengampu hanya membuat tugas pembelajaran untuk mata pelatihan yang diampunya.");
  }
}

export async function tambahTugas(p: Pengguna, trainingId: string, isian: IsianTugas): Promise<string> {
  const t = await muatTraining(trainingId);
  await periksaHakUbah(p, t, isian);
  const galat = periksaIsianTugas(isian, { mulai: tgl(t.startDate)!, selesai: tgl(t.endDate) }, daftarMataPelatihan(t.jenisPelatihan).map((m) => m.kode));
  if (galat) throw new ValidationError(galat);
  const data = rapikanIsian(isian);
  const baru: { id: string } = await prisma.tugas.create({ data: { trainingId, ...data, dibuatOleh: p.email } });
  await catatAktivitas({ trainingId, aktor: p, jenis: "TUGAS_DIBUAT", objekTipe: "tugas", objekId: baru.id, ringkasan: `Tugas baru: ${data.judul}` });
  return baru.id;
}

async function muatTugas(trainingId: string, tugasId: string): Promise<TugasRow> {
  const x: TugasRow | null = await prisma.tugas.findUnique({ where: { id: tugasId } });
  if (!x || x.trainingId !== trainingId) throw new NotFoundError("Tugas tidak ditemukan");
  return x;
}

export async function ubahTugas(p: Pengguna, trainingId: string, tugasId: string, isian: IsianTugas): Promise<void> {
  const t = await muatTraining(trainingId);
  const lama = await muatTugas(trainingId, tugasId);
  await periksaHakUbah(p, t, lama);
  await periksaHakUbah(p, t, isian);
  if (isian.jenis !== lama.jenis) {
    const sudah = await prisma.kirimanTugas.count({ where: { tugasId, status: { not: "DRAF" } } });
    if (sudah > 0) throw new ConflictError("Jenis tugas tidak bisa diubah karena sudah ada kiriman peserta.");
  }
  const galat = periksaIsianTugas(isian, { mulai: tgl(t.startDate)!, selesai: tgl(t.endDate) }, daftarMataPelatihan(t.jenisPelatihan).map((m) => m.kode));
  if (galat) throw new ValidationError(galat);
  await prisma.tugas.update({ where: { id: tugasId }, data: rapikanIsian(isian) });
}

/** Hapus tugas: ditolak bila sudah ada kiriman yang dikirim (jejak tinjauan harus tetap ada). */
export async function hapusTugas(p: Pengguna, trainingId: string, tugasId: string): Promise<void> {
  const t = await muatTraining(trainingId);
  const lama = await muatTugas(trainingId, tugasId);
  await periksaHakUbah(p, t, lama);
  const sudah = await prisma.kirimanTugas.count({ where: { tugasId, status: { not: "DRAF" } } });
  if (sudah > 0) throw new ConflictError("Tugas ini sudah punya kiriman peserta, jadi tidak bisa dihapus.");
  const draf: { berkasPath: string | null }[] = await prisma.kirimanTugas.findMany({ where: { tugasId }, select: { berkasPath: true } });
  await prisma.tugas.deleteMany({ where: { id: tugasId } });
  for (const d of draf) if (d.berkasPath) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, d.berkasPath);
}

// --- Peserta ---------------------------------------------------------------------------------

type PesertaTugas = { id: string; trainingId: string; nama: string; status: string };
async function pesertaSendiri(pesertaId: string, email: string): Promise<PesertaTugas> {
  const x: (PesertaTugas & { akun: { email: string } | null }) | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { id: true, trainingId: true, nama: true, status: true, akun: { select: { email: true } } },
  });
  // Milik akun lain = "tidak ditemukan" (tidak membocorkan bahwa id itu ada).
  if (!x || !x.akun || x.akun.email !== email) throw new NotFoundError("Data peserta tidak ditemukan");
  return x;
}

export type RiwayatRecord = {
  id: string;
  aksi: string;
  status: string;
  statusLabel: string;
  aktorNama: string;
  peranAktor: string;
  peranLabel: string;
  atasNama: string | null;
  catatan: string | null;
  versi: number;
  adaBerkas: boolean;
  waktu: string;
};
type RiwayatRow = {
  id: string;
  kirimanId: string;
  aksi: string;
  status: string;
  aktorEmail: string;
  aktorNama: string;
  peranAktor: string;
  atasNama: string | null;
  catatan: string | null;
  versi: number;
  berkasPath: string | null;
  berkasNama: string | null;
  createdAt: Date;
};
const keRiwayat = (r: RiwayatRow): RiwayatRecord => ({
  id: r.id,
  aksi: r.aksi,
  status: r.status,
  statusLabel: labelStatusKiriman(r.status),
  aktorNama: r.aktorNama,
  peranAktor: r.peranAktor,
  peranLabel: LABEL_PERAN_PENINJAU[r.peranAktor as PeranPeninjau] ?? r.peranAktor,
  atasNama: r.atasNama,
  catatan: r.catatan,
  versi: r.versi,
  adaBerkas: !!r.berkasPath,
  waktu: r.createdAt.toISOString(),
});

export type KirimanRecord = {
  id: string;
  status: string;
  statusLabel: string;
  versi: number;
  berkasNama: string | null;
  berkasUkuran: number | null;
  dikirimPada: string | null;
  mentorSetuju: boolean;
};
const keKiriman = (k: KirimanRow): KirimanRecord => ({
  id: k.id,
  status: k.status,
  statusLabel: labelStatusKiriman(k.status),
  versi: k.versi,
  berkasNama: k.berkasNama,
  berkasUkuran: k.berkasUkuran,
  dikirimPada: k.dikirimPada?.toISOString() ?? null,
  mentorSetuju: k.mentorSetuju,
});

export type TugasPesertaRecord = {
  training: { id: string; name: string };
  tugas: (ReturnType<typeof keTugasDasar> & { kiriman: KirimanRecord | null; riwayat: RiwayatRecord[] })[];
};

export async function getTugasPeserta(pesertaId: string, email: string): Promise<TugasPesertaRecord> {
  const ps = await pesertaSendiri(pesertaId, email);
  const t = await muatTraining(ps.trainingId);
  const tugas: TugasRow[] = await prisma.tugas.findMany({ where: { trainingId: ps.trainingId }, orderBy: [{ tenggat: "asc" }, { createdAt: "asc" }] });
  const kiriman: KirimanRow[] = await prisma.kirimanTugas.findMany({ where: { pesertaId } });
  const riwayat: RiwayatRow[] = kiriman.length
    ? await prisma.riwayatKiriman.findMany({ where: { kirimanId: { in: kiriman.map((k) => k.id) } }, orderBy: { createdAt: "asc" } })
    : [];
  return {
    training: { id: t.id, name: t.name },
    tugas: tugas.map((x) => {
      const k = kiriman.find((r) => r.tugasId === x.id) ?? null;
      return { ...keTugasDasar(x), kiriman: k ? keKiriman(k) : null, riwayat: k ? riwayat.filter((r) => r.kirimanId === k.id).map(keRiwayat) : [] };
    }),
  };
}

async function kirimanPeserta(tugasId: string, ps: PesertaTugas): Promise<{ tugas: TugasRow; kiriman: KirimanRow | null }> {
  const x: TugasRow | null = await prisma.tugas.findUnique({ where: { id: tugasId } });
  if (!x || x.trainingId !== ps.trainingId) throw new NotFoundError("Tugas tidak ditemukan");
  const k: KirimanRow | null = await prisma.kirimanTugas.findUnique({ where: { tugasId_pesertaId: { tugasId, pesertaId: ps.id } } });
  return { tugas: x, kiriman: k };
}

const EKSTENSI: Record<string, string> = Object.fromEntries(Object.entries(TIPE_BERKAS_TUGAS).map(([tipe, eks]) => [tipe, eks[0]]));

/** Peserta mengunggah/mengganti berkas (status tetap Draf atau Perlu revisi). */
export async function unggahTugas(
  pesertaId: string,
  tugasId: string,
  berkas: { nama: string; tipe: string; isi: Uint8Array },
  aktor: Aktor,
): Promise<KirimanRecord> {
  const ps = await pesertaSendiri(pesertaId, aktor.email);
  if (ps.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const { tugas, kiriman } = await kirimanPeserta(tugasId, ps);
  const status = (kiriman?.status ?? "DRAF") as StatusKiriman;
  const boleh = statusSesudah(status, "UNGGAH");
  if (!boleh.ok) throw new ConflictError(boleh.pesan);
  const nama = berkas.nama.trim().slice(0, 150) || "berkas";
  const tipe = TIPE_BERKAS_TUGAS[berkas.tipe] ? berkas.tipe : tipeDariNama(nama) ?? berkas.tipe;
  const galat = periksaBerkasTugas({ nama, tipe, ukuran: berkas.isi.byteLength });
  if (galat) throw new ValidationError(galat);
  if (!isiSesuaiTipeTugas(berkas.isi, tipe)) throw new ValidationError("Isi berkas tidak sesuai formatnya (berkas rusak atau bukan dokumen yang diizinkan).");

  const k: KirimanRow =
    kiriman ?? (await prisma.kirimanTugas.create({ data: { tugasId, pesertaId: ps.id, status: "DRAF", versi: 0 } }));
  const path = `tugas/${ps.trainingId}/${ps.id}/${k.id}-v${k.versi + 1}-${Date.now()}.${EKSTENSI[tipe] ?? "bin"}`;
  await unggahBerkas(BUCKET_DOKUMEN_PESERTA, path, berkas.isi, tipe);
  // Berkas draf sebelumnya yang belum pernah dikirim dibuang; versi yang sudah dikirim tetap disimpan (riwayat).
  if (k.berkasPath) {
    const dipakai = await prisma.riwayatKiriman.count({ where: { kirimanId: k.id, berkasPath: k.berkasPath } });
    if (dipakai === 0) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, k.berkasPath);
  }
  const baru: KirimanRow = await prisma.kirimanTugas.update({
    where: { id: k.id },
    data: { berkasPath: path, berkasNama: nama, berkasTipe: tipe, berkasUkuran: berkas.isi.byteLength },
  });
  await catatAktivitas({ trainingId: ps.trainingId, aktor, jenis: "TUGAS_DIUNGGAH", objekTipe: "kiriman", objekId: k.id, ringkasan: `${ps.nama} mengunggah berkas ${tugas.judul}` });
  return keKiriman(baru);
}

/** Peserta mengirim tugas untuk ditinjau. */
export async function kirimTugas(pesertaId: string, tugasId: string, aktor: Aktor): Promise<KirimanRecord> {
  const ps = await pesertaSendiri(pesertaId, aktor.email);
  if (ps.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const { tugas, kiriman } = await kirimanPeserta(tugasId, ps);
  const hasil = statusSesudah((kiriman?.status ?? "DRAF") as StatusKiriman, "KIRIM", { adaBerkas: !!kiriman?.berkasPath });
  if (!hasil.ok) throw new ConflictError(hasil.pesan);
  const k = kiriman!;
  const versi = k.versi + 1;
  const baru: KirimanRow = await prisma.kirimanTugas.update({ where: { id: k.id }, data: { status: hasil.status, versi, dikirimPada: new Date() } });
  await prisma.riwayatKiriman.create({
    data: { kirimanId: k.id, aksi: "KIRIM", status: hasil.status, aktorEmail: aktor.email, aktorNama: aktor.name, peranAktor: "PESERTA", versi, berkasPath: k.berkasPath, berkasNama: k.berkasNama },
  });
  await catatAktivitas({
    trainingId: ps.trainingId,
    aktor,
    jenis: "TUGAS_DIKIRIM",
    objekTipe: "kiriman",
    objekId: k.id,
    ringkasan: `${ps.nama} mengirim ${tugas.judul}${versi > 1 ? ` (versi ${versi})` : ""}`,
  });
  return keKiriman(baru);
}

// --- Peninjau & pengelola ---------------------------------------------------------------------

type KirimanLengkap = KirimanRow & {
  tugas: TugasRow;
  peserta: { id: string; nama: string; nomor: number; trainingId: string; akun: { email: string } | null };
};
async function muatKiriman(id: string): Promise<KirimanLengkap> {
  const k: KirimanLengkap | null = await prisma.kirimanTugas.findUnique({
    where: { id },
    include: { tugas: true, peserta: { select: { id: true, nama: true, nomor: true, trainingId: true, akun: { select: { email: true } } } } },
  });
  if (!k) throw new NotFoundError("Kiriman tugas tidak ditemukan");
  return k;
}

type HakKiriman = { pemilik: boolean; peran: PeranPeninjau[]; pengelola: boolean };
async function hakKiriman(p: Pengguna, k: KirimanLengkap): Promise<HakKiriman> {
  const pemilik = !!k.peserta.akun && k.peserta.akun.email === p.email;
  const ctx = await konteksPeninjau(p.pegawaiId, k.tugas.trainingId);
  const peran = ctx.peranUntuk(k.tugas.trainingId, k.pesertaId, k.tugas.jenis, k.tugas.mataPelatihan);
  const pengelola = await kelolaTugas(p, k.tugas.trainingId);
  return { pemilik, peran, pengelola };
}

export type DetailKirimanRecord = {
  kiriman: KirimanRecord;
  tugas: ReturnType<typeof keTugasDasar>;
  training: { id: string; name: string };
  peserta: { id: string; nama: string; nomor: number };
  riwayat: RiwayatRecord[];
  pemilik: boolean;
  peran: PeranPeninjau[];
  pengelola: boolean;
  /** Peran yang boleh dipilih pengelola saat mencatat atas nama peninjau. */
  peranAtasNama: PeranPeninjau[];
};

export async function getDetailKiriman(p: Pengguna, kirimanId: string): Promise<DetailKirimanRecord> {
  const k = await muatKiriman(kirimanId);
  const h = await hakKiriman(p, k);
  if (!h.pemilik && !h.peran.length && !h.pengelola) throw new NotFoundError("Kiriman tugas tidak ditemukan");
  // Draf belum dikirim hanya terlihat oleh pesertanya sendiri.
  if (!h.pemilik && k.status === "DRAF") throw new NotFoundError("Kiriman tugas tidak ditemukan");
  const t = await muatTraining(k.tugas.trainingId);
  const riwayat: RiwayatRow[] = await prisma.riwayatKiriman.findMany({ where: { kirimanId }, orderBy: { createdAt: "asc" } });
  return {
    kiriman: keKiriman(k),
    tugas: keTugasDasar(k.tugas),
    training: { id: t.id, name: t.name },
    peserta: { id: k.peserta.id, nama: k.peserta.nama, nomor: k.peserta.nomor },
    riwayat: riwayat.map(keRiwayat),
    pemilik: h.pemilik,
    peran: h.peran,
    pengelola: h.pengelola,
    peranAtasNama: h.pengelola ? [...peninjauJenis(k.tugas.jenis)] : [],
  };
}

export type IsianTinjau = { aksi: AksiPeninjau; catatan?: string | null; sebagai?: PeranPeninjau | null; atasNama?: string | null };

const AKTIVITAS_AKSI: Record<AksiPeninjau, JenisAktivitas> = {
  MULAI_TINJAU: "TUGAS_DITINJAU",
  REVISI: "TUGAS_REVISI",
  TERIMA: "TUGAS_DITERIMA",
  CATATAN: "TUGAS_CATATAN",
  SETUJU_MENTOR: "TUGAS_MENTOR_SETUJU",
};
const KATA_AKSI: Record<AksiPeninjau, string> = {
  MULAI_TINJAU: "mulai meninjau",
  REVISI: "meminta revisi",
  TERIMA: "menerima",
  CATATAN: "memberi catatan pada",
  SETUJU_MENTOR: "menyetujui isu & timeline",
};

/**
 * Tindakan peninjau. Peninjau bertindak dengan perannya sendiri (`sebagai` dipilih bila punya lebih dari satu).
 * Pengelola yang bukan peninjau hanya boleh mencatat ATAS NAMA peninjau: `sebagai` + `atasNama` wajib.
 */
export async function tinjauKiriman(p: Pengguna, kirimanId: string, isian: IsianTinjau): Promise<DetailKirimanRecord> {
  const k = await muatKiriman(kirimanId);
  const h = await hakKiriman(p, k);
  if (!h.peran.length && !h.pengelola) throw new NotFoundError("Kiriman tugas tidak ditemukan");
  if (h.pemilik && !h.peran.length && !h.pengelola) throw new ForbiddenError("Peserta tidak meninjau tugasnya sendiri.");

  let peran: PeranPeninjau;
  let atasNama: string | null = null;
  let peranAktor: string;
  if (h.peran.length) {
    peran = isian.sebagai && h.peran.includes(isian.sebagai) ? isian.sebagai : h.peran[0];
    peranAktor = peran;
  } else {
    atasNama = isian.atasNama?.trim() || null;
    if (!isian.sebagai || !peninjauJenis(k.tugas.jenis).includes(isian.sebagai)) throw new ValidationError("Pilih peran peninjau yang diwakili.");
    if (!atasNama || atasNama.length < 3) throw new ValidationError("Isi nama peninjau yang diwakili (minimal 3 huruf).");
    peran = isian.sebagai;
    peranAktor = "PENGELOLA";
  }
  if (!peranBolehAksi(k.tugas.jenis, peran, isian.aksi)) throw new ForbiddenError("Peran ini tidak meninjau jenis tugas tersebut.");
  const hasil = statusSesudah(k.status as StatusKiriman, isian.aksi, { catatan: isian.catatan, jenis: k.tugas.jenis, peran });
  if (!hasil.ok) throw new ConflictError(hasil.pesan);

  const catatan = isian.catatan?.trim() || null;
  await prisma.kirimanTugas.update({
    where: { id: k.id },
    data: { status: hasil.status, ...(isian.aksi === "SETUJU_MENTOR" ? { mentorSetuju: true } : {}) },
  });
  await prisma.riwayatKiriman.create({
    data: {
      kirimanId: k.id,
      aksi: isian.aksi,
      status: hasil.status,
      aktorEmail: p.email,
      aktorNama: p.name,
      peranAktor,
      atasNama: atasNama ? `${atasNama} (${LABEL_PERAN_PENINJAU[peran]})` : null,
      catatan: catatan ? catatan.slice(0, 2000) : null,
      versi: k.versi,
    },
  });
  const pelaku = atasNama ?? p.name;
  await catatAktivitas({
    trainingId: k.tugas.trainingId,
    aktor: p,
    atasNama,
    jenis: AKTIVITAS_AKSI[isian.aksi],
    objekTipe: "kiriman",
    objekId: k.id,
    ringkasan: `${pelaku} ${KATA_AKSI[isian.aksi]} ${k.tugas.judul} — ${k.peserta.nama}`,
  });
  return getDetailKiriman(p, kirimanId);
}

/** Tautan unduh berkas kiriman (versi terkini, atau versi pada satu baris riwayat). */
export async function tautanBerkasKiriman(p: Pengguna, kirimanId: string, riwayatId: string | null): Promise<string> {
  const k = await muatKiriman(kirimanId);
  const h = await hakKiriman(p, k);
  if (!h.pemilik && !h.peran.length && !h.pengelola) throw new NotFoundError("Kiriman tugas tidak ditemukan");
  if (!h.pemilik && k.status === "DRAF" && !riwayatId) throw new NotFoundError("Berkas belum dikirim");
  let path = k.berkasPath;
  let nama = k.berkasNama;
  if (riwayatId) {
    const r: RiwayatRow | null = await prisma.riwayatKiriman.findUnique({ where: { id: riwayatId } });
    if (!r || r.kirimanId !== kirimanId || !r.berkasPath) throw new NotFoundError("Berkas versi ini tidak ditemukan");
    path = r.berkasPath;
    nama = r.berkasNama;
  } else if (!h.pemilik) {
    // Peninjau membuka berkas yang terakhir DIKIRIM (bukan draf pengganti yang belum dikirim).
    const terakhir: RiwayatRow | null = await prisma.riwayatKiriman.findFirst({ where: { kirimanId, aksi: "KIRIM" }, orderBy: { versi: "desc" } });
    if (terakhir?.berkasPath) {
      path = terakhir.berkasPath;
      nama = terakhir.berkasNama;
    }
  }
  if (!path) throw new NotFoundError("Belum ada berkas");
  return tautanUnduh(BUCKET_DOKUMEN_PESERTA, path, nama ?? undefined);
}

export type ButirTinjau = {
  kirimanId: string;
  trainingId: string;
  trainingNama: string;
  judul: string;
  jenis: string;
  jenisLabel: string;
  pesertaNama: string;
  status: string;
  statusLabel: string;
  versi: number;
  dikirimPada: string | null;
  hariMenunggu: number;
  peran: PeranPeninjau[];
  pengelola: boolean;
};
export type DaftarTinjau = { siap: boolean; butir: ButirTinjau[] };

/**
 * Kiriman yang perlu ditinjau akun ini: sebagai peninjau (coach/mentor/pengampu) atau pengelola diklat.
 * `semua=false` = hanya yang menunggu (Dikirim / Dalam tinjauan); `true` = semua kecuali draf.
 */
export async function daftarTinjau(p: Pengguna, o: { trainingId?: string | null; semua?: boolean; now?: Date } = {}): Promise<DaftarTinjau> {
  const now = o.now ?? new Date();
  const ctx = await konteksPeninjau(p.pegawaiId, o.trainingId ?? undefined);
  const kelolaan = await diklatKelolaan(p);
  let pengelolaUntuk: (trainingId: string) => boolean;
  let saringTraining: string[] | null; // null = semua diklat
  if (o.trainingId) {
    const kelola = await kelolaTugas(p, o.trainingId);
    pengelolaUntuk = () => kelola;
    saringTraining = kelola || ctx.trainingIds.has(o.trainingId) ? [o.trainingId] : [];
  } else if (kelolaan === null) {
    pengelolaUntuk = () => true;
    saringTraining = null;
  } else {
    const set = new Set(kelolaan);
    pengelolaUntuk = (id) => set.has(id);
    saringTraining = [...new Set([...kelolaan, ...ctx.trainingIds])];
  }
  if (saringTraining && saringTraining.length === 0) return { siap: true, butir: [] };

  let rows: KirimanLengkap[];
  try {
    rows = await prisma.kirimanTugas.findMany({
      where: {
        status: o.semua ? { not: "DRAF" } : { in: ["DIKIRIM", "DITINJAU"] },
        ...(saringTraining ? { tugas: { trainingId: { in: saringTraining } } } : {}),
      },
      include: { tugas: true, peserta: { select: { id: true, nama: true, nomor: true, trainingId: true, akun: { select: { email: true } } } } },
      orderBy: { dikirimPada: "asc" },
      take: 300,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2021") return { siap: false, butir: [] };
    throw e;
  }
  const trainingNama = new Map<string, string>();
  const ids = [...new Set(rows.map((r) => r.tugas.trainingId))];
  if (ids.length) {
    const ts: { id: string; name: string }[] = await prisma.training.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    for (const t of ts) trainingNama.set(t.id, t.name);
  }
  const butir: ButirTinjau[] = [];
  for (const k of rows) {
    const peran = ctx.peranUntuk(k.tugas.trainingId, k.pesertaId, k.tugas.jenis, k.tugas.mataPelatihan);
    const pengelola = pengelolaUntuk(k.tugas.trainingId);
    if (!peran.length && !pengelola) continue;
    const dikirim = k.dikirimPada?.toISOString() ?? null;
    butir.push({
      kirimanId: k.id,
      trainingId: k.tugas.trainingId,
      trainingNama: trainingNama.get(k.tugas.trainingId) ?? "",
      judul: k.tugas.judul,
      jenis: k.tugas.jenis,
      jenisLabel: labelJenisTugas(k.tugas.jenis),
      pesertaNama: k.peserta.nama,
      status: k.status,
      statusLabel: labelStatusKiriman(k.status),
      versi: k.versi,
      dikirimPada: dikirim,
      hariMenunggu: menungguTinjauan(k.status) ? lamaMenunggu(dikirim, now) : 0,
      peran,
      pengelola,
    });
  }
  return { siap: true, butir };
}
