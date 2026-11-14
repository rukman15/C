import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PemetaanPegawai } from "@/components/menu/pemetaan-pegawai";

export const metadata: Metadata = { title: "Pemetaan Pegawai" };

/** Pemetaan Pegawai — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanPemetaanPegawai() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Pemetaan Pegawai"
      keterangan="Atur jabatan/fungsi, role akses login, dan keanggotaan Tim Kerja seluruh pegawai. Jika jabatan atau role berubah, pengguna perlu masuk kembali agar dasbor diperbarui."
    >
      {p.role === "admin" ? (
        <PemetaanPegawai pegawaiSaya={p.pegawaiId ?? null} roleSaya={p.role} />
      ) : (
        <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." />
      )}
    </HalamanDasbor>
  );
}
