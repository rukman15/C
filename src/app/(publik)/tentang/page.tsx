import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { ButtonLink } from "@/components/ui/button";
import { JudulPublik } from "@/components/publik/bagian";

export const metadata: Metadata = { title: "Tentang Kami", description: "Sejarah, visi misi, tugas fungsi, dan profil BBPKA-PDN II Jatinangor" };

const LINIMASA = [
  { tahun: "1965", judul: "Kursus Dinas Bagian (KDC)", isi: "Didirikan di Bandung (Jl. Sukajadi). Direktur pertama: Drs. R. Moch. Muclish." },
  { tahun: "1975", judul: "SELAPUTDA", isi: "Keputusan Mendagri Pend. 21/294; berganti nomenklatur Sekolah Lanjutan Tingkat II." },
  { tahun: "1985", judul: "Diklatwil II Bandung", isi: "Kepmendagri No. 22 Tahun 1985; fokus pendidikan dan pelatihan regional." },
  { tahun: "2000", judul: "Pusdiklat Regional Bandung", isi: "Kepmendagri No. 27/2000 & 29/2001 tentang OTK Pusdiklat Regional." },
  { tahun: "2008", judul: "Kampus Jatinangor", isi: "Pindah ke lahan ±7,4 Ha di Jatinangor dengan sarana prasarana lebih lengkap." },
  { tahun: "2017", judul: "PPSDM Regional Bandung", isi: "Permendagri No. 84 Tahun 2017 tentang OTK UPT di lingkungan BPSDM." },
  { tahun: "2025", judul: "BBPKA-PDN II", isi: "Permendagri No. 11 Tahun 2025; menjadi Balai Besar Pengembangan Kompetensi Aparatur Pemerintahan Dalam Negeri II." },
];
const MISI = [
  "Menyelenggarakan pengembangan kompetensi aparatur pemerintahan dalam negeri secara profesional dan berintegritas.",
  "Meningkatkan kualitas penyelenggaraan diklat manajerial, teknis, fungsional, dan sosio kultural.",
  "Mengembangkan inovasi pembelajaran dan tata kelola kelembagaan yang efektif serta akuntabel.",
  "Memperkuat sinergi dengan pemerintah daerah dan pemangku kepentingan dalam pembinaan SDM aparatur.",
];
const TUGAS = [
  { judul: "Diklat Manajerial", isi: "Prajabatan & pengembangan pejabat struktural" },
  { judul: "Jabatan Fungsional", isi: "Pembinaan kompetensi jafung terkait" },
  { judul: "Teknis Substantif", isi: "Pelatihan teknis sesuai bidang pemerintahan" },
  { judul: "Modul & Bahan Ajar", isi: "Pengembangan materi pembelajaran" },
  { judul: "Evaluasi & Sertifikasi", isi: "Penilaian hasil dan kompetensi" },
  { judul: "Kemitraan Daerah", isi: "Sinergi dengan pemda dan stakeholder" },
];
const FASILITAS = ["Ruang Kelas", "Kamar Asrama", "Perpustakaan", "Jogging Track", "Sarana Ibadah", "Klinik Pratama", "Internet", "Sarana Olahraga", "Parkir"];
const NAV = [
  { id: "sejarah", label: "Sejarah" },
  { id: "visi", label: "Visi & Misi" },
  { id: "tugas", label: "Tugas & Fungsi" },
  { id: "kedudukan", label: "Kedudukan" },
  { id: "fasilitas", label: "Fasilitas" },
];

/** Tentang Kami (isi sama dengan aplikasi lama). */
export default function Tentang() {
  return (
    <>
      <JudulPublik
        judul="Tentang Kami"
        keterangan="Balai Besar Pengembangan Kompetensi Aparatur Pemerintahan Dalam Negeri II (BBPKA-PDN II) Jatinangor, Unit Pelaksana Teknis BPSDM Kementerian Dalam Negeri."
      >
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="info">UPT BPSDM Kemendagri</Badge>
          <Badge tone="info">Jatinangor · Sumedang</Badge>
          <Badge tone="neutral">Sejak 1965</Badge>
        </div>
      </JudulPublik>
      <nav aria-label="Bagian halaman" className="tanpa-bilah sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 lg:px-8">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {n.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 lg:px-8">
        <section id="sejarah" className="scroll-mt-32">
          <h2 className="font-display text-2xl font-medium">Sejarah singkat</h2>
          <ol className="mt-6 space-y-3">
            {LINIMASA.map((t, i) => (
              <li key={t.tahun} className="grid gap-2 md:grid-cols-[6rem_1fr]">
                <span className="font-mono text-sm text-primary">{t.tahun}</span>
                <div className="rounded-2xl border border-border p-4">
                  <h3 className="flex flex-wrap items-center gap-2 font-medium">
                    {t.judul}
                    {i === LINIMASA.length - 1 ? (
                      <Badge size="sm" tone="success">
                        Nomenklatur terkini
                      </Badge>
                    ) : null}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="visi" className="scroll-mt-32">
          <h2 className="font-display text-2xl font-medium">Visi & Misi</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 lg:col-span-2">
              <p className="text-sm text-primary">Visi</p>
              <p className="mt-3 font-display text-lg font-medium leading-snug">
                Menjadi pusat unggulan pengembangan kompetensi aparatur pemerintahan dalam negeri yang profesional, berintegritas, dan berdaya saing.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-6 lg:col-span-3">
              <p className="text-sm text-primary">Misi</p>
              <ol className="mt-3 space-y-3">
                {MISI.map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono text-sm text-primary">{i + 1}.</span>
                    <span className="text-sm text-muted-foreground">{m}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
        <section id="tugas" className="scroll-mt-32">
          <h2 className="font-display text-2xl font-medium">Tugas & Fungsi</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Melaksanakan tugas teknis operasional pendidikan dan pelatihan bagi aparatur pemerintahan pusat dan daerah, serta mencetak SDM aparatur yang kompeten dan profesional
            sesuai amanat kebijakan pemerintah.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TUGAS.map((t) => (
              <div key={t.judul} className="rounded-2xl border border-border p-4">
                <h3 className="text-sm font-medium">{t.judul}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t.isi}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="kedudukan" className="scroll-mt-32 rounded-2xl border border-border p-6">
          <h2 className="font-display text-2xl font-medium">Kedudukan BBPKA-PDN II</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Unit Pelaksana Teknis di bawah Badan Pengembangan Sumber Daya Manusia (BPSDM) Kementerian Dalam Negeri. Berfungsi melaksanakan diklat aparatur pemerintahan pusat dan
            daerah, dengan peran strategis dalam pengembangan SDM aparatur yang kompeten dan profesional.
          </p>
          <ButtonLink href="https://bbpkjatinangor.kemendagri.go.id/page/artikel/980" target="_blank" rel="noopener noreferrer" variant="secondary" className="mt-4">
            Baca selengkapnya di situs resmi <ExternalLink size={14} />
          </ButtonLink>
        </section>
        <section id="fasilitas" className="scroll-mt-32">
          <h2 className="font-display text-2xl font-medium">Fasilitas kampus</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FASILITAS.map((f) => (
              <li key={f} className="rounded-2xl border border-border p-4 text-center text-sm">
                {f}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
