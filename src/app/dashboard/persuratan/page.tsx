import type { Metadata } from "next";
import { Suspense } from "react";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { NaskahDinas } from "@/components/persuratan/naskah-dinas";

export const metadata: Metadata = { title: "Naskah Dinas" };

/** Naskah Dinas (tab pertama modul persuratan), sama dengan aplikasi lama. */
export default async function HalamanNaskahDinas() {
  const p = await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor
      judul="Naskah Dinas"
      keterangan="Naskah dinas sesuai Permendagri 18/2024. Konsep tanpa tanda tangan; nomor diketik pembuat surat setelah ditandatangani."
      lebar="penuh"
    >
      <TabPersuratan aktif="naskah" hak={hak} />
      <Suspense>
        <NaskahDinas emailSaya={p.email} hariIni={isoTanggal(awalHariWib())} />
      </Suspense>
    </HalamanDasbor>
  );
}
