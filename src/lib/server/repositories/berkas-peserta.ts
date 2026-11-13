import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { BUCKET_DOKUMEN_PESERTA, hapusBerkas, tautanUnduh, unggahBerkas } from "@/lib/server/penyimpanan";
import { JENIS_BERKAS, isJenisBerkas, isiSesuaiTipeBerkas, periksaBerkasPeserta, type JenisBerkas } from "@/lib/berkas-peserta";

/**
 * Folder peserta (EB-051): bahan tayang RAP/LAP dan sertifikat self learning. Disimpan di tempat yang sama dengan dokumen
 * persyaratan (bucket privat). Peserta hanya miliknya sendiri; Ketua Diklat, Kepala Balai, dan admin membaca (pratinjau).
 */
export type PembacaFolder = { pratinjau: true } | { pratinjau: false; email: string };
export type ItemBerkas = {
  jenis: JenisBerkas;
  label: string;
  keterangan: string;
  format: readonly string[];
  berkas: { id: string; namaBerkas: string; ukuran: number; diunggahPada: string } | null;
};

type Baris = { id: string; pesertaId: string; jenis: string; path: string; namaBerkas: string; tipe: string; ukuran: number; diunggahPada: Date };

async function pesertaMilik(pesertaId: string, pembaca: PembacaFolder) {
  const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { id: true, trainingId: true, nama: true, akun: { select: { id: true, email: true } } } });
  // Milik orang lain = "tidak ditemukan" (tidak membocorkan bahwa id itu ada).
  if (!p || (!pembaca.pratinjau && p.akun?.email !== pembaca.email)) throw new NotFoundError("Data peserta tidak ditemukan");
  return p;
}

export async function getFolderBerkas(pesertaId: string, pembaca: PembacaFolder): Promise<ItemBerkas[]> {
  await pesertaMilik(pesertaId, pembaca);
  const rows: Baris[] = await prisma.berkasPeserta.findMany({ where: { pesertaId } });
  return JENIS_BERKAS.map((j) => {
    const r = rows.find((x) => x.jenis === j.kode);
    return {
      jenis: j.kode,
      label: j.label,
      keterangan: j.keterangan,
      format: j.format,
      berkas: r ? { id: r.id, namaBerkas: r.namaBerkas, ukuran: r.ukuran, diunggahPada: r.diunggahPada.toISOString() } : null,
    };
  });
}

/** Unggah atau ganti satu berkas (satu per jenis); berkas lama dibuang setelah yang baru tersimpan. */
export async function unggahBerkasPeserta(
  pesertaId: string,
  jenis: string,
  berkas: { nama: string; tipe: string; isi: Uint8Array },
  email: string,
): Promise<{ id: string; label: string }> {
  const p = await pesertaMilik(pesertaId, { pratinjau: false, email });
  if (!isJenisBerkas(jenis)) throw new ValidationError("Jenis berkas tidak dikenal");
  const cek = periksaBerkasPeserta(jenis, { nama: berkas.nama, tipe: berkas.tipe, ukuran: berkas.isi.byteLength });
  if ("galat" in cek) throw new ValidationError(cek.galat);
  if (!isiSesuaiTipeBerkas(berkas.isi, cek.tipe)) throw new ValidationError("Isi berkas tidak sesuai jenisnya. Simpan ulang berkas lalu unggah lagi.");
  const eks = berkas.nama.toLowerCase().split(".").pop() ?? "bin";
  const path = `folder/${p.trainingId}/${p.id}/${jenis.toLowerCase()}-${Date.now()}.${eks}`;
  await unggahBerkas(BUCKET_DOKUMEN_PESERTA, path, berkas.isi, cek.tipe);
  const lama: Baris | null = await prisma.berkasPeserta.findUnique({ where: { pesertaId_jenis: { pesertaId, jenis } } });
  const data = { path, namaBerkas: berkas.nama.slice(0, 200), tipe: cek.tipe, ukuran: berkas.isi.byteLength, diunggahOleh: p.akun!.id, diunggahPada: new Date() };
  const r = await prisma.berkasPeserta.upsert({ where: { pesertaId_jenis: { pesertaId, jenis } }, create: { pesertaId, jenis, ...data }, update: data, select: { id: true } });
  if (lama && lama.path !== path) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, lama.path).catch(() => undefined);
  return { id: r.id, label: JENIS_BERKAS.find((j) => j.kode === jenis)!.label };
}

export async function tautanBerkasPeserta(pesertaId: string, berkasId: string, pembaca: PembacaFolder): Promise<string> {
  await pesertaMilik(pesertaId, pembaca);
  const r: Baris | null = await prisma.berkasPeserta.findUnique({ where: { id: berkasId } });
  if (!r || r.pesertaId !== pesertaId) throw new NotFoundError("Berkas tidak ditemukan");
  return tautanUnduh(BUCKET_DOKUMEN_PESERTA, r.path, r.namaBerkas);
}

export async function hapusBerkasPeserta(pesertaId: string, berkasId: string, email: string): Promise<void> {
  await pesertaMilik(pesertaId, { pratinjau: false, email });
  const r: Baris | null = await prisma.berkasPeserta.findUnique({ where: { id: berkasId } });
  if (!r || r.pesertaId !== pesertaId) throw new NotFoundError("Berkas tidak ditemukan");
  await prisma.berkasPeserta.deleteMany({ where: { id: berkasId } });
  await hapusBerkas(BUCKET_DOKUMEN_PESERTA, r.path).catch(() => undefined);
}
