import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as pegawaiRepo from "@/lib/server/repositories/pegawai";
import { bacaTanggalIso } from "@/lib/tanggal";
import { catatAudit, pelakuSesi, AKSI_AUDIT } from "@/lib/server/audit";
import { tutupAksesPegawai } from "@/lib/server/repositories/akun-admin";
import { statusMenutupAkun } from "@/lib/plt";

type Ctx = { params: Promise<{ id: string }> };

// Data HR inti saja — jpMaksimal/spesialisasi/bio tetap lewat /api/wi/[id].
const patchSchema = z.object({
  nama: z.string().min(1).optional(),
  nip: z.string().min(1).nullable().optional(),
  jenisKelamin: z.string().nullable().optional(),
  jenisKepegawaian: z.string().nullable().optional(),
  tempatLahir: z.string().nullable().optional(),
  // "YYYY-MM-DD"; null/"" = dikosongkan. Dulu teks apa pun lolos dan berakhir
  // sebagai error 500 dari Prisma (Invalid Date).
  tanggalLahir: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || bacaTanggalIso(v) !== null, "Tanggal lahir tidak valid"),
  pangkat: z.string().nullable().optional(),
  golRuang: z.string().nullable().optional(),
  jabatan: z.string().nullable().optional(),
  eselonIv: z.string().nullable().optional(),
  eselonIii: z.string().nullable().optional(),
  eselonIi: z.string().nullable().optional(),
  jenisJabatan: z.string().nullable().optional(),
  kelasJabatan: z.number().int().nullable().optional(),
  tingkatPendidikan: z.string().nullable().optional(),
  jurusan: z.string().nullable().optional(),
  namaUniversitas: z.string().nullable().optional(),
  status: z.string().optional(),
});

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["kepegawaian", "kepala-balai", "kabag-tu"]);
    return ok(await pegawaiRepo.getPegawaiByIdOrThrow(params.id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    try {
      const lama = await pegawaiRepo.getPegawaiByIdOrThrow(params.id);
      const baru = await pegawaiRepo.updatePegawai(params.id, parsed.data);
      const pelaku = await pelakuSesi();
      const sasaran = `${baru.nama}${baru.nip ? ` (NIP ${baru.nip})` : ""}`;
      if (parsed.data.status !== undefined && parsed.data.status !== lama.status) {
        await catatAudit(pelaku, AKSI_AUDIT.STATUS_PEGAWAI, sasaran, `${lama.status} → ${baru.status}`);
      }
      if (parsed.data.jabatan !== undefined && (parsed.data.jabatan ?? null) !== (lama.jabatan ?? null)) {
        await catatAudit(pelaku, AKSI_AUDIT.JABATAN_DIUBAH, sasaran, `${lama.jabatan ?? "-"} → ${baru.jabatan ?? "-"}`);
      }
      // Pindah/pensiun/berhenti/nonaktif: tutup akun & cabut Plt/Plh-nya.
      if (statusMenutupAkun(baru.status)) await tutupAksesPegawai(params.id, baru.status, pelaku);
      return ok(baru);
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
