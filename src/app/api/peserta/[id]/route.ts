import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { hapusPeserta, ubahPeserta } from "@/lib/server/repositories/peserta";
import { pesanZod, skemaUbahPeserta } from "@/lib/data-peserta";

/** Ubah / hapus satu peserta (Ketua Diklat; admin selalu boleh). */
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    const parsed = skemaUbahPeserta.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await ubahPeserta(id, parsed.data);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    await hapusPeserta(id);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}
