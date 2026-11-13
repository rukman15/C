import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getLembarKehadiran, simpanKehadiran } from "@/lib/server/repositories/pembelajaran";
import { pesanZod, skemaSimpanKehadiran } from "@/lib/data-pembelajaran";

/**
 * Lembar kehadiran satu sesi pembelajaran.
 *  GET — peserta + status kehadirannya (Ketua Diklat, Kepala Balai; admin selalu boleh).
 *  PUT — simpan; hanya baris yang dikirim yang berubah (Ketua Diklat; admin selalu boleh).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat", "kepala-balai"]);
    return ok(await getLembarKehadiran(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaSimpanKehadiran.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await simpanKehadiran(id, parsed.data.kehadiran, s.email));
  } catch (e) {
    return failFromError(e);
  }
}
