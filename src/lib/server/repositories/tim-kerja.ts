import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { TimKerjaRecord, TimKerjaAnggotaRecord } from "@/lib/server/types";
import { ConflictError, NotFoundError } from "@/lib/server/errors";

/**
 * Port dari server/repositories/tim-kerja.ts (Next.js). Logic IDENTIK —
 * hanya path import (`@/server/db/prisma` → `@/lib/server/prisma`,
 * `@/server/types` → `@/lib/server/types`, `@/server/errors` →
 * `@/lib/server/errors`) yang disesuaikan ke alias SvelteKit. Lihat
 * CATATAN-TIM-KERJA.md sumber untuk detail keputusan desain (satu pegawai
 * boleh multi-tim, keanggotaan manual admin-only, wewenang ketua vs anggota
 * belum dibedakan, `wewenang` general-purpose string[] bebas isi).
 */

type TimKerjaRow = {
  id: string;
  nama: string;
  deskripsi: string | null;
  wewenang: string[];
  anggota: {
    id: string;
    peran: string;
    pegawai: { id: string; nama: string; jabatan: string | null };
  }[];
};

const INCLUDE_ANGGOTA = {
  anggota: {
    include: { pegawai: { select: { id: true, nama: true, jabatan: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

function toRecord(row: TimKerjaRow): TimKerjaRecord {
  return {
    id: row.id,
    nama: row.nama,
    deskripsi: row.deskripsi ?? undefined,
    wewenang: row.wewenang,
    anggota: row.anggota.map(
      (a): TimKerjaAnggotaRecord => ({
        id: a.id,
        pegawaiId: a.pegawai.id,
        pegawaiNama: a.pegawai.nama,
        pegawaiJabatan: a.pegawai.jabatan ?? undefined,
        peran: a.peran === "ketua" ? "ketua" : "anggota",
      }),
    ),
  };
}

export async function listTimKerja(): Promise<TimKerjaRecord[]> {
  const rows = await prisma.timKerja.findMany({
    include: INCLUDE_ANGGOTA,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}

export async function getTimKerjaByIdOrThrow(id: string): Promise<TimKerjaRecord> {
  const row = await prisma.timKerja.findUnique({ where: { id }, include: INCLUDE_ANGGOTA });
  if (!row) throw new NotFoundError(`Tim kerja "${id}" tidak ditemukan`);
  return toRecord(row);
}

export async function createTimKerja(input: {
  nama: string;
  deskripsi?: string;
  wewenang?: string[];
}): Promise<TimKerjaRecord> {
  const row = await prisma.timKerja.create({
    data: {
      nama: input.nama,
      deskripsi: input.deskripsi,
      wewenang: input.wewenang ?? [],
    },
    include: INCLUDE_ANGGOTA,
  });
  return toRecord(row);
}

export async function updateTimKerja(
  id: string,
  patch: { nama?: string; deskripsi?: string; wewenang?: string[] },
): Promise<TimKerjaRecord> {
  try {
    const row = await prisma.timKerja.update({
      where: { id },
      data: patch,
      include: INCLUDE_ANGGOTA,
    });
    return toRecord(row);
  } catch (e: any) {
    if (e.code === "P2025") throw new NotFoundError(`Tim kerja "${id}" tidak ditemukan`);
    throw e;
  }
}

export async function deleteTimKerja(id: string): Promise<void> {
  try {
    // onDelete: Cascade di schema (relasi TimKerjaAnggota.timKerja) — anggota
    // ikut kehapus otomatis, nggak perlu dibersihin manual di sini.
    await prisma.timKerja.delete({ where: { id } });
  } catch (e: any) {
    if (e.code === "P2025") throw new NotFoundError(`Tim kerja "${id}" tidak ditemukan`);
    throw e;
  }
}

/**
 * Tambah satu pegawai ke satu tim. `@@unique([timKerjaId, pegawaiId])` di
 * schema jadi guard asli terhadap dobel keanggotaan di tim yang SAMA — satu
 * pegawai tetap boleh gabung tim LAIN tanpa batas (keputusan diskusi: satu
 * pegawai boleh jadi anggota lebih dari satu tim kerja sekaligus).
 */
export async function addAnggota(
  timKerjaId: string,
  input: { pegawaiId: string; peran?: "ketua" | "anggota" },
): Promise<TimKerjaRecord> {
  const tim = await prisma.timKerja.findUnique({ where: { id: timKerjaId } });
  if (!tim) throw new NotFoundError(`Tim kerja "${timKerjaId}" tidak ditemukan`);
  const pegawai = await prisma.pegawai.findUnique({ where: { id: input.pegawaiId } });
  if (!pegawai) throw new NotFoundError(`Pegawai "${input.pegawaiId}" tidak ditemukan`);

  try {
    await prisma.timKerjaAnggota.create({
      data: {
        timKerjaId,
        pegawaiId: input.pegawaiId,
        peran: input.peran ?? "anggota",
      },
    });
  } catch (e: any) {
    if (e.code === "P2002") {
      throw new ConflictError(`${pegawai.nama} sudah jadi anggota tim ini`);
    }
    throw e;
  }
  return getTimKerjaByIdOrThrow(timKerjaId);
}

export async function updateAnggotaPeran(
  timKerjaId: string,
  pegawaiId: string,
  peran: "ketua" | "anggota",
): Promise<TimKerjaRecord> {
  const result = await prisma.timKerjaAnggota.updateMany({
    where: { timKerjaId, pegawaiId },
    data: { peran },
  });
  if (result.count === 0) {
    throw new NotFoundError("Keanggotaan tidak ditemukan di tim ini");
  }
  return getTimKerjaByIdOrThrow(timKerjaId);
}

export async function removeAnggota(timKerjaId: string, pegawaiId: string): Promise<TimKerjaRecord> {
  const result = await prisma.timKerjaAnggota.deleteMany({ where: { timKerjaId, pegawaiId } });
  if (result.count === 0) {
    throw new NotFoundError("Keanggotaan tidak ditemukan di tim ini");
  }
  return getTimKerjaByIdOrThrow(timKerjaId);
}

/**
 * Wewenang efektif satu pegawai dari SEMUA tim kerja yang dia ikutin,
 * digabung jadi satu set unik. BELUM bedain ketua vs anggota (lihat catatan
 * di schema.prisma model TimKerjaAnggota) — union rata dulu sampai ada
 * keputusan lanjutan soal wewenang mana yang khusus ketua.
 *
 * Belum dipanggil dari `requireRole()`/route mana pun — ini fondasi buat
 * langkah migrasi berikutnya (lihat CATATAN-TIM-KERJA.md sumber), BUKAN
 * enforcement yang sudah aktif. Port apa adanya: jangan "sekalian"
 * dikaitkan ke requireRole di sesi ini.
 */
export async function getWewenangPegawai(pegawaiId: string): Promise<string[]> {
  const rows = await prisma.timKerjaAnggota.findMany({
    where: { pegawaiId },
    include: { timKerja: { select: { wewenang: true } } },
  });
  const set = new Set<string>();
  for (const row of rows) {
    for (const w of row.timKerja.wewenang) set.add(w);
  }
  return [...set];
}

export async function getTimKerjaUntukPegawai(
  pegawaiId: string,
): Promise<{ id: string; nama: string; peran: "ketua" | "anggota"; wewenang: string[] }[]> {
  const rows = await prisma.timKerjaAnggota.findMany({
    where: { pegawaiId },
    include: { timKerja: { select: { id: true, nama: true, wewenang: true } } },
  });
  return rows.map((row) => ({
    id: row.timKerja.id,
    nama: row.timKerja.nama,
    peran: row.peran === "ketua" ? "ketua" : "anggota",
    wewenang: row.timKerja.wewenang,
  }));
}
