import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { ForbiddenError } from "@/lib/server/errors";
import { listSesi, sesiPostSchema, tambahSesi } from "@/lib/server/repositories/sesi-mengajar";

/**
 * Sesi mengajar per penugasan (sama dengan aplikasi lama): dibaca Ketua Diklat, Kepala Balai,
 * Koordinator WI; dicatat Ketua Diklat dan Koordinator WI. Admin selalu boleh.
 */
type Ctx = { params: Promise<{ id: string }> };

async function wajib(peran: string[]) {
  const a = await aksesDiklat();
  if (a.role !== "admin" && !peran.includes(a.role) && !a.koordinatorWi) throw new ForbiddenError();
  return a;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await wajib(["ketua-diklat", "kepala-balai"]);
    return ok(await listSesi(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajib(["ketua-diklat"]);
    const parsed = sesiPostSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    await tambahSesi(id, parsed.data.sesi, a.email);
    return ok({ id }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
