"use client";

import { useState } from "react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { formatTanggalId } from "@/lib/sesi";
import { BatangAspek } from "./batang";
import type { EvaluasiSayaRecord } from "@/lib/server/repositories/evaluasi";

/** Evaluasi Saya (WI): rekap penilaian peserta terhadap dirinya; tampil bila responden ≥ minimum, saran tanpa nama. */
export function EvaluasiSaya({ data }: { data: EvaluasiSayaRecord }) {
  const [rinci, setRinci] = useState<number | null>(null);
  if (!data.daftar.length) return <EmptyState title="Belum ada evaluasi" description="Hasil evaluasi peserta terhadap Anda akan tampil di sini." />;
  return (
    <div className="flex flex-col gap-2">
      {data.daftar.map((d, i) => (
        <section key={i} className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.training}</p>
              <p className="text-xs text-muted-foreground">
                {d.label}
                {d.keterangan ? ` · ${d.keterangan}` : ""} · mulai <span className="font-mono">{formatTanggalId(d.mulai)}</span>
              </p>
            </div>
            {d.tampil && d.rekap ? (
              <>
                <div className="text-right">
                  <p className="font-display font-mono text-2xl">{d.rekap.rata == null ? "—" : d.rekap.rata.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.labelKualifikasi} · <span className="font-mono">{d.responden}</span> responden
                  </p>
                </div>
                <button type="button" className="text-xs text-primary underline" onClick={() => setRinci(rinci === i ? null : i)}>
                  {rinci === i ? "tutup" : "rinci"}
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{d.responden}</span> responden — menunggu minimal <span className="font-mono">{data.minResponden}</span>
              </p>
            )}
          </div>
          {rinci === i && d.rekap ? (
            <div className="mt-3 rounded-xl bg-muted/50 p-3">
              {d.rekap.perAspek.map((a) => (
                <BatangAspek key={a.kode} nama={a.nama} rata={a.rata} />
              ))}
              {d.catatan.length ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">Saran peserta</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {d.catatan.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
