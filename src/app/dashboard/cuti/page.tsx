import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { Cuti } from "@/components/persuratan/cuti";

export const metadata: Metadata = { title: "Cuti" };

/** Surat cuti pegawai (sama dengan aplikasi lama). */
export default async function HalamanCuti() {
  await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor
      judul="Cuti"
      keterangan="Surat cuti pegawai: Nota Dinas dan Surat Izin Cuti. Cuti diputuskan di luar aplikasi; di sini hanya dibuat suratnya, dan nomornya diketik pembuat surat."
      lebar="penuh"
    >
      <TabPersuratan aktif="cuti" hak={hak} />
      <Cuti hariIni={isoTanggal(awalHariWib())} />
    </HalamanDasbor>
  );
}
