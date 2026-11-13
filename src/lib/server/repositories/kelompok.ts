import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { kunciCoachKelompok } from "@/lib/evaluasi";
import { bacaTautan } from "@/lib/sesi";
import { isStatusPeserta, type StatusPeserta } from "@/lib/peserta";
import {
  JENIS_KELOMPOK,
  JENIS_KELOMPOK_BAWAAN,
  JUMLAH_KELOMPOK_MAKS,
  bagiKelompok,
  labelJenisKelompok,
  labelKelompok,
  pakaiKelompok,
  periksaKelompok,
  type JenisKelompok,
} from "@/lib/kelompok";

/**
 * Kelompok peserta PKA/PKP per jenis kegiatan (keputusan 14 Okt 2026): e-learning &
 * pembimbingan coach (pedoman 4 kelompok @ 1 coach), studi lapangan, mandiri, seminar.
 * Satu peserta paling banyak satu kelompok per jenis (tabel `anggota_kelompok`).
 * Coach hanya untuk jenis ELEARNING (sasaran evaluasi Formulir 20).
 * Kelola: Ketua Diklat/admin; lihat: Kepala Balai, Kabag TU; peserta melihat
 * kelompoknya sendiri di ruang belajar.
 * (`peserta.kelompokId` usang — tidak dibaca/ditulis lagi.)
 */

export type AnggotaKelompok = { id: string; nomor: number; nama: string; instansi: string | null; status: StatusPeserta };
export type KelompokItem = {
  id: string;
  nomor: number;
  nama: string | null;
  label: string;
  coachNama: string | null;
  coachPegawaiId: string | null;
  tautan: string | null;
  anggota: AnggotaKelompok[];
};
export type KelompokRecord = {
  training: { id: string; name: string; jenisPelatihan: string | null };
  bolehKelola: boolean;
  jenis: JenisKelompok;
  /** Semua jenis + jumlah kelompoknya (untuk tab jenis). */
  daftarJenis: { kode: JenisKelompok; label: string; pedoman: number | null; jumlah: number }[];
  /** Jumlah kelompok menurut Pedoman untuk jenis ini; null = bebas. */
  pedoman: number | null;
  /** Coach hanya untuk kelompok e-learning & pembimbingan. */
  pakaiCoach: boolean;
  kelompok: KelompokItem[];
  /** Peserta AKTIF yang belum masuk kelompok jenis ini. */
  tanpaKelompok: AnggotaKelompok[];
  peringatan: string[];
  /** WI yang penugasannya disetujui pada jadwal ini — pilihan coach. */
  wi: { id: string; nama: string }[];
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
};
type PesertaRow = { id: string; nomor: number; nama: string; instansi: string | null; status: string };

const pakaiCoach = (jenis: string) => jenis === "ELEARNING";

async function trainingKelompok(trainingId: string) {
  const t: { id: string; name: string; jenisPelatihan: string | null } | null = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true, name: true, jenisPelatihan: true },
  });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  if (!pakaiKelompok(t.jenisPelatihan)) throw new ValidationError("Kelompok hanya untuk pelatihan PKA/PKP");
  return t;
}

const kelompokJadwal = async (trainingId: string, jenis: JenisKelompok): Promise<KelompokRow[]> =>
  prisma.kelompokPeserta.findMany({ where: { trainingId, jenis }, orderBy: { nomor: "asc" } });

const anggotaDari = (p: PesertaRow): AnggotaKelompok => ({
  id: p.id,
  nomor: p.nomor,
  nama: p.nama,
  instansi: p.instansi,
  status: (isStatusPeserta(p.status) ? p.status : "AKTIF") as StatusPeserta,
});

const SELECT_PESERTA = { id: true, nomor: true, nama: true, instansi: true, status: true } as const;

