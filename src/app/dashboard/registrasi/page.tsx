import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { RegistrasiPeserta } from "@/components/menu/registrasi-peserta";

export const metadata: Metadata = { title: "Registrasi Peserta" };

/** Registrasi Peserta — admin & Ketua Diklat (sama dengan aplikasi lama). */
export default async function HalamanRegistrasi() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Registrasi Peserta"
      keterangan="Pendaftaran mandiri dari halaman /registrasi. Periksa NIP, instansi, dan jabatan sebelum menyetujui. Ditolak = akun dan datanya dihapus; alasannya tercatat di Log Audit."
    >
      {["admin", "ketua-diklat"].includes(p.role) ? <RegistrasiPeserta /> : <EmptyState title="Tidak berwenang" description="Halaman ini untuk Administrator dan Ketua Diklat." />}
    </HalamanDasbor>
  );
}
