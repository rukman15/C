import "server-only";
import { prisma } from "@/lib/server/prisma";
import { WEWENANG_TUGASKAN_WI, type TimDiklat } from "@/lib/tim-kerja";

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
