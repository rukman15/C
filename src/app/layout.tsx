import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NAMA_APLIKASI, NAMA_LENGKAP } from "@/lib/aplikasi";
import { SKRIP_TEMA } from "@/lib/tema-skrip";
import { PenyediaArc } from "@/components/penyedia-arc";
import "@/components/arc/foundation.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: NAMA_APLIKASI, template: `%s · ${NAMA_APLIKASI}` },
  description: NAMA_LENGKAP,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-accent: aksen biru e-Balai dari palet Arc. data-theme dipasang skrip sebelum halaman tergambar.
    <html lang="id" data-accent="blue" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body>
        <PenyediaArc>{children}</PenyediaArc>
      </body>
    </html>
  );
}
