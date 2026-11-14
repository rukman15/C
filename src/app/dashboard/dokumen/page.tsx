import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { DokumenPenugasan } from "@/components/menu/dokumen-penugasan";

export const metadata: Metadata = { title: "Dokumen Penugasan" };

const PENGELOLA = ["admin", "ketua-diklat", "kepala-balai", "kabag-tu", "kepegawaian"];

/** Dokumen Penugasan: surat tugas (Word/PDF) dan rekap JP bulanan WI (sama dengan aplikasi lama). */
export default async function HalamanDokumenPenugasan() {
  const p = await wajibPengguna();
  const pengelola = PENGELOLA.includes(p.role) || p.koordinatorWi;
  return (
    <HalamanDasbor
      judul="Dokumen Penugasan"
      keterangan="Surat tugas dan rekap JP dalam Word, PDF, atau CSV. Surat tugas berupa konsep tanpa tanda tangan untuk diunggah ke aplikasi TTE."
      lebar="penuh"
    >
      <DokumenPenugasan
        hariIni={isoTanggal(awalHariWib())}
        pengelola={pengelola}
        keteranganSurat={pengelola || p.timDiklat.length ? "Dibuat dan diubah di rincian diklat (tab Rincian → Surat Tugas)." : "Surat tugas yang ditujukan kepada Anda."}
      />
    </HalamanDasbor>
  );
}
