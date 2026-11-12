"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ganti tema terang/gelap; pilihan disimpan di perangkat ini. */
export function TombolTema({ className }: { className?: string }) {
  const [gelap, setGelap] = useState<boolean | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    setGelap(document.documentElement.classList.contains("dark"));
  }, []);

  function ganti() {
    const baru = !gelap;
    setGelap(baru);
    document.documentElement.classList.toggle("dark", baru);
    try {
      localStorage.setItem("tema", baru ? "gelap" : "terang");
    } catch {
      // Penyimpanan diblokir: tema tetap berganti untuk kunjungan ini.
    }
  }

  const label = gelap ? "Pakai tema terang" : "Pakai tema gelap";
  return (
    <button
      type="button"
      onClick={ganti}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-9 items-center justify-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={gelap ? "gelap" : "terang"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="flex"
        >
          {gelap ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
