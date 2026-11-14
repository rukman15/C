import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { daftarTinjau } from "@/lib/server/repositories/tugas";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { DaftarTinjauTugas } from "@/components/tugas/tinjau-tugas";

export const metadata: Metadata = { title: "Tinjau Tugas" };

/** Tinjau Tugas (EB-038): kiriman yang ditinjau akun ini sebagai coach/mentor/pengampu, atau di diklat yang dikelola. */
export default async function HalamanTinjauTugas() {
  await wajibPengguna();
  const data = await daftarTinjau(await penggunaTugas());
  return (
    <HalamanDasbor judul="Tinjau Tugas" keterangan="Rancangan Aksi Perubahan, laporan progres, dan tugas pembelajaran yang dikirim peserta." lebar="penuh">
      <DaftarTinjauTugas awal={data} />
    </HalamanDasbor>
  );
}
