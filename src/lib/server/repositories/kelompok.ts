import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { kunciCoachKelompok } from "@/lib/evaluasi";
import { bacaTautan } from "@/lib/sesi";
import { isStatusPeserta, type StatusPeserta } from "@/lib/peserta";
import {
  JENIS_KELOMPOK,
  JENIS_KELOMPOK_BAWAAN,
  JENIS_KELOMPOK_COACH,
  JUMLAH_KELOMPOK_MAKS,
  KATEGORI_INSTANSI,
  bagiAcak,
  bagiInstansiKabupaten,
  bagiKelompok,
  bagiPerKategori,
  kabupatenDari,
  labelJenisKelompok,
  labelKategori,
  labelKelompok,
  pakaiCoach,
  pakaiKelompok,
  periksaKelompok,
  tebakKategori,
  type JenisKelompok,
} from "@/lib/kelompok";

/**
 * Kelompok peserta PKA/PKP per jenis kegiatan (keputusan 14 Okt 2026), dengan revisi EB-046 s/d EB-050:
 *  - E-learning dibagi acak (tanpa coach).
 *  - Bimbingan & seminar: dibimbing coach, menjadi ruang coaching dan kelompok seminar RAP/LAP; disusun per instansi
 *    lalu kabupaten/kota; punya kelas/ruang seminar.
 *  - Studi lapangan: dibagi per kategori instansi peserta; punya kategori dan lokus tujuan.
 *  - Semua jenis punya ketua kelompok (peserta anggotanya). Semua hasil otomatis bisa diubah admin/Ketua Diklat.
 * Satu peserta paling banyak satu kelompok per jenis (tabel `anggota_kelompok`).
 * Kelola: Ketua Diklat/admin; lihat: Kepala Balai, Kabag TU; peserta melihat kelompoknya di ruang belajar.
 */

export type AnggotaKelompok = {
  id: string;
  nomor: number;
  nama: string;
  jabatan: string | null;
  instansi: string | null;
  status: StatusPeserta;
  kabupaten: string | null;
  /** Kategori instansi efektif (pilihan admin, atau tebakan dari jabatan/instansi). */
  kategori: string;
  kategoriDitebak: boolean;
};
export type KelompokItem = {
  id: string;
  nomor: number;
  nama: string | null;
  label: string;
  coachNama: string | null;
  coachPegawaiId: string | null;
  tautan: string | null;
  ketuaPesertaId: string | null;
  ketuaNama: string | null;
  kategori: string | null;
  lokus: string | null;
  kelas: string | null;
  anggota: AnggotaKelompok[];
};
export type KelompokRecord = {
  training: { id: string; name: string; jenisPelatihan: string | null; angkatan: string | null; startDate: string };
  bolehKelola: boolean;
  jenis: JenisKelompok;
  daftarJenis: { kode: JenisKelompok; label: string; pedoman: number | null; jumlah: number }[];
  pedoman: number | null;
  pakaiCoach: boolean;
  kelompok: KelompokItem[];
  tanpaKelompok: AnggotaKelompok[];
  peringatan: string[];
  /** WI yang penugasannya disetujui pada jadwal ini — pilihan coach. */
  wi: { id: string; nama: string }[];
  kategori: { kode: string; label: string }[];
};

type KelompokRow = {
  id: string;
  trainingId: string;
  jenis: string;
  nomor: number;
  nama: string | null;
  coachNama: string | null;
  coachPegawaiId: string | null;
  tautan: string | null;
  ketuaPesertaId: string | null;
  kategori: string | null;
  lokus: string | null;
  kelas: string | null;
};
type PesertaRow = { id: string; nomor: number; nama: string; jabatan: string | null; instansi: string | null; status: string; kategoriInstansi: string | null };

async function trainingKelompok(trainingId: string) {
  const t = await prisma.training.findUnique({ where: { id: trainingId }, select: { id: true, name: true, jenisPelatihan: true, angkatan: true, startDate: true } });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  if (!pakaiKelompok(t.jenisPelatihan)) throw new ValidationError("Kelompok hanya untuk pelatihan PKA/PKP");
  return t;
}

