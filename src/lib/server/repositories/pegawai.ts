import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { PegawaiRecord } from "@/lib/server/types";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { bacaTanggalIso } from "@/lib/tanggal";

/**
 * Read-only untuk sekarang (Fase A lanjutan) — data HR dari Excel sudah
 * dimigrasi ke tabel `pegawai` di Supabase lewat `prisma/seed.ts`, tapi
 * form tambah/edit belum dibuat. Mapping ke
 * PegawaiRecord dilakukan manual (bukan `as unknown as`) supaya field
 * Date dari Prisma dikonversi ke string ISO yang aman dikirim lewat JSON.
 */
function toRecord(row: {
  id: string;
  no: number | null;
  nama: string;
  nip: string | null;
  jenisKelamin: string | null;
  jenisKepegawaian: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  pangkat: string | null;
  golRuang: string | null;
  jabatan: string | null;
  eselonIv: string | null;
  eselonIii: string | null;
  eselonIi: string | null;
  jenisJabatan: string | null;
  kelasJabatan: number | null;
  tingkatPendidikan: string | null;
  jurusan: string | null;
  namaUniversitas: string | null;
  status: string | null;
}): PegawaiRecord {
  return {
    id: row.id,
    no: row.no ?? undefined,
    nama: row.nama,
    nip: row.nip ?? undefined,
    jenisKelamin: row.jenisKelamin ?? undefined,
    jenisKepegawaian: row.jenisKepegawaian ?? undefined,
    tempatLahir: row.tempatLahir ?? undefined,
    tanggalLahir: row.tanggalLahir ? row.tanggalLahir.toISOString() : undefined,
    pangkat: row.pangkat ?? undefined,
    golRuang: row.golRuang ?? undefined,
    jabatan: row.jabatan ?? undefined,
    eselonIv: row.eselonIv ?? undefined,
    eselonIii: row.eselonIii ?? undefined,
    eselonIi: row.eselonIi ?? undefined,
    jenisJabatan: row.jenisJabatan ?? undefined,
    kelasJabatan: row.kelasJabatan ?? undefined,
    tingkatPendidikan: row.tingkatPendidikan ?? undefined,
    jurusan: row.jurusan ?? undefined,
    namaUniversitas: row.namaUniversitas ?? undefined,
    status: row.status ?? "AKTIF",
  };
}

export async function listPegawai(): Promise<PegawaiRecord[]> {
  const rows = await prisma.pegawai.findMany({ orderBy: { no: "asc" } });
  return rows.map(toRecord);
}

export async function getPegawaiById(id: string): Promise<PegawaiRecord | undefined> {
  const row = await prisma.pegawai.findUnique({ where: { id } });
  return row ? toRecord(row) : undefined;
}

export async function getPegawaiByIdOrThrow(id: string): Promise<PegawaiRecord> {
  const item = await getPegawaiById(id);
  if (!item) throw new NotFoundError(`Pegawai "${id}" tidak ditemukan`);
  return item;
}

/**
 * Field yang boleh diedit lewat dashboard admin — data HR inti saja (BUKAN
 * jpMaksimal/spesialisasi/bio, yang tetap lewat /api/wi/[id] seperti biasa,
 * supaya alur "data operasional WI" tidak dobel dengan alur ini).
 */
export type PegawaiWriteInput = Partial<{
  nama: string;
  nip: string | null;
  jenisKelamin: string | null;
  jenisKepegawaian: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null; // ISO date, atau null buat dikosongkan
  pangkat: string | null;
  golRuang: string | null;
  jabatan: string | null;
  eselonIv: string | null;
  eselonIii: string | null;
  eselonIi: string | null;
  jenisJabatan: string | null;
  kelasJabatan: number | null;
  tingkatPendidikan: string | null;
  jurusan: string | null;
  namaUniversitas: string | null;
  status: string;
}>;

function toPrismaData(input: PegawaiWriteInput) {
  const { tanggalLahir, ...rest } = input;
  if (tanggalLahir === undefined) return rest;
  // Tanggal lahir = tanggal kalender; disimpan sebagai tengah malam UTC. Teks
  // yang bukan tanggal ditolak di sini (dulu menjadi Invalid Date -> error 500).
  const iso = tanggalLahir ? bacaTanggalIso(tanggalLahir) : null;
  if (tanggalLahir && !iso) throw new ValidationError("Tanggal lahir tidak valid");
  return { ...rest, tanggalLahir: iso ? new Date(`${iso}T00:00:00.000Z`) : null };
}

export async function createPegawai(input: PegawaiWriteInput & { nama: string }): Promise<PegawaiRecord> {
  const row = await prisma.pegawai.create({ data: toPrismaData(input) as { nama: string } });
  return toRecord(row);
}

export async function updatePegawai(id: string, input: PegawaiWriteInput): Promise<PegawaiRecord> {
  await getPegawaiByIdOrThrow(id);
  const row = await prisma.pegawai.update({ where: { id }, data: toPrismaData(input) });
  return toRecord(row);
}
