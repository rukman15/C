import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PEMBACA_SPD, PEMBUAT_SPD, pengguna } from "@/lib/server/akses-persuratan";
import { buatSpdSemua, setSpd, type SumberSpd } from "@/lib/server/repositories/spd";
import { skemaBuatSpd } from "@/lib/server/skema-persuratan";

const isSumber = (v: unknown): v is SumberSpd => v === "naskah" || v === "surat-tugas";

/** SPD satu surat tugas: ?sumber=naskah|surat-tugas&sumberId=… (GET); buat untuk semua penerima (POST). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna(PEMBACA_SPD);
    const sumber = url.searchParams.get("sumber");
    const sumberId = url.searchParams.get("sumberId") ?? "";
    if (!isSumber(sumber) || !sumberId) return fail("Pilih surat tugas");
    return ok(await setSpd(sumber, sumberId));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pengguna(PEMBUAT_SPD);
    const parsed = skemaBuatSpd.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await buatSpdSemua(parsed.data.sumber, parsed.data.sumberId, p.email), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
