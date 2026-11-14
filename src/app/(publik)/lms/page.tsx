import type { Metadata } from "next";
import { JudulPublik, KartuPublik } from "@/components/publik/bagian";

export const metadata: Metadata = { title: "LMS" };

const KATEGORI = [
  { judul: "Diklat Manajerial", isi: "Modul kompetensi manajerial pejabat dan calon pejabat struktural." },
  { judul: "Diklat Teknis", isi: "Bahan ajar keterampilan teknis sesuai bidang tugas unit." },
  { judul: "Diklat Sosio Kultural", isi: "Nilai budaya kerja, etika, dan integritas aparatur." },
  { judul: "Diklat Jabatan Fungsional", isi: "Modul khusus jabatan fungsional binaan Kemendagri." },
];

/** LMS (isi sama dengan aplikasi lama). */
export default function Lms() {
  return (
    <>
      <JudulPublik
        judul="Learning Management System"
        keterangan="Modul dan bahan ajar diklat BBPKA-PDN II: manajerial, teknis, sosio kultural, dan jabatan fungsional. Peserta diklat membuka bahan belajarnya di Ruang Belajar setelah masuk."
      />
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-10 sm:grid-cols-2 lg:px-8">
        {KATEGORI.map((k) => (
          <KartuPublik key={k.judul} judul={k.judul}>
            <p className="mt-2 text-sm text-muted-foreground">{k.isi}</p>
          </KartuPublik>
        ))}
      </div>
    </>
  );
}
