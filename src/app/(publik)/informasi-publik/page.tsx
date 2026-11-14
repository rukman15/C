import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { JudulPublik, KartuPublik } from "@/components/publik/bagian";

export const metadata: Metadata = {
  title: "Informasi Publik",
  description: "Maklumat pelayanan, survei kepuasan, standar pelayanan, alur PNBP, dan zona integritas BBPKA-PDN II Jatinangor",
};

type Butir = { id: string; title: string; short: string; body: string; action: { label: string; href: string }; steps?: string[]; bullets?: string[] };

const ITEMS: Butir[] = [
  {
    id: "maklumat",
    title: "Maklumat Pelayanan",
    short: "Kesanggupan pelayanan sesuai standar",
    body: "Pernyataan kesanggupan BBPKA-PDN II dalam memberikan pelayanan diklat dan administrasi sesuai standar yang ditetapkan, dengan komitmen integritas dan nilai BerAKHLAK.",
    action: { label: "Lihat di situs resmi", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "survey",
    title: "Survey Kepuasan Masyarakat",
    short: "Formulir penilaian pelayanan",
    body: "Survei untuk mengukur kepuasan peserta diklat dan pemangku kepentingan terhadap kualitas pelayanan, fasilitas, dan penyelenggaraan pelatihan.",
    action: { label: "Isi / lihat survei", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "hasil",
    title: "Hasil Survey Kepuasan",
    short: "Laporan & indeks kepuasan (IKM)",
    body: "Publikasi hasil evaluasi berkala berupa indeks kepuasan masyarakat (IKM) dan ringkasan temuan untuk perbaikan berkelanjutan pelayanan publik.",
    action: { label: "Lihat hasil", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "alur",
    title: "Alur Pembayaran PNBP",
    short: "Tata cara bayar biaya pelatihan",
    body: "Panduan langkah pembayaran biaya pelatihan (PNBP): informasi rekening, nominal, bukti transfer, dan konfirmasi kepada panitia penyelenggara.",
    steps: ["Terima informasi biaya & rekening dari panitia", "Lakukan pembayaran sesuai nominal", "Simpan bukti transfer", "Konfirmasi ke panitia / upload bukti"],
    action: { label: "Detail alur resmi", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "sk",
    title: "SK Standar Pelayanan",
    short: "Dokumen SK resmi (PDF)",
    body: "Surat Keputusan penetapan standar pelayanan BBPKA-PDN II. Dokumen resmi biasanya tersedia dalam format PDF pada portal informasi publik lembaga.",
    action: { label: "Unduh / buka di situs resmi", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "standar",
    title: "Standar Pelayanan",
    short: "Waktu, biaya, syarat & prosedur",
    body: "Rincian standar pelayanan per jenis diklat: persyaratan peserta, jangka waktu, biaya (jika ada), produk layanan, dan mekanisme pengaduan.",
    bullets: ["Persyaratan dan kelengkapan berkas", "Jangka waktu penyelesaian layanan", "Biaya / PNBP (jika berlaku)", "Produk layanan & pengaduan"],
    action: { label: "Lihat standar lengkap", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
  {
    id: "zona",
    title: "Zona Integritas",
    short: "Menuju WBK / WBBM",
    body: "Komitmen pembangunan zona integritas menuju Wilayah Bebas dari Korupsi (WBK) dan Wilayah Birokrasi Bersih dan Melayani (WBBM): pelayanan publik berkualitas, anti korupsi, dan budaya kerja BerAKHLAK.",
    action: { label: "Info zona integritas", href: "https://bbpkjatinangor.kemendagri.go.id/beranda" },
  },
];

/** Informasi Publik (isi sama dengan aplikasi lama). */
export default function InformasiPublik() {
  return (
    <>
      <JudulPublik
        judul="Informasi Publik"
        keterangan="Keterbukaan informasi BBPKA-PDN II Jatinangor: maklumat, survei kepuasan, standar pelayanan, alur PNBP, dan zona integritas."
      />
      <nav aria-label="Bagian halaman" className="tanpa-bilah sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 lg:px-8">
          {ITEMS.map((it) => (
            <a key={it.id} href={`#${it.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {it.title}
            </a>
          ))}
        </div>
      </nav>
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-10 md:grid-cols-2 lg:px-8">
        {ITEMS.map((it) => (
          <KartuPublik key={it.id} id={it.id} judul={it.title} className="scroll-mt-32">
            <p className="text-xs text-primary">{it.short}</p>
            <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
            {it.steps ? (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {it.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            ) : null}
            {it.bullets ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {it.bullets.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
            <a href={it.action.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
              {it.action.label} <ExternalLink size={13} />
            </a>
          </KartuPublik>
        ))}
      </div>
    </>
  );
}
