import "server-only";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/auth";
import { ForbiddenError, NotFoundError } from "@/lib/server/errors";
import { WEWENANG_TUGASKAN_WI, bolehKelolaDiklat, kelolaGlobal, type TimDiklat } from "@/lib/tim-kerja";
import type { UserRole } from "@/lib/roles";

/**
 * Hak atas jadwal diklat (sama dengan akses-diklat.ts aplikasi lama): peran (admin, Ketua Diklat =
 * semua diklat) DITAMBAH keanggotaan tim berwenang "tugaskan-wi" (= diklat milik timnya saja).
 */
export type AksesDiklat = {
  role: UserRole;
  email: string;
  name: string;
  pegawaiId: string | null;
  global: boolean;
  tim: TimDiklat[];
  timIds: string[];
  koordinatorWi: boolean;
  wewenang: string[];
};

/** Melempar 401/403 lewat requireRole (sesi tidak sah / sandi sementara). */
export async function aksesDiklat(): Promise<AksesDiklat> {
  const s = await requireRole([]);
  const [tim, koordinatorWi, wewenang] = await Promise.all([timDiklatPegawai(s.pegawaiId), koordinatorWiPegawai(s.pegawaiId), wewenangPegawai(s.pegawaiId)]);
  return {
    role: s.role,
    email: s.email,
    name: s.name,
    pegawaiId: s.pegawaiId ?? null,
    global: kelolaGlobal(s.role),
    tim,
    timIds: tim.map((t) => t.id),
    koordinatorWi,
    wewenang,
  };
}

/** Boleh MEMBACA semua diklat (tanpa mengubah). Koordinator WI & Admin Penyelenggara selalu boleh. */
export function pembacaSemua(a: AksesDiklat, peran: UserRole[]): boolean {
  return a.global || a.koordinatorWi || a.wewenang.length > 0 || peran.includes(a.role);
}

/** Wajib boleh mengelola satu jadwal diklat. Mengembalikan timKerjaId jadwal itu. */
export async function wajibKelolaTraining(a: AksesDiklat, trainingId: string): Promise<string | null> {
  const t = await prisma.training.findUnique({ where: { id: trainingId }, select: { timKerjaId: true } });
  if (!t) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  if (!bolehKelolaDiklat(a, t.timKerjaId)) throw new ForbiddenError("Jadwal diklat ini bukan milik tim kerja Anda.");
  return t.timKerjaId ?? null;
}

/** Pilihan tim pemegang di form jadwal: semua tim berwenang (pengelola global) atau timnya sendiri. */
export async function pilihanTimDiklatAkses(a: AksesDiklat): Promise<TimDiklat[]> {
  if (!a.global) return a.tim;
  return prisma.timKerja.findMany({ where: { wewenang: { has: WEWENANG_TUGASKAN_WI } }, select: { id: true, nama: true }, orderBy: { nama: "asc" } });
}

/** Sama seperti `wajibKelolaTraining`, tetapi true/false. */
export async function bolehKelolaTraining(a: AksesDiklat, trainingId: string): Promise<boolean> {
  try {
    await wajibKelolaTraining(a, trainingId);
    return true;
  } catch (e) {
    if (e instanceof ForbiddenError) return false;
    throw e;
  }
}

/**
 * Keanggotaan yang menentukan menu, dibaca ulang tiap permintaan (bukan dari isi sesi).
 * Diambil dari aplikasi lama: akses-diklat.ts, repositories/tim-kerja.ts,
 * repositories/wewenang-penyelenggara.ts.
 */

const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;

/** Koordinator WI = pegawai Widyaiswara yang ditandai admin (`pegawai.koordinatorWi`). */
export async function koordinatorWiPegawai(pegawaiId: string | null | undefined): Promise<boolean> {
  if (!pegawaiId) return false;
  const r = await prisma.pegawai.findFirst({
    where: { id: pegawaiId, koordinatorWi: true, ...WI_WHERE },
    select: { id: true },
  });
  return r !== null;
}

/** Tim kerja berwenang "tugaskan-wi" milik pegawai ini (urut nama). */
export async function timDiklatPegawai(pegawaiId: string | null | undefined): Promise<TimDiklat[]> {
  if (!pegawaiId) return [];
  const rows = await prisma.timKerjaAnggota.findMany({
    where: { pegawaiId },
    include: { timKerja: { select: { id: true, nama: true, wewenang: true } } },
  });
  return rows
    .filter((r) => r.timKerja.wewenang.includes(WEWENANG_TUGASKAN_WI))
    .map((r) => ({ id: r.timKerja.id, nama: r.timKerja.nama }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/**
 * Wewenang Admin Penyelenggara (EB-034). Tabel belum ada (P2021, migrasi belum dijalankan)
 * = tanpa wewenang, supaya jalur sesi tidak jatuh.
 */
export async function wewenangPegawai(pegawaiId: string | null | undefined): Promise<string[]> {
  if (!pegawaiId) return [];
  try {
    const r = await prisma.wewenangPenyelenggara.findUnique({ where: { pegawaiId }, select: { wewenang: true } });
    return r?.wewenang ?? [];
  } catch (e) {
    if ((e as { code?: string })?.code === "P2021") return [];
    throw e;
  }
}
