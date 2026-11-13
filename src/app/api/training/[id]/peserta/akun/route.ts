import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { buatAkunPeserta } from "@/lib/server/repositories/peserta";
import { pesanZod } from "@/lib/data-peserta";

/**
 * Buat/tautkan akun login peserta (Ketua Diklat; admin selalu boleh). Body { pesertaIds?: string[] };
 * kosong = semua peserta aktif yang belum punya akun. Kata sandi sementara dikembalikan SEKALI.
 */
const skema = z.object({ pesertaIds: z.array(z.string().min(1)).max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await buatAkunPeserta(id, parsed.data.pesertaIds ?? null, { email: s.email, name: s.name, sebagai: s.plt?.sebagai ?? null }));
  } catch (e) {
    return failFromError(e);
  }
}
