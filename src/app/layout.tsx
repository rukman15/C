import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NAMA_APLIKASI, NAMA_LENGKAP } from "@/lib/aplikasi";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: NAMA_APLIKASI, template: `%s · ${NAMA_APLIKASI}` },
  description: NAMA_LENGKAP,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#141518" },
  ],
};

// Tema dipasang sebelum halaman tergambar supaya tidak berkedip.
const SKRIP_TEMA = `try{var t=localStorage.getItem("tema");var g=t?t==="gelap":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",g)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
