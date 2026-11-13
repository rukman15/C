"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Search } from "lucide-react";
import { Drawer, DrawerContent, useDrawerItem } from "@/components/arc/drawer/drawer";
import { Badge } from "@/components/arc/badge/badge";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Button } from "@/components/ui/button";
import { LABEL_KEHADIRAN, STATUS_KEHADIRAN, labelBentuk, type StatusKehadiran } from "@/lib/kehadiran";
import { LABEL_STATUS_PESERTA } from "@/lib/peserta";
import { formatTanggalId } from "@/lib/sesi";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import { perubahanKehadiran, type LembarKehadiran, type SesiPembelajaran } from "@/lib/data-pembelajaran";
import { Galat } from "./form-sesi";

type Isian = Record<string, { status: StatusKehadiran | null; keterangan: string }>;

const GAYA: Record<StatusKehadiran, string> = {
  HADIR: "border-success/40 bg-success/12 text-success",
  TIDAK_HADIR: "border-destructive/40 bg-destructive/12 text-destructive",
  DISPENSASI: "border-warning/40 bg-warning/12 text-warning",
};
const PENDEK: Record<StatusKehadiran, string> = { HADIR: "Hadir", TIDAK_HADIR: "Tidak hadir", DISPENSASI: "Dispensasi" };

/**
 * Lembar kehadiran satu sesi (Drawer Arc). Sama dengan aplikasi lama: klik status yang aktif = kosongkan;
 * "tandai sisanya hadir"; hanya baris yang berubah yang dikirim; keterangan hanya untuk tidak hadir/dispensasi.
 * Lembar dengan perubahan belum disimpan tidak tertutup oleh klik di luar.
 */
