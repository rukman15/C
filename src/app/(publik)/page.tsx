import Link from "next/link";
import { ArrowRight, BookOpen, Building2, CalendarDays, ClipboardList, Cog, Handshake, Pin, UserRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { NAMA_APLIKASI, NAMA_LEMBAGA } from "@/lib/aplikasi";

const PINTU = [
  { href: "/tentang", ikon: Building2, judul: "Tentang Kami", isi: "Company Profile, Struktur Organisasi, Daftar Pegawai & Sarpras" },
  { href: "/internal", ikon: ClipboardList, judul: "Adm. Internal", isi: "SIPAMDAL, SIMantap, Jadwal Pimpinan & Widyaiswara" },
  { href: "/pelatihan", ikon: CalendarDays, judul: "Adm. Pelatihan", isi: "Registrasi, Kalender, Surat Penawaran, Peserta & Evaluasi" },
  { href: "/lms", ikon: BookOpen, judul: "LMS", isi: "Modul & Bahan Ajar Diklat Manajerial, Teknis, Sosio Kultural, dll." },
];

const KATEGORI = [
  { ikon: UserRound, judul: "Diklat Manajerial", isi: "Pengembangan kompetensi manajerial bagi pejabat dan calon pejabat struktural." },
  { ikon: Cog, judul: "Diklat Teknis", isi: "Peningkatan keterampilan teknis sesuai bidang tugas masing-masing unit." },
  { ikon: Handshake, judul: "Diklat Sosio Kultural", isi: "Penguatan nilai-nilai budaya kerja, etika, dan integritas aparatur." },
  { ikon: Pin, judul: "Diklat Jabatan Fungsional", isi: "Diklat khusus binaan Kemendagri untuk jabatan fungsional tertentu." },
];

/** Beranda situs publik (isi sama dengan aplikasi lama, tampilan baru EB-041). */
export default function Beranda() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.3fr_1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm text-primary">
              {NAMA_APLIKASI} · {NAMA_LEMBAGA}
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
              Sistem Informasi Pengembangan Kompetensi Aparatur Pemerintah Dalam Negeri
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Platform terintegrasi untuk pembelajaran, manajemen penyelenggaraan pelatihan, dan pembinaan kompetensi ASN di lingkungan Kementerian Dalam Negeri.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <ButtonLink href="/lms">
                Mulai belajar <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="/pelatihan" variant="secondary">
                Kalender pelatihan
              </ButtonLink>
              <ButtonLink href="/registrasi" variant="ghost">
                Registrasi peserta
              </ButtonLink>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-bbpk-bulat.webp" alt={`Logo ${NAMA_LEMBAGA}`} width={320} height={320} className="rounded-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PINTU.map((p) => (
            <Link key={p.href} href={p.href} className="group flex flex-col gap-2 rounded-2xl border border-border p-5 transition-colors hover:border-primary/50">
              <p.ikon size={22} className="text-primary" aria-hidden />
              <h2 className="font-display text-base font-medium">{p.judul}</h2>
              <p className="text-sm text-muted-foreground">{p.isi}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm text-primary">
                Lihat <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">
        <h2 className="font-display text-2xl font-medium">Kategori modul LMS</h2>
        <p className="mt-1 text-sm text-muted-foreground">Materi pembelajaran sesuai jenis diklat</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KATEGORI.map((k) => (
            <Link key={k.judul} href="/lms" className="flex flex-col gap-2 rounded-2xl border border-border p-5 transition-colors hover:border-primary/50">
              <k.ikon size={20} className="text-primary" aria-hidden />
              <h3 className="text-sm font-medium">{k.judul}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{k.isi}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
