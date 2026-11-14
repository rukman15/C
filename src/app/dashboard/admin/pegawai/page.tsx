import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listPegawai } from "@/lib/server/repositories/pegawai";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { KelolaPegawai } from "@/components/menu/kelola-pegawai";

export const metadata: Metadata = { title: "Kelola Pegawai" };

/** Kelola Pegawai — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanKelolaPegawai() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor judul="Kelola Pegawai">
      {p.role === "admin" ? <KelolaPegawai awal={await listPegawai()} /> : <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." />}
    </HalamanDasbor>
  );
}
