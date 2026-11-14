import type { Metadata } from "next";
import { aksesDiklat, wajibPembacaWi } from "@/lib/server/akses";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { BebanWi } from "@/components/beban/beban-wi";

export const metadata: Metadata = { title: "Beban JP Widyaiswara" };

/** Beban JP Widyaiswara — pembaca WI (Ketua Diklat, pimpinan, kepegawaian, WI, anggota tim kerja), sama dengan aplikasi lama. */
export default async function HalamanBebanWi() {
  const a = await aksesDiklat();
  let boleh = true;
  try {
    wajibPembacaWi(a);
  } catch {
    boleh = false;
  }
  return (
    <HalamanDasbor judul="Beban JP Widyaiswara" lebar="penuh">
      {boleh ? (
        <BebanWi hariIni={isoTanggal(awalHariWib())} isAdmin={a.role === "admin"} />
      ) : (
        <EmptyState title="Tidak berwenang" description="Halaman ini untuk penyelenggara, pimpinan, kepegawaian, dan Widyaiswara." />
      )}
    </HalamanDasbor>
  );
}
