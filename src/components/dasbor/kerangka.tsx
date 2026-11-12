"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import { menuAktif, type ButirMenu, type menuAkun } from "@/lib/navigasi";
import { NAMA_APLIKASI, LEMBAGA_SINGKAT } from "@/lib/aplikasi";
import { cn } from "@/lib/utils";
import { IKON_MENU } from "./ikon";
import { MenuPengguna, type InfoPengguna } from "./menu-pengguna";
import { TombolTema } from "@/components/tombol-tema";

type Menu = ReturnType<typeof menuAkun>;

/**
 * Kerangka dasbor: sidebar (desktop) atau laci (HP), bilah atas berisi tema dan menu pengguna.
 * `menu` null = kata sandi wajib diganti dulu, jadi navigasi disembunyikan.
 */
export function Kerangka({ menu, pengguna, children }: { menu: Menu | null; pengguna: InfoPengguna; children: React.ReactNode }) {
  const [laci, setLaci] = useState(false);
  const path = usePathname();
  const reduce = useReducedMotion();

  // Tutup laci setelah pindah halaman.
  useEffect(() => setLaci(false), [path]);

  useEffect(() => {
    if (!laci) return;
    const tutup = (e: KeyboardEvent) => e.key === "Escape" && setLaci(false);
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [laci]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border lg:flex">
        <Merek />
        {menu ? <Navigasi menu={menu} path={path} idSorot="sorot-desktop" /> : <div className="flex-1" />}
      </aside>

      <AnimatePresence>
        {laci && menu ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLaci(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background"
              initial={reduce ? { opacity: 0 } : { x: "-100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="flex items-center justify-between pr-3">
                <Merek />
                <button
                  type="button"
                  onClick={() => setLaci(false)}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Tutup menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Navigasi menu={menu} path={path} idSorot="sorot-laci" />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          {menu ? (
            <button
              type="button"
              onClick={() => setLaci(true)}
              className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Buka menu"
              aria-expanded={laci}
            >
              <Menu className="size-5" />
            </button>
          ) : null}
          <span className="text-sm font-medium lg:hidden">{NAMA_APLIKASI}</span>
          <div className="ml-auto flex items-center gap-1">
            <TombolTema />
            <MenuPengguna pengguna={pengguna} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function Merek() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground">eB</span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{NAMA_APLIKASI}</span>
        <span className="text-xs text-muted-foreground">{LEMBAGA_SINGKAT}</span>
      </span>
    </Link>
  );
}

function Navigasi({ menu, path, idSorot }: { menu: Menu; path: string; idSorot: string }) {
  return (
    <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 pb-6">
      <ul className="flex flex-col gap-0.5">
        <ButirNav butir={menu.beranda} aktif={menuAktif(path, menu.beranda.href)} idSorot={idSorot} />
      </ul>
      {menu.kelompok.map((k) => (
        <div key={k.label} className="mt-5">
          <p className="px-3 pb-1.5 text-xs text-muted-foreground">{k.label}</p>
          <ul className="flex flex-col gap-0.5">
            {k.butir.map((b) => (
              <ButirNav key={b.href} butir={b} aktif={menuAktif(path, b.href)} idSorot={idSorot} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ButirNav({ butir, aktif, idSorot }: { butir: ButirMenu; aktif: boolean; idSorot: string }) {
  const Ikon = IKON_MENU[butir.ikon];
  return (
    <li>
      <Link
        href={butir.href}
        aria-current={aktif ? "page" : undefined}
        className={cn(
          "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
          aktif ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {aktif ? (
          <motion.span
            layoutId={idSorot}
            className="absolute inset-0 rounded-lg bg-muted"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        ) : null}
        <Ikon className="relative size-4 shrink-0" aria-hidden />
        <span className="relative truncate">{butir.label}</span>
      </Link>
    </li>
  );
}
