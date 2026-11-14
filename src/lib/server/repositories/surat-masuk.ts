import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { hapusBerkas, tautanUnduh, unggahBerkas } from "@/lib/server/penyimpanan";
import { isiSesuaiTipe } from "@/lib/server/berkas-unggah";
import { isoTanggal } from "@/lib/tanggal";
import { periksaBerkasSuratMasuk, statusSuratDariDisposisi, type StatusSuratMasuk } from "@/lib/persuratan";
import { PEMBACA_SURAT_MASUK, PEMBERI_DISPOSISI, PENCATAT_SURAT_MASUK, termasuk, type Pengguna } from "@/lib/server/akses-persuratan";
import { roleProfiles } from "@/lib/roles";

/**
 * Surat masuk & disposisi (CATATAN-SURAT-MENYURAT.md). Pindaian surat disimpan di bucket PRIVAT
 * "surat-masuk"; unduhan lewat tautan bertanda tangan berumur pendek.
 */
export const BUCKET_SURAT_MASUK = "surat-masuk";

export type DisposisiRecord = {
  id: string;
  suratMasukId: string;
  dariEmail: string;
  dariJabatan: string;
  kepadaPegawaiId: string;
  kepadaNama: string;
  kepadaJabatan: string;
  instruksi: string[];
  catatan: string | null;
  batasWaktu: string | null;
  status: string;
  tindakLanjut: string | null;
  selesaiPada: string | null;
  createdAt: string;
};

export type SuratMasukRecord = {
  id: string;
  tahun: number;
  nomorAgenda: number;
  tanggalTerima: string;
  asal: string;
  nomorSurat: string;
  tanggalSurat: string | null;
  hal: string;
  sifat: string;
  keamanan: string;
  ringkasan: string | null;
  adaBerkas: boolean;
  berkasNama: string | null;
  status: StatusSuratMasuk;
  dicatatOleh: string;
  disposisi: DisposisiRecord[];
};

type BarisDisposisi = {
  id: string;
  suratMasukId: string;
  dariEmail: string;
  dariJabatan: string;
  kepadaPegawaiId: string;
  instruksi: string[];
  catatan: string | null;
  batasWaktu: Date | null;
  status: string;
  tindakLanjut: string | null;
  selesaiPada: Date | null;
  createdAt: Date;
};

type BarisSurat = {
  id: string;
  tahun: number;
  nomorAgenda: number;
  tanggalTerima: Date;
  asal: string;
  nomorSurat: string;
  tanggalSurat: Date | null;
  hal: string;
  sifat: string;
  keamanan: string;
  ringkasan: string | null;
  berkasPath: string | null;
  berkasNama: string | null;
  selesai: boolean;
  dicatatOleh: string;
  disposisi: BarisDisposisi[];
};

async function namaPegawai(ids: string[]): Promise<Map<string, { nama: string; jabatan: string }>> {
  if (!ids.length) return new Map();
  const rows: { id: string; nama: string; jabatan: string | null }[] = await prisma.pegawai.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, nama: true, jabatan: true },
  });
  return new Map(rows.map((r) => [r.id, { nama: r.nama, jabatan: r.jabatan ?? "" }]));
}

