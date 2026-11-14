import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { SuratTugasSemua } from "@/components/persuratan/surat-tugas-semua";

export const metadata: Metadata = { title: "Surat Tugas" };

/** Surat Tugas: mengajar dan umum dalam satu daftar (sama dengan aplikasi lama). */
export default async function HalamanSuratTugas() {
  await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor
      judul="Surat Tugas"
      keterangan="Semua surat tugas, mengajar dan umum, dalam satu daftar. Konsep tanpa tanda tangan; ditandatangani lewat TTE, lalu nomornya diketik pembuat surat."
      lebar="penuh"
    >
      <TabPersuratan aktif="surat-tugas" hak={hak} />
      <SuratTugasSemua hariIni={isoTanggal(awalHariWib())} />
    </HalamanDasbor>
  );
}
