import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listPegawai } from "@/lib/server/repositories/pegawai";
import { listTimKerja } from "@/lib/server/repositories/tim-kerja";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TimKerja } from "@/components/menu/tim-kerja";

export const metadata: Metadata = { title: "Tim Kerja" };

/** Tim Kerja — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanTimKerja() {
  const p = await wajibPengguna();
  if (p.role !== "admin")
    return (
      <HalamanDasbor judul="Tim Kerja">
        <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." />
      </HalamanDasbor>
    );
  const [tim, pegawai] = await Promise.all([listTimKerja(), listPegawai()]);
  return (
    <HalamanDasbor judul="Tim Kerja">
      <TimKerja awal={tim} pegawai={pegawai.filter((x) => x.status === "AKTIF").map((x) => ({ id: x.id, nama: x.nama, jabatan: x.jabatan }))} />
    </HalamanDasbor>
  );
}
