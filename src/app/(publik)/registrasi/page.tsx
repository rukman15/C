import type { Metadata } from "next";
import { JudulPublik } from "@/components/publik/bagian";
import { FormRegistrasi } from "@/components/publik/form-registrasi";

export const metadata: Metadata = { title: "Registrasi Peserta" };

/** Registrasi mandiri peserta diklat (publik), sama dengan aplikasi lama. */
export default function Registrasi() {
  return (
    <>
      <JudulPublik
        judul="Registrasi Peserta"
        keterangan="Buat akun peserta diklat. Untuk ASN peserta pelatihan BBPKA-PDN II Jatinangor; akun aktif setelah diperiksa dan disetujui penyelenggara."
      />
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <FormRegistrasi />
      </div>
    </>
  );
}
