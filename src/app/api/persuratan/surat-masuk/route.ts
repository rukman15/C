import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENCATAT_SURAT_MASUK, pengguna } from "@/lib/server/akses-persuratan";
import { buatSuratMasuk, listSuratMasuk } from "@/lib/server/repositories/surat-masuk";
import { skemaSuratMasuk } from "@/lib/server/skema-persuratan";
import { awalHariWib } from "@/lib/tanggal";

/** Surat masuk satu tahun (?tahun=): semua bagi TU/pimpinan, lainnya hanya yang didisposisikan kepadanya. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const p = await pengguna();
    const tahun = Number(url.searchParams.get("tahun") ?? "") || awalHariWib().getUTCFullYear();
    return ok(await listSuratMasuk(p, tahun));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pengguna(PENCATAT_SURAT_MASUK);
    const parsed = skemaSuratMasuk.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatSuratMasuk(parsed.data, p.email), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
