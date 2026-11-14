import Link from "next/link";
import { INDUK_LEMBAGA, LEMBAGA_SINGKAT, NAMA_APLIKASI, NAMA_LENGKAP } from "@/lib/aplikasi";
import { MENU_PUBLIK } from "./menu";

/** Kepala halaman publik: remah roti, judul, keterangan. */
export function JudulPublik({ judul, keterangan, children }: { judul: string; keterangan?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
        <p className="mb-3 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Beranda
          </Link>
          <span className="mx-2">/</span>
          {judul}
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight lg:text-4xl">{judul}</h1>
        {keterangan ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground lg:text-base">{keterangan}</p> : null}
        {children}
      </div>
    </header>
  );
}

/** Kartu bergaris tanpa bayangan untuk situs publik. */
export function KartuPublik({ judul, children, id, className = "" }: { judul?: string; children?: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border border-border p-5 ${className}`}>
      {judul ? <h2 className="font-display text-base font-medium">{judul}</h2> : null}
      {children}
    </section>
  );
}

/** Kaki halaman situs publik. */
export function KakiPublik() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="font-display font-medium">{NAMA_APLIKASI}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{NAMA_LENGKAP}.</p>
        </div>
        <div>
          <p className="font-medium">Menu</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {MENU_PUBLIK.slice(0, 4).map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="hover:text-foreground">
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium">Layanan</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {[...MENU_PUBLIK.slice(4), { href: "/kebijakan-privasi", label: "Kebijakan Privasi" }, { href: "/registrasi", label: "Registrasi Peserta" }].map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="hover:text-foreground">
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium">Kontak</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Jl. Kiara Payung KM 4,5 Jatinangor
            <br />
            Kab. Sumedang, Jawa Barat
            <br />
            <span className="font-mono">(022) 87835007</span>
          </p>
        </div>
      </div>
      <p className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © 2026 {NAMA_APLIKASI} · {LEMBAGA_SINGKAT} / {INDUK_LEMBAGA}
      </p>
    </footer>
  );
}
