"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import Toast from "@/components/arc/toast/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { ButirPemantauanRecord, PemantauanRecord } from "@/lib/server/repositories/formulir-penyelenggaraan";

const ISIAN = "h-8 w-full rounded-lg border border-border bg-transparent px-2 text-xs outline-none focus:border-primary";

/**
 * Tab Persiapan — Formulir 2 Daftar Pemantauan Persiapan Pelaksanaan Pelatihan (Pedoman KepKa LAN 2/2023), sama dengan
 * aplikasi lama: penyelenggara pemegang diklat mengisi jangka waktu, penanggung jawab, dan menandai selesai per butir;
 * pimpinan melihat. Cetak di /cetak/formulir-2/[id].
 */
export function TabPersiapan({ awal, bolehUbah }: { awal: PemantauanRecord; bolehUbah: boolean }) {
  const [data, setData] = useState(awal);
  const [ubahan, setUbahan] = useState<Record<string, ButirPemantauanRecord>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const jumlah = Object.keys(ubahan).length;
  const catat = (b: ButirPemantauanRecord) => setUbahan((u) => ({ ...u, [b.kode]: b }));

  useEffect(() => {
    const cegah = (e: BeforeUnloadEvent) => {
      if (jumlah) e.preventDefault();
    };
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [jumlah]);

  async function simpan() {
    setSibuk(true);
    setGalat("");
    const isian = Object.values(ubahan).map((b) => ({ kode: b.kode, jangkaWaktu: b.jangkaWaktu, penanggungJawab: b.penanggungJawab, selesai: b.selesai }));
    const res = await kirimJson<PemantauanRecord>(`/api/training/${encodeURIComponent(data.diklat.id)}/persiapan`, "PUT", { isian });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setUbahan({});
    setToast(`${isian.length} butir tersimpan.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
        <div>
          <h2 className="font-display text-lg font-medium">Formulir 2 — Daftar pemantauan persiapan pelaksanaan pelatihan</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{data.ringkas.selesai}</span> dari <span className="font-mono">{data.ringkas.total}</span> butir selesai.{" "}
            {data.ringkas.persiapanBelum.length ? `Persiapan yang belum: ${data.ringkas.persiapanBelum.length} butir.` : "Semua butir persiapan selesai."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink size="sm" variant="secondary" href={`/cetak/formulir-2/${data.diklat.id}`} target="_blank" rel="noopener">
            <Printer size={14} /> Cetak / PDF
          </ButtonLink>
          {bolehUbah ? (
            <Button size="sm" disabled={sibuk || !jumlah} onClick={simpan}>
              {sibuk ? "Menyimpan…" : jumlah ? `Simpan ${jumlah} perubahan` : "Tersimpan"}
            </Button>
          ) : null}
        </div>
      </section>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {data.bagian.map((s) => {
        const r = data.ringkas.perBagian.find((x) => x.kode === s.kode);
        return (
          <section key={s.kode} className="rounded-2xl border border-border p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">
                {s.kode}. {s.judul}
              </h3>
              <span className="text-xs text-muted-foreground">
                <span className="font-mono">
                  {r?.selesai ?? 0}/{r?.total ?? s.butir.length}
                </span>{" "}
                selesai
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-14 px-2 py-1.5 font-normal">No</th>
                    <th className="px-2 py-1.5 font-normal">Kegiatan</th>
                    <th className="w-40 px-2 py-1.5 font-normal">Jangka waktu</th>
                    <th className="w-44 px-2 py-1.5 font-normal">Penanggung jawab</th>
                    <th className="w-20 px-2 py-1.5 text-center font-normal">Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {s.butir.map((asli) => {
                    const b = ubahan[asli.kode] ?? asli;
                    return (
                      <tr key={b.kode} className={cn("border-b border-border align-top", ubahan[b.kode] && "bg-primary/5")}>
                        <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{b.kode}</td>
                        <td className="px-2 py-1.5">{b.teks}</td>
                        {bolehUbah ? (
                          <>
                            <td className="px-2 py-1.5">
                              <input
                                className={ISIAN}
                                value={b.jangkaWaktu}
                                maxLength={120}
                                aria-label={`Jangka waktu ${b.kode}`}
                                onChange={(e) => catat({ ...b, jangkaWaktu: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={ISIAN}
                                value={b.penanggungJawab}
                                maxLength={120}
                                aria-label={`Penanggung jawab ${b.kode}`}
                                onChange={(e) => catat({ ...b, penanggungJawab: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={b.selesai} aria-label={`Selesai ${b.kode}`} onChange={(e) => catat({ ...b, selesai: e.target.checked })} />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">{b.jangkaWaktu || "-"}</td>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">{b.penanggungJawab || "-"}</td>
                            <td className={cn("px-2 py-1.5 text-center text-xs", b.selesai ? "text-success" : "text-muted-foreground")}>{b.selesai ? "Selesai" : "Belum"}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <Toast title="Persiapan" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
