import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { JudulPublik, KartuPublik } from "@/components/publik/bagian";

export const metadata: Metadata = { title: "Adm. Internal" };

const MODUL = [
  { judul: "SIPAMDAL", isi: "Sistem informasi terkait administrasi dan pengelolaan data internal lembaga." },
  {
    judul: "SIMantap",
    isi: "Sistem monitoring dan tata kelola (termasuk jadwal tenaga pengajar / widyaiswara).",
    tautan: "https://simantapbbpkjatinangor.com/jadwal-tenaga-pengajar",
  },
  { judul: "Jadwal Pimpinan", isi: "Informasi agenda dan periode pimpinan BBPKA-PDN II." },
  { judul: "Widyaiswara", isi: "Profil dan data widyaiswara ahli utama, madya, muda, dan pertama." },
];

/** Administrasi Internal (isi sama dengan aplikasi lama). */
export default function Internal() {
  return (
    <>
      <JudulPublik judul="Administrasi Internal" keterangan="SIPAMDAL, SIMantap, jadwal pimpinan, dan widyaiswara." />
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-10 sm:grid-cols-2 lg:px-8">
        {MODUL.map((m) => (
          <KartuPublik key={m.judul} judul={m.judul}>
            <p className="mt-2 text-sm text-muted-foreground">{m.isi}</p>
            {m.tautan ? (
              <a href={m.tautan} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                Buka SIMantap <ExternalLink size={13} />
              </a>
            ) : null}
          </KartuPublik>
        ))}
      </div>
    </>
  );
}
