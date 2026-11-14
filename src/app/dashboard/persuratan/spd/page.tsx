import type { Metadata } from "next";
import { Suspense } from "react";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { Spd } from "@/components/persuratan/spd";

export const metadata: Metadata = { title: "SPD" };

/** Surat Perjalanan Dinas dari surat tugas bernomor (sama dengan aplikasi lama). */
export default async function HalamanSpd() {
  await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor judul="SPD" keterangan="Surat Perjalanan Dinas dari surat tugas yang sudah bernomor. Ditandatangani Pejabat Pembuat Komitmen." lebar="penuh">
      <TabPersuratan aktif="spd" hak={hak} />
      <Suspense>
        <Spd hariIni={isoTanggal(awalHariWib())} />
      </Suspense>
    </HalamanDasbor>
  );
}