const kelompokJadwal = async (trainingId: string, jenis: JenisKelompok): Promise<KelompokRow[]> =>
  prisma.kelompokPeserta.findMany({ where: { trainingId, jenis }, orderBy: { nomor: "asc" } });

const kategoriEfektif = (p: PesertaRow) => p.kategoriInstansi || tebakKategori(p.jabatan, p.instansi);

const anggotaDari = (p: PesertaRow): AnggotaKelompok => ({
  id: p.id,
  nomor: p.nomor,
  nama: p.nama,
  jabatan: p.jabatan,
  instansi: p.instansi,
  status: (isStatusPeserta(p.status) ? p.status : "AKTIF") as StatusPeserta,
  kabupaten: kabupatenDari(p.instansi, p.jabatan),
  kategori: kategoriEfektif(p),
  kategoriDitebak: !p.kategoriInstansi,
});

const SELECT_PESERTA = { id: true, nomor: true, nama: true, jabatan: true, instansi: true, status: true, kategoriInstansi: true } as const;

export async function getKelompok(trainingId: string, bolehKelola: boolean, jenis: JenisKelompok = JENIS_KELOMPOK_BAWAAN): Promise<KelompokRecord> {
  const t = await trainingKelompok(trainingId);
  const [semua, peserta]: [KelompokRow[], PesertaRow[]] = await Promise.all([
    prisma.kelompokPeserta.findMany({ where: { trainingId }, orderBy: { nomor: "asc" } }),
    prisma.peserta.findMany({ where: { trainingId }, orderBy: { nomor: "asc" }, select: SELECT_PESERTA }),
  ]);
  const kel = semua.filter((k) => k.jenis === jenis);
  const anggota = kel.length ? await prisma.anggotaKelompok.findMany({ where: { kelompokId: { in: kel.map((k) => k.id) } }, select: { kelompokId: true, pesertaId: true } }) : [];
  const kelompokDari = new Map(anggota.map((a) => [a.pesertaId, a.kelompokId]));

  const pen = await prisma.penugasanApproval.findMany({ where: { trainingId, status: "disetujui" }, select: { instructorId: true, instructor: { select: { nama: true } } } });
  const wi = new Map<string, string>();
  for (const p of pen) wi.set(p.instructorId, p.instructor?.nama ?? "(Widyaiswara)");

  const kelompok: KelompokItem[] = kel.map((k) => {
    const isi = peserta.filter((p) => kelompokDari.get(p.id) === k.id).map(anggotaDari);
    const ketua = isi.find((a) => a.id === k.ketuaPesertaId) ?? null;
    return {
      id: k.id,
      nomor: k.nomor,
      nama: k.nama,
      label: labelKelompok(k),
      coachNama: pakaiCoach(k.jenis) ? k.coachNama : null,
      coachPegawaiId: pakaiCoach(k.jenis) ? k.coachPegawaiId : null,
      tautan: k.tautan,
      ketuaPesertaId: ketua?.id ?? null,
      ketuaNama: ketua?.nama ?? null,
      kategori: k.kategori,
      lokus: k.lokus,
      kelas: k.kelas,
      anggota: isi,
    };
  });
  const tanpaKelompok = peserta.filter((p) => p.status === "AKTIF" && !kelompokDari.has(p.id)).map(anggotaDari);
  const pedoman = JENIS_KELOMPOK.find((j) => j.kode === jenis)?.pedoman ?? null;
  return {
    training: { id: t.id, name: t.name, jenisPelatihan: t.jenisPelatihan, angkatan: t.angkatan, startDate: t.startDate.toISOString().slice(0, 10) },
    bolehKelola,
    jenis,
    daftarJenis: JENIS_KELOMPOK.map((j) => ({ ...j, jumlah: semua.filter((k) => k.jenis === j.kode).length })),
    pedoman,
    pakaiCoach: pakaiCoach(jenis),
    kelompok,
    tanpaKelompok,
    peringatan: periksaKelompok(
      kelompok.map((k) => k.anggota.filter((a) => a.status === "AKTIF").length),
      tanpaKelompok.length,
      pedoman,
    ),
    wi: [...wi.entries()].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama)),
    kategori: KATEGORI_INSTANSI.map((k) => ({ kode: k.kode, label: k.label })),
  };
}

