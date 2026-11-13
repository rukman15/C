import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { getJadwal, pilihanTimDiklat } from "@/lib/server/repositories/jadwal";
import { kelolaGlobal } from "@/lib/tim-kerja";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { TampilanJadwal } from "@/components/jadwal/tampilan-jadwal";

export const metadata: Metadata = { title: "Jadwal Diklat" };

/**
 * Jadwal Diklat untuk semua peran: kalender diklat + jadwal mengajar milik sendiri.
 * Hak tampilan sama dengan aplikasi lama; server tetap memeriksa saat menambah jadwal.
 */
export default async function HalamanJadwal() {
  const p = await wajibPengguna();
  const global = kelolaGlobal(p.role);
  const bisaTambah = global || p.timDiklat.length > 0;
  const [data, pilihanTim] = await Promise.all([getJadwal(p.pegawaiId), bisaTambah ? pilihanTimDiklat(global, p.timDiklat) : Promise.resolve([])]);

  return (
    <TampilanJadwal
      data={data}
      hariIni={isoTanggal(awalHariWib())}
      // Rincian diklat (ubah, hapus, kurikulum, pengampu): Ketua Diklat, Kepala Balai, admin.
      bolehRincian={p.role === "ketua-diklat" || p.role === "kepala-balai" || p.role === "admin"}
      tambah={bisaTambah ? { global, tim: pilihanTim } : null}
    />
  );
}
