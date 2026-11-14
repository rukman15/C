import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { NotFoundError } from "@/lib/server/errors";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { prisma } from "@/lib/server/prisma";

/**
 * Penunjukan Koordinator WI (admin). Koordinator = pegawai Widyaiswara bertanda `koordinatorWi`;
 * perannya tetap Widyaiswara. Boleh lebih dari satu.
 *   GET                              — semua WI + tanda koordinator (urutan resmi)
 *   PUT { pegawaiId, koordinator }   — tunjuk / cabut
 * Koordinator WI juga boleh MEMBACA daftar ini (halaman Aturan JP), tetapi tidak mengubahnya.
 */
const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;
const putSchema = z.object({ pegawaiId: z.string().min(1).max(64), koordinator: z.boolean() });

export type KoordinatorWiRecord = { id: string; no: number | null; nama: string; jabatan: string; koordinator: boolean };

async function daftar(): Promise<KoordinatorWiRecord[]> {
  const rows: { id: string; no: number | null; nama: string; jabatan: string | null; koordinatorWi: boolean }[] =
    await prisma.pegawai.findMany({
      where: WI_WHERE,
      select: { id: true, no: true, nama: true, jabatan: true, koordinatorWi: true },
      orderBy: { no: "asc" },
    });
  return rows.map((r) => ({ id: r.id, no: r.no, nama: r.nama, jabatan: r.jabatan ?? "", koordinator: r.koordinatorWi === true }));
}

export async function GET() {
  try {
    await requireRole(["widyaiswara"]);
    return ok(await daftar());
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(["admin"]);
    const parsed = putSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const { pegawaiId, koordinator } = parsed.data;
    const p: { id: string; nama: string; koordinatorWi: boolean } | null = await prisma.pegawai.findFirst({
      where: { id: pegawaiId, ...WI_WHERE },
      select: { id: true, nama: true, koordinatorWi: true },
    });
    if (!p) throw new NotFoundError("Widyaiswara tidak ditemukan");
    if (p.koordinatorWi !== koordinator) {
      await prisma.pegawai.update({ where: { id: pegawaiId }, data: { koordinatorWi: koordinator } });
      await catatAudit(await pelakuSesi(), AKSI_AUDIT.KOORDINATOR_WI, p.nama, koordinator ? "Ditunjuk" : "Dicabut");
    }
    return ok(await daftar());
  } catch (e) {
    return failFromError(e);
  }
}