function cekJumlah(jumlah: number) {
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > JUMLAH_KELOMPOK_MAKS) throw new ValidationError(`Jumlah kelompok 1–${JUMLAH_KELOMPOK_MAKS}`);
}

/** Jadikan kelompok jenis ini bernomor 1..jumlah. Kelompok bernomor lebih besar dihapus; anggotanya jadi tanpa kelompok. */
export async function aturJumlah(trainingId: string, jenis: JenisKelompok, jumlah: number): Promise<void> {
  await trainingKelompok(trainingId);
  cekJumlah(jumlah);
  const kel = await kelompokJadwal(trainingId, jenis);
  const lebih = kel.filter((k) => k.nomor > jumlah).map((k) => k.id);
  if (lebih.length) {
    const dinilai = await prisma.evaluasiPengajar.count({ where: { sasaranKunci: { in: lebih.map(kunciCoachKelompok) } } });
    if (dinilai) throw new ConflictError(`Coach kelompok yang akan dihapus sudah dievaluasi ${dinilai} peserta — kelompok tidak bisa dikurangi`);
    await prisma.anggotaKelompok.deleteMany({ where: { kelompokId: { in: lebih } } });
    await prisma.kelompokPeserta.deleteMany({ where: { id: { in: lebih } } });
  }
  const ada = new Set(kel.map((k) => k.nomor));
  for (let n = 1; n <= jumlah; n++) if (!ada.has(n)) await prisma.kelompokPeserta.create({ data: { trainingId, jenis, nomor: n } });
}

/**
 * Bagi ulang SEMUA peserta aktif ke `jumlah` kelompok jenis ini. Cara bagi menurut jenis:
 * e-learning acak (EB-047), bimbingan & seminar per instansi lalu kabupaten (EB-048), studi lapangan per kategori
 * instansi (EB-050; kolom kategori kelompok ikut diisi), belajar mandiri merata menyebar instansi. Ketua dikosongkan.
 */
export async function bagiOtomatis(trainingId: string, jenis: JenisKelompok, jumlah: number): Promise<number> {
  await aturJumlah(trainingId, jenis, jumlah);
  const kel = await kelompokJadwal(trainingId, jenis);
  const perNomor = new Map(kel.map((k) => [k.nomor, k.id]));
  const aktif: PesertaRow[] = await prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: SELECT_PESERTA });
  let bagi: Map<string, number>;
  let kategoriKelompok: Map<number, string[]> | null = null;
  if (jenis === "ELEARNING") bagi = bagiAcak(aktif, jumlah);
  else if (jenis === JENIS_KELOMPOK_COACH) bagi = bagiInstansiKabupaten(aktif, jumlah);
  else if (jenis === "STULA") {
    const hasil = bagiPerKategori(
      aktif.map((p) => ({ ...p, kategori: kategoriEfektif(p) })),
      jumlah,
    );
    bagi = hasil.nomor;
    kategoriKelompok = hasil.kategori;
  } else bagi = bagiKelompok(aktif, jumlah);
  await prisma.$transaction([
    prisma.anggotaKelompok.deleteMany({ where: { kelompokId: { in: kel.map((k) => k.id) } } }),
    prisma.kelompokPeserta.updateMany({ where: { id: { in: kel.map((k) => k.id) } }, data: { ketuaPesertaId: null } }),
    ...aktif.map((p) => prisma.anggotaKelompok.create({ data: { kelompokId: perNomor.get(bagi.get(p.id)!)!, pesertaId: p.id, jenis } })),
    ...(kategoriKelompok
      ? kel.map((k) =>
          prisma.kelompokPeserta.update({
            where: { id: k.id },
            data: { kategori: (kategoriKelompok!.get(k.nomor) ?? []).map(labelKategori).join(", ") || null },
          }),
        )
      : []),
  ]);
  return aktif.length;
}

