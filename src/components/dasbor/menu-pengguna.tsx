"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LogOut, MonitorSmartphone, UserRound } from "lucide-react";
import { kirimJson } from "@/lib/api-klien";
import { HALAMAN_AKUN } from "@/lib/akun";
import { inisial } from "@/lib/teks";

export type InfoPengguna = { nama: string; email: string; keterangan: string };

/** Tombol avatar yang membuka menu: akun, keluar, keluar dari semua perangkat. */
export function MenuPengguna({ pengguna }: { pengguna: InfoPengguna }) {
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const router = useRouter();
  const reduce = useReducedMotion();
  const idMenu = useId();
  const akar = useRef<HTMLDivElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buka) return;
    const klik = (e: PointerEvent) => {
      if (!akar.current?.contains(e.target as Node)) setBuka(false);
    };
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBuka(false);
        pemicu.current?.focus();
      }
    };
    document.addEventListener("pointerdown", klik);
    document.addEventListener("keydown", tombol);
    return () => {
      document.removeEventListener("pointerdown", klik);
      document.removeEventListener("keydown", tombol);
    };
  }, [buka]);

  async function keluar(semua: boolean) {
    setSibuk(true);
    const res = await kirimJson("/api/auth/session" + (semua ? "?semua=1" : ""), "DELETE");
    if (!res.ok && res.status !== 401) {
      setSibuk(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={akar} className="relative">
      <button
        ref={pemicu}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-controls={idMenu}
        className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 hover:bg-muted sm:pr-3"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {inisial(pengguna.nama)}
        </span>
        <span className="hidden max-w-40 truncate text-sm sm:block">{pengguna.nama}</span>
      </button>

      <AnimatePresence>
        {buka ? (
          <motion.div
            id={idMenu}
            role="menu"
            className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-border bg-background p-1.5 shadow-lg shadow-foreground/5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
          >
            <div className="px-3 pt-2 pb-3">
              <p className="truncate text-sm font-medium">{pengguna.nama}</p>
              <p className="truncate text-xs text-muted-foreground">{pengguna.keterangan}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{pengguna.email}</p>
            </div>
            <div className="h-px bg-border" />
            <Link role="menuitem" href={HALAMAN_AKUN} onClick={() => setBuka(false)} className={BUTIR}>
              <UserRound className="size-4" aria-hidden />
              Akun &amp; kata sandi
            </Link>
            <button role="menuitem" type="button" disabled={sibuk} onClick={() => keluar(false)} className={BUTIR}>
              <LogOut className="size-4" aria-hidden />
              Keluar
            </button>
            <button role="menuitem" type="button" disabled={sibuk} onClick={() => keluar(true)} className={BUTIR}>
              <MonitorSmartphone className="size-4" aria-hidden />
              Keluar dari semua perangkat
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const BUTIR =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";
