import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as timKerjaRepo from "@/lib/server/repositories/tim-kerja";

const createSchema = z.object({
  nama: z.string().min(1),
  deskripsi: z.string().optional(),
  wewenang: z.array(z.string().min(1)).optional(),
});

/**
 * Admin-only buat sekarang (kelola Tim Kerja belum jadi wewenang siapa pun
 * lain — belum ada UI ini di luar dashboard admin). Lihat
 * CATATAN-TIM-KERJA.md sumber. Port apa adanya dari Next.js — hanya cara
 * baca role yang beda (`cookies` bawaan SvelteKit, bukan parse `Request`
 * manual), logic requireRole identik.
 */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await timKerjaRepo.listTimKerja());
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const body = await parseJson<unknown>(request);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const created = await timKerjaRepo.createTimKerja(parsed.data);
    return ok(created, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
