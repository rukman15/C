import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { BUCKET_DOKUMEN_PESERTA, hapusBerkas, tautanUnduh, unggahBerkas } from "@/lib/server/penyimpanan";
import { isiSesuaiTipe } from "@/lib/server/berkas-unggah";
import { KATEGORI_INSTANSI, labelKelompok, pakaiKelompok } from "@/lib/kelompok";
import { cocokkanLokasi, isStatusLokasi, peringatanStula } from "@/lib/stula";
import { isTanggalIsoValid } from "@/lib/sesi";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";

/**
 * Studi lapangan (EB-049, EB-050, EB-053): daftar lokasi/lokus per angkatan, advance kunjungan, penugasan lokasi ke
 * kelompok STULA (lokus kelompok ikut terisi), ketua tim balai, dan peringatan H-7. Kelola: Ketua Diklat/admin.
 */
export type KunjunganRecord = { id: string; tanggal: string; petugas: string; hasil: string | null; berkas: { nama: string; ukuran: number } | null };
export type LokasiRecord = {
  id: string;
  nama: string;
  kategori: string | null;
  alamat: string | null;
  narahubungNama: string | null;
  narahubungPonsel: string | null;
  status: string;
  catatan: string | null;
  ketuaTimPegawaiId: string | null;
  ketuaTimNama: string | null;
  kelompokId: string | null;
  kunjungan: KunjunganRecord[];
};
export type StulaRecord = {
  bolehKelola: boolean;
  mulaiStula: string | null;
  lokasi: LokasiRecord[];
  kelompok: { id: string; label: string; kategori: string | null }[];
  peringatan: string[];
  pegawai: { id: string; nama: string }[];
};

const MAKS_BERKAS = 10 * 1024 * 1024;
const TIPE_BERKAS = ["application/pdf", "image/jpeg", "image/png"];
const teks = (v: string | null | undefined, maks: number) => v?.trim().slice(0, maks) || null;

async function trainingStula(trainingId: string) {
  const t = await prisma.training.findUnique({ where: { id: trainingId }, select: { id: true, jenisPelatihan: true } });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  if (!pakaiKelompok(t.jenisPelatihan)) throw new ValidationError("Studi lapangan hanya untuk pelatihan PKA/PKP");
  return t;
}