async function kelompokMilik(trainingId: string, id: string): Promise<KelompokRow> {
  const k: KelompokRow | null = await prisma.kelompokPeserta.findUnique({ where: { id } });
  if (!k || k.trainingId !== trainingId) throw new NotFoundError("Kelompok tidak ditemukan");
  return k;
}

const teks = (v: string | null | undefined, maks: number) => v?.trim().slice(0, maks) || null;

export async function ubahKelompok(
  trainingId: string,
  id: string,
  input: {
    nama?: string | null;
    coachNama?: string | null;
    coachPegawaiId?: string | null;
    tautan?: string | null;
    ketuaPesertaId?: string | null;
    kategori?: string | null;
    lokus?: string | null;
    kelas?: string | null;
  },
): Promise<string> {
  await trainingKelompok(trainingId);
  const k = await kelompokMilik(trainingId, id);
  let coachNama = pakaiCoach(k.jenis) ? input.coachNama?.trim() || null : null;
  const coachPegawaiId = pakaiCoach(k.jenis) ? input.coachPegawaiId || null : null;
  if (coachPegawaiId) {
    const pg = await prisma.pegawai.findUnique({ where: { id: coachPegawaiId }, select: { nama: true } });
    if (!pg) throw new ValidationError("Pegawai coach tidak ditemukan");
    coachNama ??= pg.nama;
  }
  // Isian evaluasi coach menempel ke kelompok: coach yang sudah dievaluasi tidak boleh diganti orangnya.
  if ((coachNama ?? null) !== (k.coachNama ?? null) || coachPegawaiId !== (k.coachPegawaiId ?? null)) {
    const dinilai = await prisma.evaluasiPengajar.count({ where: { sasaranKunci: kunciCoachKelompok(id) } });
    if (dinilai) throw new ConflictError(`Coach ${labelKelompok(k)} sudah dievaluasi ${dinilai} peserta — tidak bisa diganti`);
  }
  const tautan = bacaTautan(input.tautan);
  if (tautan === undefined) throw new ValidationError("Tautan harus alamat web lengkap (https://…)");
  const ketua = input.ketuaPesertaId || null;
  if (ketua) {
    const anggota = await prisma.anggotaKelompok.findFirst({ where: { kelompokId: id, pesertaId: ketua }, select: { id: true } });
    if (!anggota) throw new ValidationError("Ketua kelompok harus anggota kelompok itu");
  }
  await prisma.kelompokPeserta.update({
    where: { id },
    data: {
      nama: input.nama?.trim() || null,
      coachNama,
      coachPegawaiId,
      tautan,
      ketuaPesertaId: ketua,
      kategori: k.jenis === "STULA" ? teks(input.kategori, 120) : null,
      lokus: k.jenis === "STULA" ? teks(input.lokus, 150) : null,
      kelas: pakaiCoach(k.jenis) ? teks(input.kelas, 30) : null,
    },
  });
  return labelKelompok(k);
}

/** Pindahkan satu peserta ke kelompok lain jenis ini (null = keluarkan). Bila ia ketua kelompok lamanya, ketua dikosongkan. */
export async function pindahPeserta(trainingId: string, jenis: JenisKelompok, pesertaId: string, kelompokId: string | null): Promise<void> {
  await trainingKelompok(trainingId);
  const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true } });
  if (!p || p.trainingId !== trainingId) throw new NotFoundError("Peserta tidak ditemukan");
  if (kelompokId) {
    const k = await kelompokMilik(trainingId, kelompokId);
    if (k.jenis !== jenis) throw new ValidationError("Kelompok tujuan bukan jenis kegiatan yang sama");
  }
  await prisma.$transaction([
    prisma.kelompokPeserta.updateMany({
      where: { trainingId, jenis, ketuaPesertaId: pesertaId, ...(kelompokId ? { id: { not: kelompokId } } : {}) },
      data: { ketuaPesertaId: null },
    }),
    prisma.anggotaKelompok.deleteMany({ where: { pesertaId, jenis } }),
    ...(kelompokId ? [prisma.anggotaKelompok.create({ data: { kelompokId, pesertaId, jenis } })] : []),
  ]);
}

