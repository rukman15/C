import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { KelolaAkun } from "@/components/menu/kelola-akun";

export const metadata: Metadata = { title: "Kelola Akun" };

/** Kelola Akun — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanKelolaAkun() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Kelola Akun"
      lebar="penuh"
      keterangan="Buat akun, nonaktifkan, reset kata sandi, dan ubah peran. Kata sandi sementara tersimpan di Catatan sandi awal sampai pemiliknya menggantinya saat masuk. Semua tindakan tercatat di Log Audit."
    >
      {p.role === "admin" ? <KelolaAkun emailSaya={p.email} /> : <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." />}
    </HalamanDasbor>
  );
}