export async function getStula(trainingId: string, bolehKelola: boolean): Promise<StulaRecord> {
  await trainingStula(trainingId);
  const [lokasi, kelompok, sesiStula, pegawai] = await Promise.all([
    prisma.lokasiStula.findMany({ where: { trainingId }, orderBy: { createdAt: "asc" }, include: { kunjungan: { orderBy: { tanggal: "asc" } } } }),
    prisma.kelompokPeserta.findMany({ where: { trainingId, jenis: "STULA" }, orderBy: { nomor: "asc" }, select: { id: true, nomor: true, nama: true, kategori: true } }),
    prisma.sesiPembelajaran.findFirst({ where: { trainingId, bentuk: "LAPANGAN" }, orderBy: { tanggal: "asc" }, select: { tanggal: true } }),
    prisma.pegawai.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);
  const rec: LokasiRecord[] = lokasi.map((l) => ({
    id: l.id,
    nama: l.nama,
    kategori: l.kategori,
    alamat: l.alamat,
    narahubungNama: l.narahubungNama,
    narahubungPonsel: l.narahubungPonsel,
    status: l.status,
    catatan: l.catatan,
    ketuaTimPegawaiId: l.ketuaTimPegawaiId,
    ketuaTimNama: l.ketuaTimNama,
    kelompokId: l.kelompokId,
    kunjungan: l.kunjungan.map((k) => ({
      id: k.id,
      tanggal: isoTanggal(k.tanggal),
      petugas: k.petugas,
      hasil: k.hasil,
      berkas: k.berkasPath && k.berkasNama ? { nama: k.berkasNama, ukuran: k.berkasUkuran ?? 0 } : null,
    })),
  }));
  const mulaiStula = sesiStula ? isoTanggal(sesiStula.tanggal) : null;
  const kel = kelompok.map((k) => ({ id: k.id, label: labelKelompok(k), kategori: k.kategori }));
  return {
    bolehKelola,
    mulaiStula,
    lokasi: rec,
    kelompok: kel,
    peringatan: peringatanStula({
      mulaiStula,
      hariIni: isoTanggal(awalHariWib()),
      kelompok: kel.map((k) => {
        const l = rec.find((x) => x.kelompokId === k.id);
        return { label: k.label, lokasi: l ? { nama: l.nama, status: l.status, ketuaTim: l.ketuaTimNama } : null };
      }),
    }),
    pegawai,
  };
}

export type IsianLokasi = {
  nama: string;
  kategori?: string | null;
  alamat?: string | null;
  narahubungNama?: string | null;
  narahubungPonsel?: string | null;
  status?: string;
  catatan?: string | null;
  ketuaTimPegawaiId?: string | null;
  ketuaTimNama?: string | null;
  kelompokId?: string | null;
};

/** Pasang/lepas lokasi ke kelompok: lokus kelompok mengikuti nama lokasi; kelompok lama dikosongkan lokusnya. */
async function tugaskan(trainingId: string, lokasiId: string, nama: string, kelompokLama: string | null, kelompokBaru: string | null) {
  if (kelompokBaru) {
    const k = await prisma.kelompokPeserta.findUnique({ where: { id: kelompokBaru }, select: { trainingId: true, jenis: true } });
    if (!k || k.trainingId !== trainingId || k.jenis !== "STULA") throw new ValidationError("Kelompok tujuan bukan kelompok studi lapangan jadwal ini");
  }
  await prisma.$transaction([
    ...(kelompokBaru ? [prisma.lokasiStula.updateMany({ where: { kelompokId: kelompokBaru, id: { not: lokasiId } }, data: { kelompokId: null } })] : []),
    ...(kelompokLama && kelompokLama !== kelompokBaru ? [prisma.kelompokPeserta.update({ where: { id: kelompokLama }, data: { lokus: null } })] : []),
    prisma.lokasiStula.update({ where: { id: lokasiId }, data: { kelompokId: kelompokBaru } }),
    ...(kelompokBaru ? [prisma.kelompokPeserta.update({ where: { id: kelompokBaru }, data: { lokus: nama } })] : []),
  ]);
}

export async function simpanLokasi(trainingId: string, id: string | null, isian: IsianLokasi, email: string): Promise<string> {
  await trainingStula(trainingId);
  const nama = teks(isian.nama, 150);
  if (!nama) throw new ValidationError("Nama lokasi wajib diisi");
  if (isian.kategori && !KATEGORI_INSTANSI.some((k) => k.kode === isian.kategori)) throw new ValidationError("Kategori tidak dikenal");
  const status = isian.status ?? "CALON";
  if (!isStatusLokasi(status)) throw new ValidationError("Status lokasi tidak dikenal");
  let ketuaTimNama = teks(isian.ketuaTimNama, 150);
  if (isian.ketuaTimPegawaiId) {
    const pg = await prisma.pegawai.findUnique({ where: { id: isian.ketuaTimPegawaiId }, select: { nama: true } });
    if (!pg) throw new ValidationError("Pegawai ketua tim tidak ditemukan");
    ketuaTimNama = pg.nama;
  }
  const data = {
    nama,
    kategori: isian.kategori || null,
    alamat: teks(isian.alamat, 300),
    narahubungNama: teks(isian.narahubungNama, 150),
    narahubungPonsel: teks(isian.narahubungPonsel, 30),
    status,
    catatan: teks(isian.catatan, 1000),
    ketuaTimPegawaiId: isian.ketuaTimPegawaiId || null,
    ketuaTimNama,
    diubahOleh: email,
  };
  let lokasiId = id;
  let kelompokLama: string | null = null;
  if (id) {
    const lama = await prisma.lokasiStula.findUnique({ where: { id }, select: { trainingId: true, kelompokId: true } });
    if (!lama || lama.trainingId !== trainingId) throw new NotFoundError("Lokasi tidak ditemukan");
    kelompokLama = lama.kelompokId;
    await prisma.lokasiStula.update({ where: { id }, data });
  } else {
    lokasiId = (await prisma.lokasiStula.create({ data: { trainingId, ...data }, select: { id: true } })).id;
  }
  if (isian.kelompokId !== undefined || kelompokLama) {
    const baru = isian.kelompokId === undefined ? kelompokLama : isian.kelompokId || null;
    await tugaskan(trainingId, lokasiId!, nama, kelompokLama, baru);
  }
  return lokasiId!;
}

export async function hapusLokasi(trainingId: string, id: string): Promise<void> {
  const l = await prisma.lokasiStula.findUnique({ where: { id }, include: { kunjungan: { select: { berkasPath: true } } } });
  if (!l || l.trainingId !== trainingId) throw new NotFoundError("Lokasi tidak ditemukan");
  await prisma.$transaction([
    ...(l.kelompokId ? [prisma.kelompokPeserta.update({ where: { id: l.kelompokId }, data: { lokus: null } })] : []),
    prisma.lokasiStula.delete({ where: { id } }),
  ]);
  for (const k of l.kunjungan) if (k.berkasPath) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, k.berkasPath).catch(() => undefined);
}

