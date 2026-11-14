"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LEMBAGA_SINGKAT, NAMA_APLIKASI } from "@/lib/aplikasi";
import { cn } from "@/lib/utils";
import { MENU_PUBLIK } from "./menu";

const aktif = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/** Bilah atas situs publik: logo, menu, tombol Masuk (atau Dasbor bila sudah masuk). Di HP menu dibuka lewat tombol. */
export function KepalaPublik({ masuk }: { masuk: boolean }) {
  const path = usePathname();
  const [buka, setBuka] = useState(false);
  useEffect(() => setBuka(false), [path]);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-bbpk-bulat.webp" alt="" width={36} height={36} className="rounded-full" />
          <span className="leading-tight">
            <span className="block font-display text-sm font-medium">{NAMA_APLIKASI}</span>
            <span className="block text-xs text-muted-foreground">{LEMBAGA_SINGKAT}</span>
          </span>
        </Link>
        <nav aria-label="Menu utama" className="ml-auto hidden items-center gap-1 lg:flex">
          {MENU_PUBLIK.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              aria-current={aktif(path, m.href) ? "page" : undefined}
              className={cn("rounded-full px-3 py-2 text-sm transition-colors", aktif(path, m.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <ButtonLink size="sm" href={masuk ? "/dashboard" : "/login"}>
            {masuk ? "Dasbor" : "Masuk"}
          </ButtonLink>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground lg:hidden"
            aria-expanded={buka}
            aria-controls="menu-publik"
            aria-label={buka ? "Tutup menu" : "Buka menu"}
            onClick={() => setBuka(!buka)}
          >
            {buka ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {buka ? (
        <nav id="menu-publik" aria-label="Menu utama" className="border-t border-border px-4 py-2 lg:hidden">
          {MENU_PUBLIK.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              aria-current={aktif(path, m.href) ? "page" : undefined}
              className={cn("block rounded-xl px-3 py-2.5 text-sm", aktif(path, m.href) ? "bg-primary/10 text-primary" : "text-foreground")}
            >
              {m.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
