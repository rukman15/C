"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { GERAK_SOROT } from "@/lib/gerak";
import { cn } from "@/lib/utils";

export type PilihanSegmen<T extends string> = { value: T; label: React.ReactNode; jumlah?: number };

/** Kontrol bersegmen dengan sorotan yang meluncur ke pilihan aktif. */
export function Segmen<T extends string>({
  pilihan,
  nilai,
  onPilih,
  label,
  className,
}: {
  pilihan: PilihanSegmen<T>[];
  nilai: T;
  onPilih: (v: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("tanpa-bilah inline-flex max-w-full overflow-x-auto rounded-full border border-border p-0.5", className)}>
      {pilihan.map((p) => {
        const aktif = p.value === nilai;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onPilih(p.value)}
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
              aktif ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aktif ? <motion.span layoutId={`segmen-${id}`} className="absolute inset-0 rounded-full bg-muted" transition={GERAK_SOROT} /> : null}
            <span className="relative">{p.label}</span>
            {p.jumlah !== undefined ? <span className="relative font-mono text-xs text-muted-foreground">{p.jumlah}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Deretan cip yang bisa dipilih (satu nilai). */
export function Cip<T extends string>({
  pilihan,
  nilai,
  onPilih,
  label,
  gulir = false,
}: {
  pilihan: { value: T; label: string }[];
  nilai: T;
  onPilih: (v: T) => void;
  label: string;
  /** Satu baris yang bisa digeser ke samping (bukan membungkus ke baris baru). */
  gulir?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1.5", gulir ? "tanpa-bilah -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" : "flex-wrap")}>
      {pilihan.map((p) => {
        const aktif = p.value === nilai;
        return (
          <motion.button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onPilih(p.value)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
              aktif ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {p.label}
          </motion.button>
        );
      })}
    </div>
  );
}
