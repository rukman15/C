"use client";

import { motion, useReducedMotion } from "motion/react";
import { MapPin, Users } from "lucide-react";
import { blokTanggal, kemajuan, periodeTeks, type JadwalDiklat } from "@/lib/jadwal";
import { labelKategori } from "@/lib/skema-training";
import { cn } from "@/lib/utils";

export const WARNA_STATUS: Record<JadwalDiklat["status"], { titik: string; blok: string; label: string }> = {
  Berjalan: { titik: "bg-success", blok: "bg-success/12 text-success", label: "Berlangsung" },
  Terjadwal: { titik: "bg-primary", blok: "bg-primary/10 text-primary", label: "Akan datang" },
  Selesai: { titik: "bg-muted-foreground/50", blok: "bg-muted text-muted-foreground", label: "Selesai" },
};

/** Kartu satu diklat: blok tanggal, nama, periode, tempat, dan kemajuan (yang berlangsung). */
export function KartuDiklat({ diklat: d, hariIni, urutan, onPilih }: { diklat: JadwalDiklat; hariIni: string; urutan: number; onPilih: () => void }) {
  const reduce = useReducedMotion();
  const tgl = blokTanggal(d.startDate);
  const k = kemajuan(d, hariIni);
  const warna = WARNA_STATUS[d.status];

  return (
    <motion.li
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, delay: reduce ? 0 : Math.min(urutan, 8) * 0.03 }}
    >
      <motion.button
        type="button"
        onClick={onPilih}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="group flex h-full w-full gap-4 rounded-2xl border border-border p-4 text-left transition-colors hover:border-border-strong hover:bg-card"
        aria-label={`${d.name}, ${periodeTeks(d.startDate, d.endDate)}. Lihat rincian`}
      >
        <div className={cn("flex w-12 shrink-0 flex-col items-center justify-center self-start rounded-xl py-2", warna.blok)}>
          <span className="text-lg leading-none font-medium tabular-nums">{tgl.tgl}</span>
          <span className="mt-1 text-[11px] leading-none">{tgl.bln}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-2 text-sm font-medium text-pretty">{d.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{periodeTeks(d.startDate, d.endDate)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{d.tempat}</span>
            </span>
            {d.participants > 0 ? (
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                <span className="font-mono">{d.participants}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{labelKategori(d.category)}</span>
            <span className={cn("text-xs", d.status === "Berjalan" ? "text-success" : "text-muted-foreground")}>{k.label}</span>
          </div>
          {k.persen !== null ? <BilahKemajuan persen={k.persen} /> : null}
        </div>
      </motion.button>
    </motion.li>
  );
}

export function BilahKemajuan({ persen, className }: { persen: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("mt-2 h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full bg-success"
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${persen}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24, delay: 0.1 }}
      />
    </div>
  );
}
