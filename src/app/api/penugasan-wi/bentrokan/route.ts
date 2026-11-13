import { failFromError, ok } from "@/lib/server/http";
import { aksesDiklat, pembacaSemua } from "@/lib/server/akses";
import { ForbiddenError, ValidationError } from "@/lib/server/errors";
import { cekKandidat } from "@/lib/server/repositories/bentrok";

/** Pratinjau bentrok WI kandidat dengan diklat lain (peringatan). Hak sama dengan aplikasi lama. */
export async function GET(request: Request) {
  try {
    const a = await aksesDiklat();
    if (!pembacaSemua(a, ["kepala-balai"]) && a.tim.length === 0) throw new ForbiddenError();
    const u = new URL(request.url);
    const trainingId = u.searchParams.get("trainingId") ?? "";
    const instructorId = u.searchParams.get("instructorId") ?? "";
    if (!trainingId || !instructorId) throw new ValidationError("trainingId dan instructorId wajib diisi");
    return ok(await cekKandidat(trainingId, instructorId));
  } catch (e) {
    return failFromError(e);
  }
}
