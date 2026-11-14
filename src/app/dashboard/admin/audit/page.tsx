import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listAudit } from "@/lib/server/audit";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { LogAudit } from "@/components/menu/log-audit";

export const metadata: Metadata = { title: "Log Audit" };

/** Log Audit — khusus Administrator sistem (sama dengan aplikasi lama). */
export default async function HalamanLogAudit() {
  const p = await wajibPengguna();
  return (
    <HalamanDasbor
      judul="Log Audit"
      keterangan="Jejak tindakan yang menyangkut hak akses: pembuatan dan penonaktifan akun, reset kata sandi, perubahan peran dan jabatan, Plt/Plh, pembukaan berkas, serta akses yang ditutup otomatis."
      lebar="penuh"
    >
      {p.role !== "admin" ? <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem." /> : <LogAudit awal={await listAudit({ take: 300 })} />}
    </HalamanDasbor>
  );
}
