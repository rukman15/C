import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listWewenang } from "@/lib/server/repositories/wewenang-penyelenggara";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminPenyelenggara } from "@/components/menu/admin-penyelenggara";

export const metadata: Metadata = { title: "Admin Penyelenggara" };

/** Admin Penyelenggara (EB-034) — hanya Super Admin (sama dengan aplikasi lama). */
export default async function HalamanAdminPenyelenggara() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Admin Penyelenggara"
      keterangan="Tunjuk pegawai sebagai Admin Penyelenggara dan pilih wewenangnya. Berlaku untuk semua diklat; semua perubahan tercatat di Log Audit."
    >
      {p.role === "admin" ? <AdminPenyelenggara awal={await listWewenang()} /> : <EmptyState title="Tidak berwenang" description="Halaman ini hanya untuk Super Admin." />}
    </HalamanDasbor>
  );
}
