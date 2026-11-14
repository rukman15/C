import { ok, failFromError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { aksesDiklat } from "@/lib/server/akses";
import { ForbiddenError } from "@/lib/server/errors";
import { WEWENANG_TUGASKAN_WI } from "@/lib/tim-kerja";

/**
 * Pilihan "Tim kerja pemegang" di form jadwal diklat (tahap B).
 *  - Ketua Diklat/admin: semua tim berwenang "tugaskan-wi" (boleh juga tanpa tim).
 *  - Anggota tim: hanya timnya sendiri (wajib memilih salah satu).
 */
export async function GET() {
  try {
    const a = await aksesDiklat();
    if (!a.global && a.tim.length === 0) throw new ForbiddenError();
    if (!a.global) return ok({ global: false, tim: a.tim });
    const tim = await prisma.timKerja.findMany({
      where: { wewenang: { has: WEWENANG_TUGASKAN_WI } },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    });
    return ok({ global: true, tim });
  } catch (e) {
    return failFromError(e);
  }
}
