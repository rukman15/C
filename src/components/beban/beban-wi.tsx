"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Drawer, DrawerContent, useDrawerItem } from "@/components/arc/drawer/drawer";
import { Select } from "@/components/arc/select/select";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JENJANG_WI, geserBulan, labelBulan, periodeSurat, tanggalPanjang, type JenjangWi } from "@/lib/dokumen";
import {
  inisial,
  kelompokJenjang,
  panjangBar,
  ringkasBeban,
  ronaNama,
  saringUrut,
  statusBeban,
  type BebanWiRecord,
  type PeriodeBeban,
  type StatusBeban,
  type UrutBeban,
} from "@/lib/beban-wi";
import { ambilJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { RincianBebanWiRecord } from "@/lib/server/repositories/beban-wi";

const WARNA: Record<StatusBeban, { bar: string; teks: string; label: string }> = {
  lewat: { bar: "bg-destructive", teks: "text-destructive", label: "Lewat batas" },
  dekat: { bar: "bg-warning", teks: "text-warning", label: "Mendekati batas" },
  aman: { bar: "bg-success", teks: "text-success", label: "Aman" },
  "tanpa-batas": { bar: "bg-primary", teks: "text-muted-foreground", label: "Batas belum diatur" },
};

function Avatar({ nama, besar }: { nama: string; besar?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full text-xs font-medium", besar ? "h-11 w-11" : "h-9 w-9")}
      style={{ background: `hsl(${ronaNama(nama)} 65% 50% / 0.16)` }}
    >
      {inisial(nama)}
    </span>
  );
}

/**
 * Beban JP Widyaiswara, sama dengan aplikasi lama: ringkasan, satu baris per WI dengan bar beban, dikelompokkan per jenjang,
 * bisa dicari/disaring/diurutkan per periode. Batas JP berlaku PER BULAN; warna selalu dari JP bulan terpilih.
 */
export function BebanWi({ hariIni, isAdmin }: { hariIni: string; isAdmin: boolean }) {
  const [periode, setPeriode] = useState<PeriodeBeban>("tahun");
  const [bulan, setBulan] = useState(hariIni.slice(0, 7));
  const [cari, setCari] = useState("");
  const [jenjang, setJenjang] = useState<JenjangWi | "semua">("semua");
  const [urut, setUrut] = useState<UrutBeban>("jenjang");
  const [list, setList] = useState<BebanWiRecord[] | null>(null);
  const [galat, setGalat] = useState("");
  const [dipilih, setDipilih] = useState<BebanWiRecord | null>(null);

  useEffect(() => {
    let batal = false;
    ambilJson<BebanWiRecord[]>(`/api/wi/beban?${new URLSearchParams({ periode, bulan })}`).then((r) => {
      if (batal) return;
      if (r.ok) {
        setList(r.data);
        setGalat("");
      } else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [periode, bulan]);

  const tampil = useMemo(() => (list ? saringUrut(list, { cari, jenjang, urut }) : []), [list, cari, jenjang, urut]);
  const kelompok = urut === "jenjang" ? kelompokJenjang(tampil) : [{ jenjang: null, label: "", isi: tampil }];
  const ringkas = list ? ringkasBeban(list) : null;
  const tertinggi = Math.max(0, ...tampil.map((w) => w.jpPeriode));
  const labelPeriode = periode === "bulan" ? labelBulan(bulan) : periode === "tahun" ? `tahun ${bulan.slice(0, 4)}` : "seluruh waktu";
  const langkah = periode === "bulan" ? 1 : 12;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">JP dari penugasan yang disetujui · {labelPeriode}</p>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Periode"
            value={periode}
            onValueChange={(v) => setPeriode(v as PeriodeBeban)}
            options={[
              { value: "bulan", label: "Bulan" },
              { value: "tahun", label: "Tahun" },
              { value: "semua", label: "Semua" },
            ]}
          />
          {periode !== "semua" ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label={periode === "bulan" ? "Bulan sebelumnya" : "Tahun sebelumnya"} onClick={() => setBulan(geserBulan(bulan, -langkah))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="min-w-28 text-center font-mono text-sm">{periode === "bulan" ? labelBulan(bulan) : bulan.slice(0, 4)}</span>
              <Button size="sm" variant="ghost" aria-label={periode === "bulan" ? "Bulan berikutnya" : "Tahun berikutnya"} onClick={() => setBulan(geserBulan(bulan, langkah))}>
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {galat ? (
        <Alert tone="danger" title={galat} />
      ) : !list || !ringkas ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "WI aktif", v: ringkas.aktif, k: `dari ${list.length} WI` },
              { l: "Total JP", v: ringkas.totalJp, k: labelPeriode },
              { l: "Rata-rata per WI", v: ringkas.rataRata, k: "JP, WI aktif" },
              { l: "Perlu perhatian", v: ringkas.lewatBatas, k: `lewat batas bulanan · ${ringkas.belumDitugaskan} belum ditugaskan`, bahaya: true },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{x.l}</p>
                <p className={cn("mt-1 font-display text-2xl font-medium", x.bahaya && x.v > 0 && "text-destructive")}>{x.v.toLocaleString("id-ID")}</p>
                <p className="truncate text-xs text-muted-foreground">{x.k}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
            <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama WI…" leftIcon={<Search size={16} />} />
            <Select
              label="Jenjang"
              value={jenjang}
              onValueChange={(v) => setJenjang(v as JenjangWi | "semua")}
              options={[{ value: "semua", label: "Semua jenjang" }, ...JENJANG_WI.map((j) => ({ value: j.kode, label: j.label }))]}
            />
            <Select
              label="Urutan"
              value={urut}
              onValueChange={(v) => setUrut(v as UrutBeban)}
              options={[
                { value: "jenjang", label: "Kelompok jenjang" },
                { value: "tertinggi", label: "JP tertinggi" },
                { value: "terendah", label: "JP terendah" },
                { value: "nama", label: "Nama A–Z" },
              ]}
            />
          </div>

          {ringkas.totalJp === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Belum ada penugasan WI untuk {labelPeriode}. Beban akan muncul setelah pengampu ditetapkan di Rincian Diklat (menu{" "}
              <Link href="/dashboard/jadwal" className="underline">
                Jadwal Diklat
              </Link>
              ).
            </p>
          ) : null}

          {!tampil.length ? (
            <p className="text-sm text-muted-foreground">Tidak ada WI yang cocok.</p>
          ) : (
            kelompok.map((k) => (
              <section key={k.label || "semua"} className="overflow-hidden rounded-2xl border border-border">
                {k.label ? (
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <h2 className="text-sm font-medium text-muted-foreground">{k.label}</h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {k.isi.length} WI · {k.isi.reduce((a, w) => a + w.jpPeriode, 0)} JP
                    </span>
                  </div>
                ) : null}
                <ul className="divide-y divide-border">
                  {k.isi.map((w) => {
                    const st = statusBeban(w.jpBulan, w.jpMaksimal);
                    const pj = panjangBar(w, periode, tertinggi);
                    return (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => setDipilih(w)}
                          aria-label={`Rincian beban ${w.nama}`}
                          className="grid w-full grid-cols-[2.25rem_1fr] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 sm:grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,1fr)_7rem]"
                        >
                          <Avatar nama={w.nama} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{w.nama}</span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {w.jabatan}
                              {w.cuti ? (
                                <Badge size="sm" tone="warning">
                                  Cuti
                                </Badge>
                              ) : null}
                              {st === "lewat" ? (
                                <Badge size="sm" tone="danger">
                                  Lewat batas
                                </Badge>
                              ) : null}
                            </span>
                          </span>
                          <span className="col-span-2 flex items-center sm:col-span-1">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <span className={cn("block h-full rounded-full transition-[width]", WARNA[st].bar)} style={{ width: `${Math.round(pj * 100)}%` }} />
                            </span>
                          </span>
                          <span className="col-span-2 text-right text-sm sm:col-span-1">
                            {w.penugasanPeriode === 0 && w.jpPeriode === 0 ? (
                              <span className="text-xs text-muted-foreground">belum ditugaskan</span>
                            ) : (
                              <>
                                <span className="font-mono">{w.jpPeriode}</span>
                                <span className="font-mono text-xs text-muted-foreground">{periode === "bulan" && w.jpMaksimal ? ` / ${w.jpMaksimal}` : ""} JP</span>
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Batas JP WI berlaku per bulan. Warna bar: hijau aman, kuning ≥ 80% batas, merah lewat batas, dihitung untuk {labelBulan(bulan)}; biru berarti batas belum diatur.{" "}
            {periode === "bulan" ? "Panjang bar dibandingkan dengan batas bulanan WI (bila ada)." : "Panjang bar dibandingkan dengan JP tertinggi pada periode ini."}{" "}
            {isAdmin ? (
              <Link href="/dashboard/admin/aturan-jp" className="underline">
                Atur batas JP
              </Link>
            ) : null}
          </p>
        </>
      )}
      <PanelRincian wi={dipilih} bulan={bulan} onTutup={() => setDipilih(null)} />
    </div>
  );
}

function PanelRincian({ wi, bulan, onTutup }: { wi: BebanWiRecord | null; bulan: string; onTutup: () => void }) {
  const w = useDrawerItem(wi);
  const [rincian, setRincian] = useState<RincianBebanWiRecord | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    if (!wi) return;
    let batal = false;
    setRincian(null);
    setGalat("");
    ambilJson<RincianBebanWiRecord>(`/api/wi/${encodeURIComponent(wi.id)}/beban?bulan=${bulan}`).then((r) => {
      if (batal) return;
      if (r.ok) setRincian(r.data);
      else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [wi, bulan]);
  const st = w ? statusBeban(w.jpBulan, w.jpMaksimal) : "tanpa-batas";

  return (
    <Drawer open={!!wi} onOpenChange={(o) => !o && onTutup()}>
      <DrawerContent side="right" title={w?.nama ?? "Rincian beban"} description={w?.jabatan}>
        {w ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar nama={w.nama} besar />
              <p className="text-xs text-muted-foreground">
                Total penugasan disetujui sepanjang waktu: <span className="font-mono">{w.jpTotal}</span> JP
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">JP {labelBulan(bulan)}</p>
                <p className="font-mono text-lg">{w.jpBulan}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Batas / bulan</p>
                <p className="font-mono text-lg">{w.jpMaksimal || "–"}</p>
                {w.sumberBatas ? <p className="text-[10px] text-muted-foreground">{w.sumberBatas === "wi" ? "khusus WI ini" : "batas jenjang"}</p> : null}
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Status</p>
                <p className={cn("text-sm font-medium", WARNA[st].teks)}>{WARNA[st].label}</p>
              </div>
            </div>
            {galat ? (
              <Alert tone="danger" title={galat} />
            ) : !rincian ? (
              <p className="text-sm text-muted-foreground">Memuat…</p>
            ) : (
              <>
                <section>
                  <h3 className="text-sm font-medium">Sesi mengajar · {labelBulan(rincian.bulan)}</h3>
                  {!rincian.sesiBulan.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">Belum ada sesi dicatat.</p>
                  ) : (
                    <>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                        {rincian.sesiBulan.map((s) => (
                          <li key={s.id} className="flex justify-between gap-3">
                            <span className="min-w-0">
                              <span className="text-xs text-muted-foreground">{tanggalPanjang(s.tanggal)}</span>
                              <br />
                              {s.kegiatan}
                            </span>
                            <span className="shrink-0 font-mono">{s.jp} JP</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Jumlah <span className="font-mono">{rincian.sesiBulan.reduce((a, s) => a + s.jp, 0)}</span> JP
                      </p>
                    </>
                  )}
                </section>
                <section>
                  <h3 className="text-sm font-medium">Penugasan terbaru</h3>
                  {!rincian.penugasan.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">Belum ada penugasan.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {rincian.penugasan.map((p) => (
                        <li key={p.id} className="rounded-xl border border-border px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/dashboard/diklat/${encodeURIComponent(p.trainingId)}`} className="text-sm hover:underline">
                              {p.trainingName}
                            </Link>
                            <span className="shrink-0 font-mono text-sm">{p.jp} JP</span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {periodeSurat(p.mulai, p.selesai)}
                            {p.mataPelatihan ? ` · ${p.mataPelatihan}` : ""}
                            <Badge size="sm" tone={p.status === "disetujui" ? "success" : "warning"}>
                              {p.status === "disetujui" ? "Disetujui" : "Menunggu"}
                            </Badge>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
