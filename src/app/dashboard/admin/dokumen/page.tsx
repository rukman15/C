import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { getPengaturanDokumen } from "@/lib/server/repositories/dokumen";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PengaturanDokumen } from "@/components/menu/pengaturan-dokumen";

export const metadata: Metadata = { title: "Pengaturan Dokumen" };

/** Pengaturan Dokumen — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanPengaturanDokumen() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Pengaturan Dokumen"
      keterangan="Nama & NIP pejabat dipakai di blok tanda tangan surat tugas, surat keterangan, dan izin cuti. Kosong = diambil dari Data Pegawai (Kepala Balai) atau tampil titik-titik."
      lebar="sempit"
    >
      {p.role === "admin" ? (
        <PengaturanDokumen awal={await getPengaturanDokumen()} />
      ) : (
        <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." />
      )}
    </HalamanDasbor>
  );
}
