import "server-only";
import { aksesDiklat, bolehKelolaTraining, pembacaSemua } from "@/lib/server/akses";
import { WEWENANG_ATUR_PENUGASAN, punyaWewenang } from "@/lib/wewenang-penyelenggara";

/**
 * Hak tab Penugasan (EB-035, sama dengan aplikasi lama): KELOLA = admin, Ketua Diklat, tim kerja pemegang diklat, atau Admin
 * Penyelenggara berwenang "atur-penugasan"; BACA = itu ditambah Kepala Balai, Kabag TU, Koordinator WI, pemegang wewenang.
 */
export async function hakPenugasan(trainingId: string) {
  const a = await aksesDiklat();
  const kelola = punyaWewenang(a.wewenang, WEWENANG_ATUR_PENUGASAN) || (await bolehKelolaTraining(a, trainingId));
  const baca = kelola || pembacaSemua(a, ["kepala-balai", "kabag-tu"]);
  return { a, kelola, baca };
}
