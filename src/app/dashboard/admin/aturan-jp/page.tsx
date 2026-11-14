import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AturanJp } from "@/components/menu/aturan-jp";

export const metadata: Metadata = { title: "Aturan JP" };

/** Aturan JP — Administrator; Koordinator WI melihatnya sebagai "Batas JP Widyaiswara" (sama dengan aplikasi lama). */
export default async function HalamanAturanJp() {
  const p = await wajibPengguna();
  const isAdmin = p.role === "admin";
  const judul = isAdmin ? "Aturan JP" : "Batas JP Widyaiswara";
  return (
    <HalamanDasbor judul={judul} lebar="penuh">
      {isAdmin || p.koordinatorWi ? (
        <AturanJp isAdmin={isAdmin} hariIni={isoTanggal(awalHariWib())} />
      ) : (
        <EmptyState title="Tidak berwenang" description="Halaman ini khusus Administrator sistem dan Koordinator WI." />
      )}
    </HalamanDasbor>
  );
}