export async function getKelompok(trainingId: string, bolehKelola: boolean, jenis: JenisKelompok = JENIS_KELOMPOK_BAWAAN): Promise<KelompokRecord> {
  const t = await trainingKelompok(trainingId);
  const [semua, peserta]: [KelompokRow[], PesertaRow[]] = await Promise.all([
    prisma.kelompokPeserta.findMany({ where: { trainingId }, orderBy: { nomor: "asc" } }),
    prisma.peserta.findMany({ where: { trainingId }, orderBy: { nomor: "asc" }, select: SELECT_PESERTA }),
  ]);
  const kel = semua.filter((k) => k.jenis === jenis);
  const anggota: { kelompokId: string; pesertaId: string }[] = kel.length
    ? await prisma.anggotaKelompok.findMany({ where: { kelompokId: { in: kel.map((k) => k.id) } }, select: { kelompokId: true, pesertaId: true } })
    : [];
  const kelompokDari = new Map(anggota.map((a) => [a.pesertaId, a.kelompokId]));

  const pen: { instructorId: string; instructor: { nama: string } | null }[] = await prisma.penugasanApproval.findMany({
    where: { trainingId, status: "disetujui" },
    select: { instructorId: true, instructor: { select: { nama: true } } },
  });
  const wi = new Map<string, string>();
  for (const p of pen) wi.set(p.instructorId, p.instructor?.nama ?? "(Widyaiswara)");

  const kelompok = kel.map((k) => ({
    id: k.id,
    nomor: k.nomor,
    nama: k.nama,
    label: labelKelompok(k),
    coachNama: k.coachNama,
    coachPegawaiId: k.coachPegawaiId,
    tautan: k.tautan,
    anggota: peserta.filter((p) => kelompokDari.get(p.id) === k.id).map(anggotaDari),
  }));
  const tanpaKelompok = peserta.filter((p) => p.status === "AKTIF" && !kelompokDari.has(p.id)).map(anggotaDari);
  const pedoman = JENIS_KELOMPOK.find((j) => j.kode === jenis)?.pedoman ?? null;
  return {
    training: t,
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
    const dinilai: number = await prisma.evaluasiPengajar.count({ where: { sasaranKunci: { in: lebih.map(kunciCoachKelompok) } } });
    if (dinilai) throw new ConflictError(`Coach kelompok yang akan dihapus sudah dievaluasi ${dinilai} peserta — kelompok tidak bisa dikurangi`);
    await prisma.anggotaKelompok.deleteMany({ where: { kelompokId: { in: lebih } } });
    await prisma.kelompokPeserta.deleteMany({ where: { id: { in: lebih } } });
  }
  const ada = new Set(kel.map((k) => k.nomor));
  for (let n = 1; n <= jumlah; n++) if (!ada.has(n)) await prisma.kelompokPeserta.create({ data: { trainingId, jenis, nomor: n } });
}

/** Bagi ulang SEMUA peserta aktif ke `jumlah` kelompok jenis ini (merata, instansi disebar). */
export async function bagiOtomatis(trainingId: string, jenis: JenisKelompok, jumlah: number): Promise<number> {
  await aturJumlah(trainingId, jenis, jumlah);
  const kel = await kelompokJadwal(trainingId, jenis);
  const perNomor = new Map(kel.map((k) => [k.nomor, k.id]));
  const aktif: PesertaRow[] = await prisma.peserta.findMany({ where: { trainingId, status: "AKTIF" }, select: SELECT_PESERTA });
  const bagi = bagiKelompok(aktif, jumlah);
  await prisma.$transaction([
    prisma.anggotaKelompok.deleteMany({ where: { kelompokId: { in: kel.map((k) => k.id) } } }),
    ...aktif.map((p) => prisma.anggotaKelompok.create({ data: { kelompokId: perNomor.get(bagi.get(p.id)!)!, pesertaId: p.id, jenis } })),
  ]);
  return aktif.length;
}

async function kelompokMilik(trainingId: string, id: string): Promise<KelompokRow> {
  const k: KelompokRow | null = await prisma.kelompokPeserta.findUnique({ where: { id } });
  if (!k || k.trainingId !== trainingId) throw new NotFoundError("Kelompok tidak ditemukan");
  return k;
}

