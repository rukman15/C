import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { listPeserta, tambahPeserta } from "@/lib/server/repositories/peserta";
import { pesanZod, skemaTambahPeserta } from "@/lib/data-peserta";

/**
 * Peserta satu pelatihan (sama dengan aplikasi lama): GET Ketua Diklat dan Kepala Balai; POST Ketua Diklat.
 * Admin selalu boleh.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat", "kepala-balai"]);
    return ok(await listPeserta(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    const parsed = skemaTambahPeserta.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok({ ditambah: await tambahPeserta(id, parsed.data.peserta) }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
