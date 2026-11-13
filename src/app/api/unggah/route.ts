import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { getActiveSession } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { bisaTitip, tautanUnggahTitipan } from "@/lib/server/penyimpanan";
import { buatTitipan } from "@/lib/server/titipan";
import { MAKS_TITIPAN } from "@/lib/unggah";

/**
 * Mulai unggah langsung ke Supabase Storage (lolos batas ±4,5 MB Vercel). POST { jenis, nama, tipe, ukuran } →
 * { langsung: true, url, token } — browser PUT berkas ke `url`, lalu mengirim `titipan: token` ke rute unggah biasa
 * (pemeriksaan hak dan isi tetap di sana). { langsung: false } bila Supabase tidak dikonfigurasi: pakai multipart.
 */
const skema = z.object({
  jenis: z.enum(["berkas-peserta", "tugas", "dokumen", "kunjungan"]),
  nama: z.string().min(1).max(200),
  tipe: z.string().max(120),
  ukuran: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const s = await getActiveSession();
    if (!s) throw new UnauthorizedError();
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    const maks = MAKS_TITIPAN[d.jenis];
    if (d.ukuran > maks) return fail(`Ukuran berkas maksimal ${Math.round(maks / 1024 / 1024)} MB`);
    if (!bisaTitip()) return ok({ langsung: false });
    const t = buatTitipan({ nama: d.nama, tipe: d.tipe, email: s.email, jenis: d.jenis });
    return ok({ langsung: true, url: await tautanUnggahTitipan(t.path), token: t.token });
  } catch (e) {
    return failFromError(e);
  }
}
