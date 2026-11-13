"use client";

import { motion, useReducedMotion } from "motion/react";
import { MapPin, Users } from "lucide-react";
import { blokTanggal, kemajuan, periodeTeks, type JadwalDiklat } from "@/lib/jadwal";
import { labelKategori } from "@/lib/skema-training";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";

/** Nada Badge Arc per status. */
export const NADA_STATUS: Record<JadwalDiklat["status"], { tone: BadgeTone; label: string }> = {
  Berjalan: { tone: "success", label: "Berlangsung" },
  Terjadwal: { tone: "info", label: "Akan datang" },
  Selesai: { tone: "neutral", label: "Selesai" },
};

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
            <Badge size="sm" outline>
              {labelKategori(d.category)}
            </Badge>
            <span className={cn("text-xs", d.status === "Berjalan" ? "text-success" : "text-muted-foreground")}>{k.label}</span>
          </div>
          {k.persen !== null ? <Progress value={k.persen} aria-label={`Kemajuan ${d.name}`} className="mt-2" /> : null}
        </div>
      </motion.button>
    </motion.li>
  );
}
