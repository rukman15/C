import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { aksesDiklat, bolehKelolaTraining, pembacaSemua, pilihanTimDiklatAkses } from "@/lib/server/akses";
import { getRincian } from "@/lib/server/repositories/rincian";
import { wajibPengguna } from "@/lib/server/halaman";
import { NotFoundError } from "@/lib/server/errors";
import type { RincianDiklat } from "@/lib/rincian";
import type { TimDiklat } from "@/lib/tim-kerja";

export type HalamanDiklat =
  | { boleh: false; alasan: string }
  | {
      boleh: true;
      rincian: RincianDiklat;
      /** Boleh melihat bagian Rincian dan bagian pengelolaan lainnya. */
      lihatPenuh: boolean;
      /** Widyaiswara pengampu: hanya bagian Tugas, Seminar, Penilaian (seperti aplikasi lama). */
      hanyaPenilaian: boolean;
      bolehAtur: boolean;
      bolehHapus: boolean;
      /** Melihat / mencatat sesi mengajar (aplikasi lama: Ketua Diklat, Kepala Balai, Koordinator WI; mencatat tanpa Kepala Balai). */
      bolehLihatSesi: boolean;
      bolehCatatSesi: boolean;
      global: boolean;
      pilihanTim: TimDiklat[];
    };

/**
 * Hak atas halaman satu diklat, sama dengan aplikasi lama: dibaca Ketua Diklat, Kepala Balai,
 * Koordinator WI, Admin Penyelenggara (pembacaSemua), dan tim pemegangnya; diubah Ketua Diklat/admin
 * atau tim pemegangnya; dihapus Ketua Diklat/admin.
 */
export const muatHalamanDiklat = cache(async (id: string): Promise<HalamanDiklat> => {
  const p = await wajibPengguna();
  const a = await aksesDiklat();
  let rincian: RincianDiklat;
  try {
    rincian = await getRincian(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const bolehAtur = await bolehKelolaTraining(a, id);
  const lihatPenuh = pembacaSemua(a, ["kepala-balai"]) || bolehAtur;
  const hanyaPenilaian = !lihatPenuh && p.role === "widyaiswara";
  if (!lihatPenuh && !hanyaPenilaian) {
    return { boleh: false, alasan: "Halaman ini khusus Ketua Diklat, Kepala Balai, Koordinator WI, Admin Penyelenggara, dan tim pemegang diklat." };
  }
  return {
    boleh: true,
    rincian,
    lihatPenuh,
    hanyaPenilaian,
    bolehAtur,
    bolehHapus: a.role === "ketua-diklat" || a.role === "admin",
    bolehLihatSesi: a.role === "admin" || a.role === "ketua-diklat" || a.role === "kepala-balai" || a.koordinatorWi,
    bolehCatatSesi: a.role === "admin" || a.role === "ketua-diklat" || a.koordinatorWi,
    global: a.global,
    pilihanTim: bolehAtur ? await pilihanTimDiklatAkses(a) : [],
  };
});
