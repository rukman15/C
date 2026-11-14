import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { buatPenugasanSementara, listPenugasanSementara } from "@/lib/server/repositories/plt";
import { JENIS_SEMENTARA, PERAN_SEMENTARA } from "@/lib/plt";
import { bacaTanggalIso } from "@/lib/tanggal";
import type { UserRole } from "@/lib/roles";

/** Plt/Plh — dikelola admin dan kepegawaian (Subbag SDM & Umum). */
export async function GET() {
  try {
    await requireRole(["kepegawaian"]);
    return ok(await listPenugasanSementara());
  } catch (e) {
    return failFromError(e);
  }
}

const tanggal = (label: string) =>
  z.string().refine((v) => bacaTanggalIso(v) !== null, `${label} tidak valid`).transform((v) => bacaTanggalIso(v) as string);

const schema = z.object({
  pegawaiId: z.string().min(1, "Pilih pegawai"),
  jenis: z.enum(JENIS_SEMENTARA),
  jabatan: z.string().trim().min(3, "Jabatan yang dirangkap wajib diisi").max(200),
  role: z.enum(PERAN_SEMENTARA as [UserRole, ...UserRole[]], { message: "Peran tidak boleh diberikan lewat Plt/Plh" }),
  nomorSk: z.string().trim().min(3, "Nomor SK wajib diisi").max(120),
  mulai: tanggal("Tanggal mulai"),
  selesai: tanggal("Tanggal selesai"),
});

export async function POST(request: Request) {
  try {
    const { role } = await requireRole(["kepegawaian"]);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const sesi = (await getActiveSession());
    return ok(
      await buatPenugasanSementara(parsed.data, {
        ...await pelakuSesi(),
        pegawaiId: sesi?.pegawaiId ?? null,
        role,
        bertindakPlt: !!sesi?.plt,
      }),
      { status: 201 },
    );
  } catch (e) {
    return failFromError(e);
  }
}
