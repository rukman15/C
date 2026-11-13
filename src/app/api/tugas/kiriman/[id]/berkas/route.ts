import { failFromError } from "@/lib/server/http";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { tautanBerkasKiriman } from "@/lib/server/repositories/tugas";

/** Buka berkas kiriman (?riwayat=<id> untuk versi lama): dialihkan ke tautan berjangka bucket privat. */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  let tujuan: string;
  try {
    tujuan = await tautanBerkasKiriman(await penggunaTugas(), id, new URL(request.url).searchParams.get("riwayat") || null);
  } catch (e) {
    return failFromError(e);
  }
  return Response.redirect(new URL(tujuan, request.url), 303);
}