export function LembarKehadiranLaci({ sesi, bolehAtur, onTutup, onTersimpan }: { sesi: SesiPembelajaran | null; bolehAtur: boolean; onTutup: () => void; onTersimpan: (pesan: string) => void }) {
  const s = useDrawerItem(sesi);
  const [kotor, setKotor] = useState(false);
  const tutup = () => {
    if (kotor && !window.confirm("Perubahan kehadiran belum disimpan. Tutup tanpa menyimpan?")) return;
    setKotor(false);
    onTutup();
  };
  return (
    <Drawer open={!!sesi} onOpenChange={(o) => !o && tutup()}>
      <DrawerContent
        side="right"
        title={s?.kegiatan ?? "Lembar kehadiran"}
        description={s ? `${formatTanggalId(s.tanggal)}${s.jamMulai ? ` · ${s.jamMulai}` : ""} · ${s.jp} JP · ${labelBentuk(s.bentuk)}` : undefined}
        className="sm:max-w-xl"
      >
        {s ? <Isi key={s.id} sesi={s} bolehAtur={bolehAtur} onKotor={setKotor} onTersimpan={(p) => (setKotor(false), onTersimpan(p))} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Isi({ sesi, bolehAtur, onKotor, onTersimpan }: { sesi: SesiPembelajaran; bolehAtur: boolean; onKotor: (k: boolean) => void; onTersimpan: (pesan: string) => void }) {
  const router = useRouter();
  const [lembar, setLembar] = useState<LembarKehadiran | null>(null);
  const [isian, setIsian] = useState<Isian>({});
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    ambilJson<LembarKehadiran>(`/api/pembelajaran/${encodeURIComponent(sesi.id)}/kehadiran`).then((r) => {
      if (!r.ok) return setGalat(r.error);
      setLembar(r.data);
      setIsian(Object.fromEntries(r.data.baris.map((b) => [b.pesertaId, { status: b.status, keterangan: b.keterangan ?? "" }])));
    });
  }, [sesi.id]);

  const perubahan = useMemo(() => (lembar ? perubahanKehadiran(lembar.baris, isian) : []), [lembar, isian]);
  useEffect(() => onKotor(perubahan.length > 0), [perubahan.length, onKotor]);

  const hitung = useMemo(() => {
    const h = { HADIR: 0, TIDAK_HADIR: 0, DISPENSASI: 0, belum: 0 };
    for (const b of lembar?.baris ?? []) {
      const st = isian[b.pesertaId]?.status ?? null;
      if (st === null) h.belum++;
      else h[st]++;
    }
    return h;
  }, [lembar, isian]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (lembar?.baris ?? []).filter((b) => !q || `${b.nama} ${b.instansi ?? ""}`.toLowerCase().includes(q));
  }, [lembar, cari]);

  const ubahBaris = (id: string, f: (x: Isian[string]) => Isian[string]) => setIsian((s) => (s[id] ? { ...s, [id]: f(s[id]) } : s));
  const pilih = (id: string, st: StatusKehadiran) => ubahBaris(id, (x) => ({ ...x, status: x.status === st ? null : st }));
  const semuaHadir = () => setIsian((s) => Object.fromEntries(Object.entries(s).map(([k, x]) => [k, x.status === null ? { ...x, status: "HADIR" as const } : x])));
  const kosongkan = () => setIsian((s) => Object.fromEntries(Object.entries(s).map(([k, x]) => [k, { ...x, status: null }])));

  async function simpan() {
    if (!perubahan.length) return;
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<LembarKehadiran>(`/api/pembelajaran/${encodeURIComponent(sesi.id)}/kehadiran`, "PUT", { kehadiran: perubahan });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onTersimpan(`Kehadiran "${res.data.sesi.kegiatan}" disimpan.`);
  }

  if (!lembar) {
    return galat ? (
      <Galat teks={galat} />
    ) : (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  const total = lembar.baris.length || 1;
  return (
    <div className="flex min-h-full flex-col gap-4">
      {!sesi.wajibHadir ? <p className="text-xs text-muted-foreground">Sesi {labelBentuk(sesi.bentuk).toLowerCase()}: dicatat, tetapi tidak dihitung dalam batas ketidakhadiran.</p> : null}
      <div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          {(["HADIR", "DISPENSASI", "TIDAK_HADIR"] as const).map((st) => (
            <motion.span key={st} className={cn("h-full", st === "HADIR" ? "bg-success" : st === "DISPENSASI" ? "bg-warning" : "bg-destructive")} animate={{ width: `${(hitung[st] / total) * 100}%` }} transition={{ type: "spring", stiffness: 300, damping: 32 }} />
          ))}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-mono text-success">{hitung.HADIR}</span> hadir
          </span>
          <span>
            <span className="font-mono text-destructive">{hitung.TIDAK_HADIR}</span> tidak hadir
          </span>
          <span>
            <span className="font-mono text-warning">{hitung.DISPENSASI}</span> dispensasi
          </span>
          <span>
            <span className="font-mono">{hitung.belum}</span> belum dicatat
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-9 min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Cari peserta</span>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari peserta" className="h-9 w-full rounded-full border border-border bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-border-strong" />
        </label>
        {bolehAtur ? (
          <>
            <Button size="sm" variant="secondary" disabled={hitung.belum === 0} onClick={semuaHadir}>
              <Check size={14} /> Sisanya hadir
            </Button>
            <Button size="sm" variant="ghost" disabled={hitung.belum === lembar.baris.length} onClick={kosongkan}>
              Kosongkan
            </Button>
          </>
        ) : null}
      </div>

      {lembar.baris.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada peserta aktif.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {tampil.map((b) => {
            const x = isian[b.pesertaId] ?? { status: null, keterangan: "" };
            const tidakAktif = b.statusPeserta !== "AKTIF";
            return (
              <li key={b.pesertaId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{b.nomor}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.nama}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.instansi ?? "–"}</p>
                  </div>
                  {tidakAktif ? (
                    <Badge size="sm" tone="warning">
                      {LABEL_STATUS_PESERTA[b.statusPeserta]}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 pl-9" role="radiogroup" aria-label={`Kehadiran ${b.nama}`}>
                  {STATUS_KEHADIRAN.map((st) => {
                    const aktif = x.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={aktif}
                        title={LABEL_KEHADIRAN[st]}
                        disabled={!bolehAtur || (tidakAktif && !b.status)}
                        onClick={() => pilih(b.pesertaId, st)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          aktif ? GAYA[st] : "border-border text-muted-foreground hover:bg-card",
                        )}
                      >
                        {PENDEK[st]}
                      </button>
                    );
                  })}
                  {!bolehAtur && !x.status ? <span className="self-center text-xs text-muted-foreground">Belum dicatat</span> : null}
                </div>
                {x.status === "TIDAK_HADIR" || x.status === "DISPENSASI" ? (
                  <input
                    value={x.keterangan}
                    onChange={(e) => ubahBaris(b.pesertaId, (y) => ({ ...y, keterangan: e.target.value }))}
                    disabled={!bolehAtur}
                    maxLength={200}
                    aria-label={`Keterangan ${b.nama}`}
                    placeholder="Keterangan (mis. sakit, surat izin)"
                    className="ml-9 h-8 rounded-full border border-border bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-border-strong disabled:opacity-70"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {bolehAtur ? (
        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-border bg-background pt-3 pb-1">
          <Galat teks={galat} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{perubahan.length ? <><span className="font-mono">{perubahan.length}</span> perubahan belum disimpan</> : "Tidak ada perubahan"}</p>
            <Button onClick={simpan} disabled={sibuk || perubahan.length === 0}>
              {sibuk ? "Menyimpan…" : "Simpan kehadiran"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
