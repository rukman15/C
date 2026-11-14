import type { Metadata } from "next";
import { Suspense } from "react";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { SuratMasuk } from "@/components/persuratan/surat-masuk";

export const metadata: Metadata = { title: "Surat Masuk" };

/** Surat masuk dan disposisi (sama dengan aplikasi lama). */
export default async function HalamanSuratMasuk() {
  await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor judul="Surat Masuk" keterangan="Surat masuk dan disposisi." lebar="penuh">
      <TabPersuratan aktif="surat-masuk" hak={hak} />
      <Suspense>
        <SuratMasuk hariIni={isoTanggal(awalHariWib())} />
      </Suspense>
    </HalamanDasbor>
  );
}
