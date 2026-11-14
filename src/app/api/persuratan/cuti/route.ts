import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { pengguna } from "@/lib/server/akses-persuratan";
import { buatSuratCuti, listCuti } from "@/lib/server/repositories/cuti";
import { skemaCuti } from "@/lib/server/skema-persuratan";

/** Cuti: pengelola melihat semua (?status=&tahun=), pegawai lain cutinya sendiri; buat surat cuti (POST, pengelola). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const p = await pengguna();
    const tahun = Number(url.searchParams.get("tahun") ?? "") || null;
    return ok(await listCuti(p, { status: url.searchParams.get("status"), tahun }));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pengguna();
    const parsed = skemaCuti.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatSuratCuti(parsed.data, p), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
