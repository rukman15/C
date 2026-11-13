"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { GERAK_PANEL } from "@/lib/gerak";
import { cn } from "@/lib/utils";

/**
 * Panel modal: dari kanan di layar lebar, dari bawah di HP (`jenis="samping"`), atau di tengah
 * (`jenis="tengah"`). Esc menutup; fokus dipindah ke panel dan dikembalikan saat ditutup.
 * `tutupLuar=false`: klik di luar tidak menutup (form, supaya isian tidak hilang tak sengaja).
 */
export function Panel({
  buka,
  onTutup,
  judul,
  jenis = "samping",
  tutupLuar = true,
  lebar = "max-w-md",
  children,
}: {
  buka: boolean;
  onTutup: () => void;
  judul: string;
  jenis?: "samping" | "tengah";
  tutupLuar?: boolean;
  lebar?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const kotak = useRef<HTMLDivElement>(null);
  const sebelumnya = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!buka) return;
    sebelumnya.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => kotak.current?.focus(), 20);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
      sebelumnya.current?.focus?.();
    };
  }, [buka, onTutup]);

  if (typeof document === "undefined") return null;

  const samping = jenis === "samping";
  const awal = reduce ? { opacity: 0 } : samping ? { x: "100%" } : { opacity: 0, scale: 0.96, y: 8 };
  const akhir = reduce ? { opacity: 1 } : samping ? { x: 0 } : { opacity: 1, scale: 1, y: 0 };

  return createPortal(
    <AnimatePresence>
      {buka ? (
        <div className={cn("fixed inset-0 z-50 flex", samping ? "justify-end" : "items-end justify-center sm:items-center sm:p-4")}>
          <motion.div
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={tutupLuar ? onTutup : undefined}
          />
          <motion.div
            ref={kotak}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={judul}
            initial={awal}
            animate={akhir}
            exit={awal}
            transition={GERAK_PANEL}
            className={cn(
              "relative flex max-h-dvh w-full flex-col bg-background outline-none",
              samping ? cn("h-dvh border-l border-border", lebar) : cn("max-h-[92dvh] rounded-t-3xl border border-border sm:rounded-3xl", lebar),
            )}
          >
            <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
              <h2 className="text-lg font-medium">{judul}</h2>
              <button
                type="button"
                onClick={onTutup}
                aria-label="Tutup"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