export async function ubahKelompok(
  trainingId: string,
  id: string,
  input: { nama?: string | null; coachNama?: string | null; coachPegawaiId?: string | null; tautan?: string | null },
): Promise<string> {
  await trainingKelompok(trainingId);
  const k = await kelompokMilik(trainingId, id);
  let coachNama = pakaiCoach(k.jenis) ? input.coachNama?.trim() || null : null;
  const coachPegawaiId = pakaiCoach(k.jenis) ? input.coachPegawaiId || null : null;
  if (coachPegawaiId) {
    const pg: { nama: string } | null = await prisma.pegawai.findUnique({ where: { id: coachPegawaiId }, select: { nama: true } });
    if (!pg) throw new ValidationError("Pegawai coach tidak ditemukan");
    coachNama ??= pg.nama;
  }
  // Isian evaluasi coach menempel ke kelompok: coach yang sudah dievaluasi tidak boleh diganti orangnya.
  if ((coachNama ?? null) !== (k.coachNama ?? null) || coachPegawaiId !== (k.coachPegawaiId ?? null)) {
    const dinilai: number = await prisma.evaluasiPengajar.count({ where: { sasaranKunci: kunciCoachKelompok(id) } });
    if (dinilai) throw new ConflictError(`Coach ${labelKelompok(k)} sudah dievaluasi ${dinilai} peserta — tidak bisa diganti`);
  }
  const tautan = bacaTautan(input.tautan);
  if (tautan === undefined) throw new ValidationError("Tautan harus alamat web lengkap (https://…)");
  await prisma.kelompokPeserta.update({ where: { id }, data: { nama: input.nama?.trim() || null, coachNama, coachPegawaiId, tautan } });
  return labelKelompok(k);
}

/** Pindahkan satu peserta ke kelompok lain jenis ini (null = keluarkan dari kelompok jenis ini). */
export async function pindahPeserta(trainingId: string, jenis: JenisKelompok, pesertaId: string, kelompokId: string | null): Promise<void> {
  await trainingKelompok(trainingId);
  const p: { trainingId: string } | null = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true } });
  if (!p || p.trainingId !== trainingId) throw new NotFoundError("Peserta tidak ditemukan");
  if (kelompokId) {
    const k = await kelompokMilik(trainingId, kelompokId);
    if (k.jenis !== jenis) throw new ValidationError("Kelompok tujuan bukan jenis kegiatan yang sama");
  }
  await prisma.$transaction([
    prisma.anggotaKelompok.deleteMany({ where: { pesertaId, jenis } }),
    ...(kelompokId ? [prisma.anggotaKelompok.create({ data: { kelompokId, pesertaId, jenis } })] : []),
  ]);
}

/** Kelompok e-learning (coach) seorang peserta — untuk membatasi evaluasi coach. */
export async function kelompokElearningPeserta(pesertaId: string): Promise<string | null> {
  const a: { kelompokId: string } | null = await prisma.anggotaKelompok.findUnique({
    where: { pesertaId_jenis: { pesertaId, jenis: "ELEARNING" } },
    select: { kelompokId: true },
  });
  return a?.kelompokId ?? null;
}

export type KelompokPesertaRecord = {
  /** kelompok_peserta.id — jenis ELEARNING membuka Ruang Coaching (/dashboard/coaching/[id]). */
  kelompokId: string;
  jenis: JenisKelompok;
  labelJenis: string;
  label: string;
  coachNama: string | null;
  tautan: string | null;
  /** Teman sekelompok yang aktif (tanpa dirinya). */
  anggota: string[];
};

/** Semua kelompok seorang peserta (per jenis) untuk ruang belajarnya. */
export async function kelompokUntukPeserta(pesertaId: string): Promise<KelompokPesertaRecord[]> {
  const milik: { kelompokId: string }[] = await prisma.anggotaKelompok.findMany({ where: { pesertaId }, select: { kelompokId: true } });
  const out: KelompokPesertaRecord[] = [];
  for (const m of milik) {
    const k: KelompokRow | null = await prisma.kelompokPeserta.findUnique({ where: { id: m.kelompokId } });
    if (!k) continue;
    const teman: { peserta: { id: string; nama: string; nomor: number; status: string } | null }[] = await prisma.anggotaKelompok.findMany({
      where: { kelompokId: k.id },
      select: { peserta: { select: { id: true, nama: true, nomor: true, status: true } } },
    });
    out.push({
      kelompokId: k.id,
      jenis: k.jenis as JenisKelompok,
      labelJenis: labelJenisKelompok(k.jenis),
      label: labelKelompok(k),
      coachNama: pakaiCoach(k.jenis) ? k.coachNama : null,
      tautan: k.tautan,
      anggota: teman
        .map((t) => t.peserta)
        .filter((p): p is { id: string; nama: string; nomor: number; status: string } => !!p && p.status === "AKTIF" && p.id !== pesertaId)
        .sort((a, b) => a.nomor - b.nomor)
        .map((p) => p.nama),
    });
  }
  const urut = (j: string) => JENIS_KELOMPOK.findIndex((x) => x.kode === j);
  return out.sort((a, b) => urut(a.jenis) - urut(b.jenis));
}
