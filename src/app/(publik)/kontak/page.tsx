import type { Metadata } from "next";
import { JudulPublik } from "@/components/publik/bagian";
import { NAMA_LEMBAGA } from "@/lib/aplikasi";

export const metadata: Metadata = { title: "Kontak" };

/** Kontak lembaga (isi sama dengan aplikasi lama). */
export default function Kontak() {
  const baris = [
    {
      l: "Lembaga",
      isi: (
        <>
          {NAMA_LEMBAGA} (BBPKA-PDN II)<span className="block text-muted-foreground">BPSDM, Kementerian Dalam Negeri RI</span>
        </>
      ),
    },
    { l: "Alamat", isi: "Jl. Kiara Payung KM 4,5 Jatinangor, Kabupaten Sumedang, Jawa Barat" },
    { l: "Telepon / Faks", isi: <span className="font-mono">Telp. (022) 87835007 · Faks. (022) 87835008</span> },
    {
      l: "Situs resmi",
      isi: (
        <a href="https://bbpkjatinangor.kemendagri.go.id/beranda" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          bbpkjatinangor.kemendagri.go.id
        </a>
      ),
    },
  ];
  return (
    <>
      <JudulPublik judul="Kontak" />
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <dl className="max-w-xl space-y-5 rounded-2xl border border-border p-6 text-sm">
          {baris.map((b) => (
            <div key={b.l}>
              <dt className="text-xs text-muted-foreground">{b.l}</dt>
              <dd className="mt-1">{b.isi}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
