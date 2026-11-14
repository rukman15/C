import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { JudulPublik, KartuPublik } from "@/components/publik/bagian";

export const metadata: Metadata = { title: "Pelatihan" };

const KATEGORI = [
  { id: "manajerial", judul: "Manajerial & Prajabatan", isi: "Pengembangan kompetensi manajerial bagi pejabat struktural dan calon pejabat, serta orientasi/prajabatan ASN." },
  { id: "jafung", judul: "Jabatan Fungsional", isi: "Diklat dan pembinaan kompetensi jabatan fungsional binaan Kemendagri dan terkait pemerintahan daerah." },
  { id: "teknis-sub", judul: "Teknis Substantif", isi: "Pelatihan teknis substantif sesuai bidang tugas unit kerja pemerintahan dalam negeri." },
  { id: "teknis-umum", judul: "Teknis Umum & Substantif", isi: "Diklat teknis umum dan substantif lintas bidang untuk peningkatan keterampilan aparatur." },
];
const ADM = ["Registrasi peserta", "Kalender pelatihan", "Surat penawaran", "Data peserta & alumni", "Evaluasi penyelenggaraan"];

/** Pelatihan (isi sama dengan aplikasi lama). */
export default function Pelatihan() {
  return (
    <>
      <JudulPublik judul="Pelatihan" keterangan="Program diklat BBPKA-PDN II Jatinangor dan administrasi penyelenggaraan pelatihan." />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {KATEGORI.map((k) => (
            <KartuPublik key={k.id} id={k.id} judul={k.judul}>
              <p className="mt-2 text-sm text-muted-foreground">{k.isi}</p>
              <a
                href="https://bbpkjatinangor.kemendagri.go.id/beranda"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary"
              >
                Info & surat penawaran di situs resmi <ExternalLink size={13} />
              </a>
            </KartuPublik>
          ))}
        </div>
        <KartuPublik id="adm" judul="Administrasi Pelatihan">
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {ADM.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <ButtonLink href="/registrasi" className="mt-4">
            Registrasi peserta <ArrowRight size={16} />
          </ButtonLink>
        </KartuPublik>
      </div>
    </>
  );
}
