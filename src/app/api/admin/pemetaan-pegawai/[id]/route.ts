import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import type { UserRole } from "@/lib/roles";
import { catatAudit, pelakuSesi, AKSI_AUDIT } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

const roles = [
  "peserta",
  "pamdal",
  "keuangan",
  "kepegawaian",
  "ketua-diklat",
  "widyaiswara",
  "kepala-balai",
  "kabag-tu",
  "admin",
] as const satisfies readonly UserRole[];

const schema = z.object({
  jabatan: z.string().trim().max(200).nullable(),
  role: z.enum(roles).nullable(),
  timKerja: z
    .array(
      z.object({
        id: z.string().min(1),
        peran: z.enum(["ketua", "anggota"]),
      }),
    )
    .max(50)
    .superRefine((items, context) => {
      if (new Set(items.map((item) => item.id)).size !== items.length) {
        context.addIssue({ code: "custom", message: "Tim Kerja tidak boleh dipilih lebih dari sekali." });
      }
    }),
});

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join("; "));

    const pegawai = await prisma.pegawai.findUnique({
      where: { id: params.id },
      select: { id: true, nama: true, nip: true, jabatan: true },
    });
    if (!pegawai) return fail("Pegawai tidak ditemukan.", 404);

    const [akun, timTersedia] = await Promise.all([
      prisma.akun.findMany({ where: { pegawaiId: params.id }, select: { id: true, role: true } }),
      prisma.timKerja.findMany({
        where: { id: { in: parsed.data.timKerja.map((tim) => tim.id) } },
        select: { id: true },
      }),
    ]);
    if (akun.length > 1) return fail("Ada lebih dari satu akun yang tertaut ke pegawai ini.");
    if (akun.length === 0 && parsed.data.role !== null) {
      return fail("Pegawai ini belum memiliki akun login; role akses tidak dapat disimpan.");
    }
    if (akun.length === 1 && parsed.data.role === null) {
      return fail("Pilih role akses untuk akun pegawai ini.");
    }
    if (timTersedia.length !== parsed.data.timKerja.length) {
      return fail("Satu atau lebih Tim Kerja tidak ditemukan.");
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.pegawai.update({
          where: { id: params.id },
          data: { jabatan: parsed.data.jabatan },
        });
        if (akun[0] && parsed.data.role) {
          await tx.akun.update({
            where: { id: akun[0].id },
            data: { role: parsed.data.role },
          });
        }
        if (parsed.data.timKerja.length === 0) {
          await tx.timKerjaAnggota.deleteMany({ where: { pegawaiId: params.id } });
        } else {
          await tx.timKerjaAnggota.deleteMany({
            where: {
              pegawaiId: params.id,
              timKerjaId: { notIn: parsed.data.timKerja.map((tim) => tim.id) },
            },
          });
        }
        for (const tim of parsed.data.timKerja) {
          await tx.timKerjaAnggota.upsert({
            where: { timKerjaId_pegawaiId: { timKerjaId: tim.id, pegawaiId: params.id } },
            update: { peran: tim.peran },
            create: { timKerjaId: tim.id, pegawaiId: params.id, peran: tim.peran },
          });
        }
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    const pelaku = await pelakuSesi();
    const sasaran = `${pegawai.nama}${pegawai.nip ? ` (NIP ${pegawai.nip})` : ""}`;
    if ((pegawai.jabatan ?? null) !== (parsed.data.jabatan ?? null)) {
      await catatAudit(pelaku, AKSI_AUDIT.JABATAN_DIUBAH, sasaran, `${pegawai.jabatan ?? "-"} → ${parsed.data.jabatan ?? "-"}`);
    }
    if (akun[0] && parsed.data.role && akun[0].role !== parsed.data.role) {
      await catatAudit(pelaku, AKSI_AUDIT.PERAN_DIUBAH, sasaran, `${akun[0].role} → ${parsed.data.role}`);
    }
    return ok({ saved: true });
  } catch (error) {
    return failFromError(error);
  }
}
