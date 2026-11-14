import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const [pegawai, akun, timKerja] = await Promise.all([
      prisma.pegawai.findMany({
        select: { id: true, nama: true, nip: true, jabatan: true },
        orderBy: { no: "asc" },
      }),
      prisma.akun.findMany({
        where: { pegawaiId: { not: null } },
        select: { pegawaiId: true, role: true },
      }),
      prisma.timKerja.findMany({
        select: {
          id: true,
          nama: true,
          anggota: { select: { pegawaiId: true, peran: true } },
        },
        orderBy: { nama: "asc" },
      }),
    ]);

    const roleByPegawai = new Map(akun.filter((a) => a.pegawaiId).map((a) => [a.pegawaiId!, a.role]));
    const timByPegawai = new Map<string, { id: string; nama: string; peran: string }[]>();
    for (const tim of timKerja) {
      for (const anggota of tim.anggota) {
        const memberships = timByPegawai.get(anggota.pegawaiId) ?? [];
        memberships.push({ id: tim.id, nama: tim.nama, peran: anggota.peran });
        timByPegawai.set(anggota.pegawaiId, memberships);
      }
    }

    return ok({
      pegawai: pegawai.map((p) => ({
        ...p,
        role: roleByPegawai.get(p.id) ?? null,
        timKerja: timByPegawai.get(p.id) ?? [],
      })),
      timKerja: timKerja.map(({ id, nama }) => ({ id, nama })),
    });
  } catch (error) {
    return failFromError(error);
  }
}