/** Kategori instansi seorang peserta untuk studi lapangan (EB-050); null = kembali ke tebakan otomatis. */
export async function aturKategoriPeserta(trainingId: string, pesertaId: string, kategori: string | null): Promise<void> {
  await trainingKelompok(trainingId);
  const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true } });
  if (!p || p.trainingId !== trainingId) throw new NotFoundError("Peserta tidak ditemukan");
  if (kategori && !KATEGORI_INSTANSI.some((k) => k.kode === kategori)) throw new ValidationError("Kategori instansi tidak dikenal");
  await prisma.peserta.update({ where: { id: pesertaId }, data: { kategoriInstansi: kategori || null } });
}

/** Kelompok bimbingan & seminar (coach) seorang peserta — untuk membatasi evaluasi coach (EB-046). */
export async function kelompokCoachPeserta(pesertaId: string): Promise<string | null> {
  const a = await prisma.anggotaKelompok.findUnique({ where: { pesertaId_jenis: { pesertaId, jenis: JENIS_KELOMPOK_COACH } }, select: { kelompokId: true } });
  return a?.kelompokId ?? null;
}

export type KelompokPesertaRecord = {
  /** kelompok_peserta.id — jenis bimbingan & seminar membuka Ruang Coaching (/dashboard/coaching/[id]). */
  kelompokId: string;
  jenis: JenisKelompok;
  labelJenis: string;
  label: string;
  coachNama: string | null;
  tautan: string | null;
  ketuaNama: string | null;
  lokus: string | null;
  kelas: string | null;
  /** Teman sekelompok yang aktif (tanpa dirinya). */
  anggota: string[];
};

/** Semua kelompok seorang peserta (per jenis) untuk ruang belajarnya. */
export async function kelompokUntukPeserta(pesertaId: string): Promise<KelompokPesertaRecord[]> {
  const milik = await prisma.anggotaKelompok.findMany({ where: { pesertaId }, select: { kelompokId: true } });
  const out: KelompokPesertaRecord[] = [];
  for (const m of milik) {
    const k: KelompokRow | null = await prisma.kelompokPeserta.findUnique({ where: { id: m.kelompokId } });
    if (!k) continue;
    const teman = await prisma.anggotaKelompok.findMany({ where: { kelompokId: k.id }, select: { peserta: { select: { id: true, nama: true, nomor: true, status: true } } } });
    const aktif = teman.map((t) => t.peserta).filter((p) => !!p && p.status === "AKTIF");
    out.push({
      kelompokId: k.id,
      jenis: k.jenis as JenisKelompok,
      labelJenis: labelJenisKelompok(k.jenis),
      label: labelKelompok(k),
      coachNama: pakaiCoach(k.jenis) ? k.coachNama : null,
      tautan: k.tautan,
      ketuaNama: aktif.find((p) => p.id === k.ketuaPesertaId)?.nama ?? null,
      lokus: k.jenis === "STULA" ? k.lokus : null,
      kelas: pakaiCoach(k.jenis) ? k.kelas : null,
      anggota: aktif
        .filter((p) => p.id !== pesertaId)
        .sort((a, b) => a.nomor - b.nomor)
        .map((p) => p.nama),
    });
  }
  const urut = (j: string) => JENIS_KELOMPOK.findIndex((x) => x.kode === j);
  return out.sort((a, b) => urut(a.jenis) - urut(b.jenis));
}
