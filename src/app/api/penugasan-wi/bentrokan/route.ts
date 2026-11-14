import { failFromError, ok } from "@/lib/server/http";
import { aksesDiklat, pembacaSemua, wajibKoordinatorAtau } from "@/lib/server/akses";
import { listBentrokan } from "@/lib/server/repositories/bentrokan";
import { ForbiddenError, ValidationError } from "@/lib/server/errors";
import { cekKandidat } from "@/lib/server/repositories/bentrok";

/** Pratinjau bentrok WI kandidat dengan diklat lain (peringatan). Hak sama dengan aplikasi lama. */
export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    // Tanpa parameter: daftar semua bentrokan (halaman Cek Bentrokan) — Ketua Diklat, Kepala Balai, Koordinator WI.
    if (!u.searchParams.get("trainingId") && !u.searchParams.get("instructorId")) {
      await wajibKoordinatorAtau(["ketua-diklat", "kepala-balai"]);
      return ok(await listBentrokan());
    }
    const a = await aksesDiklat();
    if (!pembacaSemua(a, ["kepala-balai"]) && a.tim.length === 0) throw new ForbiddenError();
    const trainingId = u.searchParams.get("trainingId") ?? "";
    const instructorId = u.searchParams.get("instructorId") ?? "";
    if (!trainingId || !instructorId) throw new ValidationError("trainingId dan instructorId wajib diisi");
    return ok(await cekKandidat(trainingId, instructorId));
  } catch (e) {
    return failFromError(e);
  }
}
