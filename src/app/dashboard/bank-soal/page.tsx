import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { BankSoal } from "@/components/tes/bank-soal";

export const metadata: Metadata = { title: "Bank Soal" };

/** Bank Soal — admin, Ketua Diklat, dan Widyaiswara (sama dengan aplikasi lama). */
export default async function HalamanBankSoal() {
  const p = await wajibPengguna();
  const boleh = ["admin", "ketua-diklat", "widyaiswara"].includes(p.role);
  return (
    <HalamanDasbor judul="Bank Soal">
      {boleh ? (
        <BankSoal penyelenggara={p.role === "admin" || p.role === "ketua-diklat"} />
      ) : (
        <EmptyState title="Tidak berwenang" description="Halaman ini untuk admin, Ketua Diklat, dan Widyaiswara." />
      )}
    </HalamanDasbor>
  );
}
