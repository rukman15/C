import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { getMentorSaya, usulkanMentor } from "@/lib/server/repositories/penugasan-angkatan";
import { catatAktivitasPeserta } from "@/lib/server/aktivitas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Mentor saya (keputusan Hamzah 5 Nov 2026): peserta mengusulkan mentornya; penyelenggara menyetujui di
 * tab "Penugasan" Rincian Diklat. Hanya peserta pemilik ruang belajar ini.
 *  GET  — status mentor (belum ada / usulan / disetujui / ditolak).
 *  POST — usulkan atau perbaiki usulan { nama, jabatan, instansi?, email?, ponsel? }.
 */
const skema = z.object({
  nama: z.string().max(120),
  jabatan: z.string().max(160),
  instansi: z.string().max(160).optional(),
  email: z.string().max(160).optional(),
  ponsel: z.string().max(30).optional(),
});

export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["peserta"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    return ok(await getMentorSaya(params.id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await requireRole(["peserta"]);
    const s = (await getActiveSession());
    if (!s) throw new UnauthorizedError();
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await usulkanMentor(params.id, parsed.data, s.email);
    await catatAktivitasPeserta(params.id, { aktor: s, jenis: "MENTOR_DIUSULKAN", objekTipe: "penugasan", ringkasan: (nama) => `${nama} mengusulkan mentor` });
    return ok(await getMentorSaya(params.id, s.email));
  } catch (e) {
    return failFromError(e);
  }
}
