import { failFromError } from "@/lib/server/http";
import { driveAktif, kunciTautan, unduhDrive } from "@/lib/server/penyimpanan-gdrive";
import { bacaTokenBerkas } from "@/lib/server/token-berkas";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Unduh satu berkas Google Drive lewat tautan berjangka dari `tautanUnduh()` ($lib/server/penyimpanan).
 * Hak akses sudah diperiksa saat tautan dibuat (sama seperti signed URL Supabase); di sini hanya
 * tanda tangan & masa berlaku token yang diperiksa, lalu isi berkas dialirkan dari Drive.
 */
const TIDAK_SAH = () =>
  new Response("Tautan berkas tidak sah atau sudah kedaluwarsa. Buka ulang dari aplikasi.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export async function GET(_request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    // Tanpa Google Drive yang aktif tidak ada token yang bisa sah: tolak sebagai 403, bukan 503.
    if (!driveAktif()) return TIDAK_SAH();
    const isi = bacaTokenBerkas(params.token, kunciTautan());
    if (!isi) return TIDAK_SAH();
    const res = await unduhDrive(isi.id);
    const headers = new Headers({
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    if (isi.nama) headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(isi.nama)}`);
    return new Response(res.body, { headers });
  } catch (e) {
    return failFromError(e);
  }
}
