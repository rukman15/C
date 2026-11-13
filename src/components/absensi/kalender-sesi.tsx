"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geserBulan, gridBulan } from "@/lib/jadwal";
import { cn } from "@/lib/utils";

type SesiKalender = { id: string; tanggal: string; jamMulai?: string; kegiatan: string; jp: number; bentuk: string };

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
/** Warna per bentuk sesi, sama untuk pengelola dan peserta. */
export const WARNA_BENTUK: Record<string, string> = {
  SINKRON: "bg-primary/15 text-primary",
  ASINKRON: "bg-muted text-muted-foreground",
  MANDIRI: "bg-warning/15 text-warning",
  KLASIKAL: "bg-success/15 text-success",
  LAPANGAN: "bg-[var(--tone-violet)]/15 text-[var(--tone-violet)]",
};
const TITIK: Record<string, string> = {
  SINKRON: "bg-primary",
  ASINKRON: "bg-muted-foreground",
  MANDIRI: "bg-warning",
  KLASIKAL: "bg-success",
  LAPANGAN: "bg-[var(--tone-violet)]",
};
export const LABEL_PENDEK: Record<string, string> = { SINKRON: "Sync", ASINKRON: "Async", MANDIRI: "Mandiri", KLASIKAL: "Klasikal", LAPANGAN: "Stula" };

/**
 * Kalender bulanan sesi pembelajaran (revisi Tahap 3): tiap hari menampilkan sesi dengan warna bentuknya (Sync, Async,
 * Mandiri, Klasikal, Stula); Minggu dan hari di luar periode diredupkan. Mengetuk hari memilih tanggal itu.
 */
export function KalenderSesi({
  sesi,
  mulai,
  selesai,
  hariIni,
  dipilih,
  onPilih,
}: {
  sesi: SesiKalender[];
  mulai: string;
  selesai: string | null;
  hariIni: string;
  dipilih: string | null;
  onPilih: (tanggal: string) => void;
}) {
  const awal = (dipilih ?? (hariIni >= mulai && (!selesai || hariIni <= selesai) ? hariIni : mulai)).slice(0, 7);
  const [bulan, setBulan] = useState({ tahun: Number(awal.slice(0, 4)), bulan: Number(awal.slice(5, 7)) });
  const perHari = useMemo(() => {
    const m = new Map<string, SesiKalender[]>();
    for (const s of sesi) m.set(s.tanggal, [...(m.get(s.tanggal) ?? []), s]);
    return m;
  }, [sesi]);
  const sel = gridBulan(bulan.tahun, bulan.bulan);
  const kunciBulan = `${bulan.tahun}-${String(bulan.bulan).padStart(2, "0")}`;

  return (
    <section className="rounded-2xl border border-border p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button size="icon" variant="ghost" aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan.tahun, bulan.bulan, -1))}>
          <ChevronLeft size={16} />
        </Button>
        <h3 className="font-display text-base font-medium">
          {NAMA_BULAN[bulan.bulan - 1]} <span className="font-mono">{bulan.tahun}</span>
        </h3>
        <Button size="icon" variant="ghost" aria-label="Bulan berikutnya" onClick={() => setBulan(geserBulan(bulan.tahun, bulan.bulan, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {HARI.map((h) => (
          <div key={h} className="pb-1">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {sel.map((t, i) => {
          const isi = perHari.get(t) ?? [];
          const luarBulan = !t.startsWith(kunciBulan);
          const luarPeriode = t < mulai || (!!selesai && t > selesai);
          const minggu = i % 7 === 6;
          const jp = isi.reduce((n, s) => n + s.jp, 0);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onPilih(t)}
              aria-pressed={dipilih === t}
              aria-label={`${Number(t.slice(8))} ${NAMA_BULAN[Number(t.slice(5, 7)) - 1]}: ${isi.length ? `${isi.length} sesi, ${jp} JP` : "tanpa sesi"}`}
              className={cn(
                "flex min-h-14 flex-col gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-20 sm:p-1.5",
                dipilih === t ? "border-primary" : "border-transparent hover:border-border",
                (luarBulan || luarPeriode) && "opacity-40",
                minggu && !isi.length && "bg-destructive/5",
                t === hariIni && "bg-primary/5",
              )}
            >
              <span className={cn("font-mono text-[11px]", t === hariIni ? "text-primary" : minggu ? "text-destructive" : "text-muted-foreground")}>{Number(t.slice(8))}</span>
              {/* HP: titik warna; layar lebar: label bentuk + JP. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {[...new Set(isi.map((s) => s.bentuk))].map((b) => (
                  <span key={b} className={cn("size-1.5 rounded-full", TITIK[b] ?? "bg-muted-foreground")} />
                ))}
              </span>
              <span className="hidden flex-col gap-0.5 sm:flex">
                {[...new Map(isi.map((s) => [s.bentuk, s])).values()].slice(0, 3).map((s) => (
                  <span key={s.bentuk} className={cn("truncate rounded px-1 text-[10px] leading-4", WARNA_BENTUK[s.bentuk] ?? "bg-muted")}>
                    {LABEL_PENDEK[s.bentuk] ?? s.bentuk} <span className="font-mono">{isi.filter((x) => x.bentuk === s.bentuk).reduce((n, x) => n + x.jp, 0)}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {Object.entries(LABEL_PENDEK).map(([k, l]) => (
          <span key={k} className={cn("rounded px-1.5", WARNA_BENTUK[k])}>
            {l}
          </span>
        ))}
        <span className="rounded bg-destructive/5 px-1.5 text-destructive">Minggu/libur</span>
      </div>
    </section>
  );
}
