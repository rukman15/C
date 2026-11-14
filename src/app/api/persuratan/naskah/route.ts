import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENYUSUN_NASKAH, pengguna } from "@/lib/server/akses-persuratan";
import { buatNaskah, listNaskah } from "@/lib/server/repositories/persuratan";
import { skemaNaskah } from "@/lib/server/skema-persuratan";

/** Daftar naskah dinas (?jenis=&tahun=&trainingId=) dan buat naskah baru. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna(PENYUSUN_NASKAH);
    const tahun = Number(url.searchParams.get("tahun") ?? "") || null;
    return ok(await listNaskah({ jenis: url.searchParams.get("jenis"), tahun, trainingId: url.searchParams.get("trainingId") }));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pengguna(PENYUSUN_NASKAH);
    const parsed = skemaNaskah.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatNaskah(parsed.data, p.email), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