function keDisposisi(d: BarisDisposisi, nama: Map<string, { nama: string; jabatan: string }>): DisposisiRecord {
  const p = nama.get(d.kepadaPegawaiId);
  return {
    id: d.id,
    suratMasukId: d.suratMasukId,
    dariEmail: d.dariEmail,
    dariJabatan: d.dariJabatan,
    kepadaPegawaiId: d.kepadaPegawaiId,
    kepadaNama: p?.nama ?? "(pegawai tidak ditemukan)",
    kepadaJabatan: p?.jabatan ?? "",
    instruksi: d.instruksi,
    catatan: d.catatan,
    batasWaktu: d.batasWaktu ? isoTanggal(d.batasWaktu) : null,
    status: d.status,
    tindakLanjut: d.tindakLanjut,
    selesaiPada: d.selesaiPada ? d.selesaiPada.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

async function keSurat(rows: BarisSurat[]): Promise<SuratMasukRecord[]> {
  const nama = await namaPegawai(rows.flatMap((r) => r.disposisi.map((d) => d.kepadaPegawaiId)));
  return rows.map((r) => ({
    id: r.id,
    tahun: r.tahun,
    nomorAgenda: r.nomorAgenda,
    tanggalTerima: isoTanggal(r.tanggalTerima),
    asal: r.asal,
    nomorSurat: r.nomorSurat,
    tanggalSurat: r.tanggalSurat ? isoTanggal(r.tanggalSurat) : null,
    hal: r.hal,
    sifat: r.sifat,
    keamanan: r.keamanan,
    ringkasan: r.ringkasan,
    adaBerkas: !!r.berkasPath,
    berkasNama: r.berkasNama,
    status: statusSuratDariDisposisi(r.disposisi, r.selesai),
    dicatatOleh: r.dicatatOleh,
    disposisi: [...r.disposisi].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((d) => keDisposisi(d, nama)),
  }));
}

const SERTA = { disposisi: true } as const;

/** Boleh membaca surat masuk ini: pembaca/pencatat, atau penerima salah satu disposisinya. */
function bolehBaca(p: Pengguna, s: { disposisi: { kepadaPegawaiId: string }[] }) {
  return termasuk(p, PEMBACA_SURAT_MASUK) || termasuk(p, PENCATAT_SURAT_MASUK) || (!!p.pegawaiId && s.disposisi.some((d) => d.kepadaPegawaiId === p.pegawaiId));
}

export async function listSuratMasuk(p: Pengguna, tahun: number): Promise<SuratMasukRecord[]> {
  const where: Record<string, unknown> = { tahun };
  if (!termasuk(p, PEMBACA_SURAT_MASUK) && !termasuk(p, PENCATAT_SURAT_MASUK)) {
    if (!p.pegawaiId) return [];
    where.disposisi = { some: { kepadaPegawaiId: p.pegawaiId } };
  }
  const rows: BarisSurat[] = await prisma.suratMasuk.findMany({ where, include: SERTA, orderBy: { nomorAgenda: "desc" } });
  return keSurat(rows);
}

async function baris(id: string): Promise<BarisSurat> {
  const r: BarisSurat | null = await prisma.suratMasuk.findUnique({ where: { id }, include: SERTA });
  if (!r) throw new NotFoundError("Surat masuk tidak ditemukan");
  return r;
}

export async function getSuratMasuk(id: string, p: Pengguna): Promise<SuratMasukRecord> {
  const r = await baris(id);
  if (!bolehBaca(p, r)) throw new ForbiddenError();
  // Penerima disposisi membuka surat -> disposisinya ditandai "dibaca".
  if (p.pegawaiId) await prisma.disposisi.updateMany({ where: { suratMasukId: id, kepadaPegawaiId: p.pegawaiId, status: "BARU" }, data: { status: "DIBACA" } });
  return (await keSurat([await baris(id)]))[0];
}

export type SuratMasukInput = {
  tanggalTerima: string;
  asal: string;
  nomorSurat: string;
  tanggalSurat?: string | null;
  hal: string;
  sifat: string;
  keamanan: string;
  ringkasan?: string | null;
  selesai?: boolean;
};

const dataSurat = (i: SuratMasukInput) => ({
  tanggalTerima: new Date(`${i.tanggalTerima.slice(0, 10)}T00:00:00Z`),
  asal: i.asal,
  nomorSurat: i.nomorSurat,
  tanggalSurat: i.tanggalSurat ? new Date(`${i.tanggalSurat.slice(0, 10)}T00:00:00Z`) : null,
  hal: i.hal,
  sifat: i.sifat,
  keamanan: i.keamanan,
  ringkasan: i.ringkasan?.trim() || null,
});

/** Catat surat masuk; nomor agenda = urutan berikutnya pada tahun tanggal terima. */
export async function buatSuratMasuk(i: SuratMasukInput, email: string): Promise<SuratMasukRecord> {
  const tahun = Number(i.tanggalTerima.slice(0, 4));
  for (let coba = 0; coba < 3; coba++) {
    const maks: { nomorAgenda: number } | null = await prisma.suratMasuk.findFirst({ where: { tahun }, orderBy: { nomorAgenda: "desc" }, select: { nomorAgenda: true } });
    try {
      const r: BarisSurat = await prisma.suratMasuk.create({ data: { ...dataSurat(i), tahun, nomorAgenda: (maks?.nomorAgenda ?? 0) + 1, dicatatOleh: email }, include: SERTA });
      return (await keSurat([r]))[0];
    } catch (e) {
      if (kodePrisma(e) !== "P2002") throw e; // nomor agenda direbut pencatatan lain -> ulangi
    }
  }
  throw new ConflictError("Nomor agenda gagal dibuat, coba lagi.");
}

export async function ubahSuratMasuk(id: string, i: SuratMasukInput): Promise<SuratMasukRecord> {
  const lama = await baris(id);
  if (Number(i.tanggalTerima.slice(0, 4)) !== lama.tahun) throw new ValidationError("Tahun tanggal terima tidak bisa dipindah (nomor agenda per tahun)");
  await prisma.suratMasuk.update({ where: { id }, data: { ...dataSurat(i), ...(i.selesai !== undefined ? { selesai: i.selesai } : {}) } });
  return (await keSurat([await baris(id)]))[0];
}

export async function hapusSuratMasuk(id: string): Promise<void> {
  const lama = await baris(id);
  if (lama.disposisi.length) throw new ConflictError("Surat yang sudah didisposisikan tidak bisa dihapus; tandai selesai saja.");
  await prisma.suratMasuk.deleteMany({ where: { id } });
  if (lama.berkasPath) await hapusBerkas(BUCKET_SURAT_MASUK, lama.berkasPath);
}

export async function unggahPindaian(id: string, berkas: { nama: string; tipe: string; isi: Uint8Array }): Promise<SuratMasukRecord> {
  const lama = await baris(id);
  const g = periksaBerkasSuratMasuk({ tipe: berkas.tipe, ukuran: berkas.isi.byteLength });
  if (g) throw new ValidationError(g);
  if (!isiSesuaiTipe(berkas.isi, berkas.tipe)) throw new ValidationError("Isi berkas tidak sesuai formatnya (berkas rusak atau bukan PDF/JPG/PNG)");
  const ext = berkas.tipe === "application/pdf" ? "pdf" : berkas.tipe === "image/png" ? "png" : "jpg";
  const path = `${lama.tahun}/${id}-${Date.now()}.${ext}`;
  await unggahBerkas(BUCKET_SURAT_MASUK, path, berkas.isi, berkas.tipe);
  await prisma.suratMasuk.update({ where: { id }, data: { berkasPath: path, berkasNama: berkas.nama.slice(0, 200), berkasTipe: berkas.tipe } });
  if (lama.berkasPath) await hapusBerkas(BUCKET_SURAT_MASUK, lama.berkasPath);
  return (await keSurat([await baris(id)]))[0];
}

export async function tautanPindaian(id: string, p: Pengguna): Promise<string> {
  const r = await baris(id);
  if (!bolehBaca(p, r)) throw new ForbiddenError();
  if (!r.berkasPath) throw new NotFoundError("Surat ini belum punya pindaian");
  return tautanUnduh(BUCKET_SURAT_MASUK, r.berkasPath, r.berkasNama ?? undefined);
}

/** Jabatan pemberi disposisi: jabatan di Data Pegawai, atau label perannya. */
async function jabatanPengguna(p: Pengguna): Promise<string> {
  if (p.pegawaiId) {
    const r: { jabatan: string | null } | null = await prisma.pegawai.findUnique({ where: { id: p.pegawaiId }, select: { jabatan: true } });
    if (r?.jabatan?.trim()) return r.jabatan.trim();
  }
  return roleProfiles.find((x) => x.id === p.role)?.label ?? p.role;
}

/** Disposisi oleh pimpinan (PEMBERI_DISPOSISI) atau diteruskan oleh penerima disposisi surat itu. */
export async function buatDisposisi(
  suratId: string,
  i: { kepadaPegawaiIds: string[]; instruksi: string[]; catatan?: string | null; batasWaktu?: string | null },
  p: Pengguna,
): Promise<SuratMasukRecord> {
  const s = await baris(suratId);
  const penerima = !!p.pegawaiId && s.disposisi.some((d) => d.kepadaPegawaiId === p.pegawaiId);
  if (!termasuk(p, PEMBERI_DISPOSISI) && !penerima) throw new ForbiddenError("Disposisi diberikan pimpinan atau diteruskan penerima disposisi.");
  const ids = [...new Set(i.kepadaPegawaiIds)].filter((x) => x !== p.pegawaiId);
  if (!ids.length) throw new ValidationError("Pilih penerima disposisi selain diri sendiri");
  const ada = await namaPegawai(ids);
  if (ada.size !== ids.length) throw new ValidationError("Ada penerima yang tidak ditemukan");
  const dariJabatan = await jabatanPengguna(p);
  for (const kepadaPegawaiId of ids) {
    await prisma.disposisi.create({
      data: {
        suratMasukId: suratId,
        dariEmail: p.email,
        dariJabatan,
        kepadaPegawaiId,
        instruksi: i.instruksi,
        catatan: i.catatan?.trim() || null,
        batasWaktu: i.batasWaktu ? new Date(`${i.batasWaktu.slice(0, 10)}T00:00:00Z`) : null,
      },
    });
  }
  // Disposisi yang diteruskan = disposisi milik penerusnya dianggap sudah ditindaklanjuti (dibaca).
  if (penerima) await prisma.disposisi.updateMany({ where: { suratMasukId: suratId, kepadaPegawaiId: p.pegawaiId!, status: "BARU" }, data: { status: "DIBACA" } });
  return (await keSurat([await baris(suratId)]))[0];
}

/** Disposisi yang ditujukan ke pegawai ini, terbaru dulu, dengan ringkas suratnya. */
export async function disposisiSaya(pegawaiId: string): Promise<(DisposisiRecord & { surat: { id: string; nomorAgenda: number; tahun: number; asal: string; hal: string; sifat: string } })[]> {
  const rows: (BarisDisposisi & { suratMasuk: { id: string; nomorAgenda: number; tahun: number; asal: string; hal: string; sifat: string } })[] = await prisma.disposisi.findMany({
    where: { kepadaPegawaiId: pegawaiId },
    include: { suratMasuk: { select: { id: true, nomorAgenda: true, tahun: true, asal: true, hal: true, sifat: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const nama = await namaPegawai([pegawaiId]);
  return rows.map((r) => ({ ...keDisposisi(r, nama), surat: r.suratMasuk }));
}

/** Penerima menandai dibaca/selesai dengan catatan tindak lanjut. */
export async function tindakLanjutDisposisi(id: string, pegawaiId: string, i: { status: "DIBACA" | "SELESAI"; tindakLanjut?: string | null }): Promise<void> {
  const d: { kepadaPegawaiId: string; status: string } | null = await prisma.disposisi.findUnique({ where: { id }, select: { kepadaPegawaiId: true, status: true } });
  if (!d) throw new NotFoundError("Disposisi tidak ditemukan");
  if (d.kepadaPegawaiId !== pegawaiId) throw new ForbiddenError("Hanya penerima disposisi yang bisa menindaklanjuti.");
  if (i.status === "SELESAI" && !i.tindakLanjut?.trim()) throw new ValidationError("Isi catatan tindak lanjut");
  await prisma.disposisi.update({
    where: { id },
    data: { status: i.status, tindakLanjut: i.tindakLanjut?.trim() || null, selesaiPada: i.status === "SELESAI" ? new Date() : null },
  });
}

/** Data lembar disposisi (cetak A5). */
export async function lembarDisposisi(suratId: string, p: Pengguna): Promise<SuratMasukRecord> {
  return getSuratMasuk(suratId, p);
}