/** Cocokkan otomatis lokasi LAYAK ke kelompok stula yang belum punya lokasi (kategori sama). Hasil: jumlah dipasangkan. */
export async function cocokkanOtomatis(trainingId: string): Promise<number> {
  const s = await getStula(trainingId, true);
  const pasang = cocokkanLokasi(
    s.kelompok.map((k) => ({ id: k.id, kategori: k.kategori, adaLokasi: s.lokasi.some((l) => l.kelompokId === k.id) })),
    s.lokasi,
  );
  for (const [kelompokId, lokasiId] of pasang) await tugaskan(trainingId, lokasiId, s.lokasi.find((l) => l.id === lokasiId)!.nama, null, kelompokId);
  return pasang.size;
}

async function lokasiMilik(trainingId: string, lokasiId: string) {
  const l = await prisma.lokasiStula.findUnique({ where: { id: lokasiId }, select: { id: true, trainingId: true } });
  if (!l || l.trainingId !== trainingId) throw new NotFoundError("Lokasi tidak ditemukan");
  return l;
}

/** Catat advance kunjungan; berkas foto/PDF opsional (maks 10 MB, isi dicek). */
export async function tambahKunjungan(
  trainingId: string,
  lokasiId: string,
  isian: { tanggal: string; petugas: string; hasil?: string | null },
  berkas: { nama: string; tipe: string; isi: Uint8Array } | null,
  email: string,
): Promise<string> {
  await lokasiMilik(trainingId, lokasiId);
  if (!isTanggalIsoValid(isian.tanggal)) throw new ValidationError("Tanggal kunjungan tidak valid");
  const petugas = teks(isian.petugas, 300);
  if (!petugas) throw new ValidationError("Petugas kunjungan wajib diisi");
  let berkasData = {};
  if (berkas) {
    if (!TIPE_BERKAS.includes(berkas.tipe)) throw new ValidationError("Berkas kunjungan harus PDF, JPG, atau PNG");
    if (berkas.isi.byteLength > MAKS_BERKAS) throw new ValidationError("Ukuran berkas maksimal 10 MB");
    if (!isiSesuaiTipe(berkas.isi, berkas.tipe)) throw new ValidationError("Isi berkas tidak sesuai jenisnya");
    const eks = berkas.tipe === "application/pdf" ? "pdf" : berkas.tipe === "image/png" ? "png" : "jpg";
    const path = `stula/${trainingId}/${lokasiId}/${Date.now()}.${eks}`;
    await unggahBerkas(BUCKET_DOKUMEN_PESERTA, path, berkas.isi, berkas.tipe);
    berkasData = { berkasPath: path, berkasNama: berkas.nama.slice(0, 200), berkasTipe: berkas.tipe, berkasUkuran: berkas.isi.byteLength };
  }
  const r = await prisma.kunjunganStula.create({
    data: { lokasiId, tanggal: new Date(`${isian.tanggal}T00:00:00.000Z`), petugas, hasil: teks(isian.hasil, 2000), dicatatOleh: email, ...berkasData },
    select: { id: true },
  });
  return r.id;
}

async function kunjunganMilik(trainingId: string, id: string) {
  const k = await prisma.kunjunganStula.findUnique({ where: { id }, include: { lokasi: { select: { trainingId: true } } } });
  if (!k || k.lokasi.trainingId !== trainingId) throw new NotFoundError("Catatan kunjungan tidak ditemukan");
  return k;
}

export async function hapusKunjungan(trainingId: string, id: string): Promise<void> {
  const k = await kunjunganMilik(trainingId, id);
  await prisma.kunjunganStula.delete({ where: { id } });
  if (k.berkasPath) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, k.berkasPath).catch(() => undefined);
}

export async function tautanBerkasKunjungan(trainingId: string, id: string): Promise<string> {
  const k = await kunjunganMilik(trainingId, id);
  if (!k.berkasPath) throw new NotFoundError("Kunjungan ini tidak punya berkas");
  return tautanUnduh(BUCKET_DOKUMEN_PESERTA, k.berkasPath, k.berkasNama ?? undefined);
}
