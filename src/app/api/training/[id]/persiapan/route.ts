import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod, skemaSimpanPemantauan } from "@/lib/server/skema-lms";
import { wajibBacaFormulir, wajibKelolaFormulir } from "@/lib/server/akses";
import { getPemantauan, simpanPemantauan } from "@/lib/server/repositories/formulir-penyelenggaraan";

/** Formulir 2 — Daftar Pemantauan Persiapan (sama dengan aplikasi lama). GET: penyelenggara & pimpinan. PUT { isian }: penyelenggara. */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await wajibBacaFormulir(id);
    return ok(await getPemantauan(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaFormulir(id);
    const parsed = skemaSimpanPemantauan.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await simpanPemantauan(id, parsed.data.isian, a.email));
  } catch (e) {
    return failFromError(e);
  }
}
