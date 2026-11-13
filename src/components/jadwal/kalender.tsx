"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NAMA_BULAN, akhirDiklat, diklatPadaTanggal, geserBulan, gridBulan, jalurMinggu, periodeTeks, type JadwalDiklat } from "@/lib/jadwal";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { WARNA_STATUS } from "./kartu-diklat";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MAKS_PER_HARI = 3;

/** Kalender bulanan: tiap hari menampilkan diklat yang berlangsung; pilih hari untuk melihat rinciannya. */
export function Kalender({ diklat, hariIni, onPilih }: { diklat: JadwalDiklat[]; hariIni: string; onPilih: (d: JadwalDiklat) => void }) {
  const reduce = useReducedMotion();
  const [bulan, setBulan] = useState(() => ({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) }));
  const [arah, setArah] = useState(0);
  const [hariDipilih, setHariDipilih] = useState(hariIni);

  const sel = useMemo(() => gridBulan(bulan.tahun, bulan.bulan), [bulan]);
  const kunciBulan = `${bulan.tahun}-${String(bulan.bulan).padStart(2, "0")}`;
  const padaHari = useMemo(() => diklatPadaTanggal(diklat, hariDipilih), [diklat, hariDipilih]);
  // Jalur per minggu: satu diklat tetap di baris yang sama sepanjang minggu.
  const jalur = useMemo(() => {
    const peta = new Map<string, (JadwalDiklat | null)[]>();
    for (let i = 0; i < sel.length; i += 7) {
      const minggu = sel.slice(i, i + 7);
      jalurMinggu(diklat, minggu).forEach((isi, j) => peta.set(minggu[j]!, isi));
    }
    return peta;
  }, [diklat, sel]);

  function geser(n: number) {
    setArah(n);
    setBulan((b) => geserBulan(b.tahun, b.bulan, n));
  }
  function keHariIni() {
    setArah(0);
    setBulan({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) });
    setHariDipilih(hariIni);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="rounded-2xl border border-border p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <h2 className="text-base font-medium" aria-live="polite">
            {NAMA_BULAN[bulan.bulan - 1]} <span className="font-mono text-muted-foreground">{bulan.tahun}</span>
          </h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={keHariIni} className="h-8 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              Hari ini
            </button>
            <button type="button" onClick={() => geser(-1)} aria-label="Bulan sebelumnya" className={TOMBOL_IKON}>
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => geser(1)} aria-label="Bulan berikutnya" className={TOMBOL_IKON}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {HARI.map((h) => (
            <div key={h} className="py-2">
              {h}
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={arah}>
            <motion.div
              key={kunciBulan}
              custom={arah}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: arah * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: arah * -40 }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
              className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border"
            >
              {sel.map((iso) => {
                const diBulan = iso.slice(0, 7) === kunciBulan;
                const isi = diklatPadaTanggal(diklat, iso);
                const dipilih = iso === hariDipilih;
                const hariIniKah = iso === hariIni;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setHariDipilih(iso)}
                    aria-pressed={dipilih}
                    aria-label={`${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]}${isi.length ? `, ${isi.length} diklat` : ""}`}
                    className={cn(
                      "relative flex min-h-16 flex-col items-stretch gap-1 bg-background p-1.5 text-left transition-colors sm:min-h-24",
                      diBulan ? "hover:bg-card" : "bg-card/60 text-muted-foreground/60",
                    )}
                  >
                    {dipilih ? <motion.span layoutId="kalender-pilih" className="absolute inset-0 rounded-[3px] ring-2 ring-primary ring-inset" transition={motionTokens.spring.morph} /> : null}
                    <span
                      className={cn(
                        "relative flex size-6 items-center justify-center self-end rounded-full font-mono text-xs",
                        hariIniKah && "bg-primary text-primary-foreground",
                      )}
                    >
                      {Number(iso.slice(8))}
                    </span>
                    <span className="relative hidden flex-col gap-0.5 sm:flex">
                      {(jalur.get(iso) ?? []).slice(0, MAKS_PER_HARI).map((d, j) => {
                        if (!d) return <span key={`kosong-${j}`} className="h-[18px]" aria-hidden />;
                        const senin = new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
                        const minggu = new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
                        const awalBatang = d.startDate === iso || senin;
                        const akhirBatang = akhirDiklat(d) === iso || minggu;
                        return (
                          <span
                            key={d.id}
                            title={d.name}
                            className={cn(
                              "h-[18px] truncate text-[11px] leading-[18px]",
                              WARNA_STATUS[d.status].blok,
                              awalBatang ? "ml-0 rounded-l-md pl-1.5" : "-ml-1.5 pl-3",
                              akhirBatang ? "mr-0 rounded-r-md" : "-mr-1.5",
                            )}
                          >
                            {awalBatang ? d.name : "\u00a0"}
                          </span>
                        );
                      })}
                      {isi.length > (jalur.get(iso) ?? []).slice(0, MAKS_PER_HARI).filter(Boolean).length ? (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{isi.length - (jalur.get(iso) ?? []).slice(0, MAKS_PER_HARI).filter(Boolean).length} lagi
                        </span>
                      ) : null}
                    </span>
                    {/* HP: titik saja */}
                    <span className="relative flex justify-center gap-0.5 sm:hidden">
                      {isi.slice(0, 3).map((d) => (
                        <span key={d.id} className={cn("size-1.5 rounded-full", WARNA_STATUS[d.status].titik)} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <aside aria-live="polite">
        <h3 className="mb-3 text-sm text-muted-foreground">
          {Number(hariDipilih.slice(8))} {NAMA_BULAN[Number(hariDipilih.slice(5, 7)) - 1]} {hariDipilih.slice(0, 4)}
          {hariDipilih === hariIni ? " · hari ini" : ""}
        </h3>
        <AnimatePresence mode="popLayout" initial={false}>
          {padaHari.length === 0 ? (
            <motion.p
              key={`kosong-${hariDipilih}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
            >
              Tidak ada diklat pada hari ini.
            </motion.p>
          ) : (
            <motion.ul key={hariDipilih} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              {padaHari.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onPilih(d)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-card"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", WARNA_STATUS[d.status].titik)} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {periodeTeks(d.startDate, d.endDate)} · {d.tempat}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(Object.keys(WARNA_STATUS) as JadwalDiklat["status"][]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", WARNA_STATUS[s].titik)} aria-hidden />
              {WARNA_STATUS[s].label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

const TOMBOL_IKON = "flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";
