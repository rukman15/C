"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Presentation } from "lucide-react";
import { periodeTeks, type JadwalMengajar } from "@/lib/jadwal";
import { formatTanggalId } from "@/lib/sesi";
import { cn } from "@/lib/utils";

/** Jadwal mengajar milik akun yang login: satu kartu per penugasan, bisa dibuka untuk melihat sesinya. */
export function JadwalMengajarSaya({ daftar, hariIni }: { daftar: JadwalMengajar[]; hariIni: string }) {
  const [buka, setBuka] = useState<string | null>(() => daftar.find((p) => p.sesi.some((s) => s.tanggal === hariIni))?.id ?? null);

  return (
    <section aria-labelledby="judul-mengajar" className="mb-10">
      <h2 id="judul-mengajar" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Presentation className="size-4" aria-hidden />
        Jadwal mengajar saya
        <span className="font-mono text-xs">{daftar.length}</span>
      </h2>
      <ul className="grid gap-3">
        {daftar.map((p) => (
          <KartuMengajar key={p.id} p={p} hariIni={hariIni} buka={buka === p.id} onAlih={() => setBuka((b) => (b === p.id ? null : p.id))} />
        ))}
      </ul>
    </section>
  );
}

function KartuMengajar({ p, hariIni, buka, onAlih }: { p: JadwalMengajar; hariIni: string; buka: boolean; onAlih: () => void }) {
  const reduce = useReducedMotion();
  const disetujui = p.status === "disetujui";
  const persen = p.jp > 0 ? Math.min(100, Math.round((p.jpSesi / p.jp) * 100)) : 0;
  const adaHariIni = p.sesi.some((s) => s.tanggal === hariIni);
  const idIsi = `mengajar-${p.id}`;

  return (
    <li className="overflow-hidden rounded-2xl border border-border">
      <button type="button" onClick={onAlih} aria-expanded={buka} aria-controls={idIsi} className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-card">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{p.trainingName}</p>
            {adaHariIni ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">mengajar hari ini</span> : null}
          </div>
          {p.mataPelatihanNama ? <p className="mt-0.5 text-sm text-muted-foreground">{p.mataPelatihanNama}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {periodeTeks(p.startDate, p.endDate)} · {p.tempat}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${persen}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 24 }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {p.jpSesi}/{p.jp} JP
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px]", disetujui ? "bg-success/12 text-success" : "bg-warning/15 text-warning")}>
            {disetujui ? "Disetujui" : "Menunggu persetujuan"}
          </span>
          <motion.span animate={{ rotate: buka ? 180 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="text-muted-foreground">
            <ChevronDown className="size-4" aria-hidden />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {buka ? (
          <motion.div
            id={idIsi}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{p.jp}</span> JP ditugaskan · <span className="font-mono">{p.jpSesi}</span> JP sudah dicatat dalam{" "}
                <span className="font-mono">{p.sesi.length}</span> sesi
              </p>
              {p.sesi.length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-normal">Tanggal</th>
                        <th className="px-3 py-2 font-normal">Kegiatan</th>
                        <th className="px-3 py-2 font-normal">JP</th>
                        <th className="px-3 py-2 font-normal">Tempat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.sesi.map((s) => (
                        <tr key={s.id} className={cn("border-t border-border align-top", s.tanggal === hariIni && "bg-primary/5")}>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {formatTanggalId(s.tanggal)}
                            {s.tanggal === hariIni ? <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">hari ini</span> : null}
                          </td>
                          <td className="px-3 py-2">{s.kegiatan}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{s.jp}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.tempat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : disetujui ? (
                <p className="mt-2 text-xs text-muted-foreground">Sesi mengajar (tanggal dan JP per hari) belum dicatat oleh tim diklat.</p>
              ) : null}
              {p.adaPenilaian && disetujui ? (
                <Link
                  href={`/dashboard/diklat/${encodeURIComponent(p.trainingId)}/penilaian`}
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
                >
                  Isi nilai peserta
                </Link>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
