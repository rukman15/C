import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as pegawaiRepo from "@/lib/server/repositories/pegawai";

/**
 * Data pegawai (NIP, tanggal lahir, SK, dll) adalah data HR internal, jadi
 * GET di sini WAJIB requireRole (berbeda dari /api/wi yang cukup login).
 *
 * POST (tambah pegawai baru) khusus admin — data HR utama tetap dari Excel
 * (lihat prisma/seed.ts), ini cuma buat kasus sisipan manual (mis. pegawai
 * baru sebelum sinkron Excel berikutnya). PATCH per-pegawai ada di
 * /api/pegawai/[id]/+server.ts.
 */
export async function GET() {
  try {
    await requireRole(["kepegawaian", "kepala-balai", "kabag-tu"]);
    return ok(await pegawaiRepo.listPegawai());
  } catch (e) {
    return failFromError(e);
  }
}

const createSchema = z.object({
  nama: z.string().min(1),
  nip: z.string().min(1).optional(),
  jenisKelamin: z.string().optional(),
  jenisKepegawaian: z.string().optional(),
  pangkat: z.string().optional(),
  golRuang: z.string().optional(),
  jabatan: z.string().optional(),
  jenisJabatan: z.string().optional(),
  tingkatPendidikan: z.string().optional(),
  status: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    try {
      const created = await pegawaiRepo.createPegawai(parsed.data);
      return ok(created, { status: 201 });
    } catch (e) {
      // Prisma P2002 = unique constraint (NIP dobel dengan pegawai lain)
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return fail("NIP sudah dipakai pegawai lain");
      }
      throw e;
    }
  } catch (e) {
    return failFromError(e);
  }
}
