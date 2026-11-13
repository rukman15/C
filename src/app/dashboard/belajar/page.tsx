import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/server/halaman";
import { listDiklatSaya } from "@/lib/server/repositories/belajar";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { DaftarPelatihan } from "@/components/peserta/bagian";

export const metadata: Metadata = { title: "Diklat Saya" };

/** Diklat Saya: daftar pelatihan akun peserta (sama dengan aplikasi lama). */
export default async function DiklatSaya() {
  const p = await wajibPengguna();
  if (p.role !== "peserta") redirect("/dashboard");
  const list = await listDiklatSaya(p.email);
  return (
    <HalamanDasbor judul="Diklat Saya" keterangan="Diklat yang Anda ikuti. Pilih salah satu untuk melihat jadwal, kehadiran, tahapan, dan pembelajaran mandiri." lebar="penuh">
      <DaftarPelatihan list={list} />
    </HalamanDasbor>
  );
}
