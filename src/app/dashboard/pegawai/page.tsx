import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listPegawai } from "@/lib/server/repositories/pegawai";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DataPegawai } from "@/components/menu/data-pegawai";

export const metadata: Metadata = { title: "Data Pegawai" };

/** Data Pegawai (lihat saja): Kepegawaian, Kepala Balai, Kabag TU, admin — sama dengan aplikasi lama. */
export default async function HalamanDataPegawai() {
  const p = await wajibPengguna();
  const boleh = ["admin", "kepegawaian", "kepala-balai", "kabag-tu"].includes(p.role);
  return (
    <HalamanDasbor
      judul="Data Pegawai"
      keterangan="Daftar pegawai BBPKA-PDN II (hanya untuk dilihat). Perubahan data dilakukan Administrator di menu Kelola Pegawai."
      lebar="penuh"
    >
      {boleh ? <DataPegawai list={await listPegawai()} /> : <EmptyState title="Tidak berwenang" description="Data Pegawai dibuka Kepegawaian, Kepala Balai, dan Kabag TU." />}
    </HalamanDasbor>
  );
}
