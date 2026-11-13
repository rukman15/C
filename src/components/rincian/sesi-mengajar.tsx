"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { Drawer, DrawerContent, useDrawerItem } from "@/components/arc/drawer/drawer";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Progress } from "@/components/arc/progress/progress";
import { Badge } from "@/components/arc/badge/badge";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { dariIso, keIso } from "@/lib/jadwal";
import { formatTanggalId } from "@/lib/sesi";
import type { Pengampu, RincianDiklat } from "@/lib/rincian";

type Sesi = { id: string; tanggal: string; kegiatan: string; jp: number; tempat: string; keterangan?: string; diluarPeriode: boolean };

/** Sesi mengajar satu pengampu (Drawer Arc): daftar, tambah, hapus. Aturan JP dijaga server. */
export function SesiMengajar({ d, pengampu, bolehCatat, onTutup }: { d: RincianDiklat; pengampu: Pengampu | null; bolehCatat: boolean; onTutup: () => void }) {
  const p = useDrawerItem(pengampu);
  return (
    <Drawer open={!!pengampu} onOpenChange={(o) => !o && onTutup()}>
      <DrawerContent side="right" title="Sesi mengajar" description={p ? `${p.instructorName}${p.mataPelatihanNama ? ` · ${p.mataPelatihanNama}` : ""}` : undefined}>
        {p ? <Isi key={p.id} d={d} p={p} bolehCatat={bolehCatat} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Isi({ d, p, bolehCatat }: { d: RincianDiklat; p: Pengampu; bolehCatat: boolean }) {
  const router = useRouter();
  const [sesi, setSesi] = useState<Sesi[] | null>(null);
  const [galat, setGalat] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [kegiatan, setKegiatan] = useState(p.mataPelatihanNama ?? "");
  const [jp, setJp] = useState(0);
  const [tempat, setTempat] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    const r = await ambilJson<Sesi[]>(`/api/penugasan-wi/${encodeURIComponent(p.id)}/sesi`);
    if (r.ok) setSesi(r.data);
    else setGalat(r.error);
  }, [p.id]);
  useEffect(() => void muat(), [muat]);

  const terpakai = (sesi ?? []).reduce((n, s) => n + s.jp, 0);
  const sisa = Math.max(0, p.jp - terpakai);

  async function tambah(e: FormEvent) {
    e.preventDefault();
    if (!tanggal) return setGalat("Pilih tanggal sesi.");
    if (!kegiatan.trim()) return setGalat("Isi nama kegiatan.");
    if (jp < 1) return setGalat("Isi JP minimal 1.");
    setMenyimpan(true);
    setGalat("");
    const r = await kirimJson(`/api/penugasan-wi/${encodeURIComponent(p.id)}/sesi`, "POST", { sesi: [{ tanggal, kegiatan, jp, tempat: tempat.trim() || undefined }] });
    setMenyimpan(false);
    if (!r.ok) return setGalat(r.error);
    setTanggal("");
    setJp(0);
    await muat();
    router.refresh();
  }

  async function hapus(id: string) {
    setGalat("");
    const r = await kirimJson(`/api/penugasan-wi/${encodeURIComponent(p.id)}/sesi/${encodeURIComponent(id)}`, "DELETE");
    if (!r.ok) return setGalat(r.error);
    await muat();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted-foreground">JP tercatat</span>
          <span className="font-mono">
            {terpakai}/{p.jp} JP
          </span>
        </div>
        <Progress value={p.jp > 0 ? Math.min(100, Math.round((terpakai / p.jp) * 100)) : 0} aria-label="JP sesi tercatat" />
      </div>

      {sesi === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : sesi.length === 0 ? (
        <EmptyState title="Belum ada sesi" description="Sesi mengajar (tanggal dan JP per hari) belum dicatat." />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {sesi.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-start gap-3 rounded-2xl border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.kegiatan}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTanggalId(s.tanggal)} · {s.tempat}
                  </p>
                  {s.diluarPeriode ? (
                    <Badge size="sm" tone="warning" className="mt-1.5">
                      Di luar periode diklat
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-sm">{s.jp} JP</span>
                {bolehCatat ? (
                  <button
                    type="button"
                    onClick={() => hapus(s.id)}
                    aria-label={`Hapus sesi ${s.kegiatan} ${formatTanggalId(s.tanggal)}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {bolehCatat ? (
        <form onSubmit={tambah} noValidate className="flex flex-col gap-4 border-t border-border pt-5">
          <p className="text-sm font-medium">Catat sesi</p>
          <DatePicker label="Tanggal" locale="id-ID" placeholder="Pilih tanggal" value={dariIso(tanggal)} onChange={(x) => setTanggal(x ? keIso(x) : "")} showToday />
          <Input label="Kegiatan" maxLength={200} value={kegiatan} onChange={setKegiatan} />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="JP" value={jp} onValueChange={setJp} min={0} max={Math.max(1, Math.min(24, sisa))} suffix=" JP" locale="id-ID" />
            <Input label="Tempat" maxLength={120} placeholder={d.tempat} value={tempat} onChange={setTempat} />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Sisa JP yang bisa dicatat: <span className="font-mono">{sisa}</span>
          </p>
          {galat ? (
            <p role="alert" className="text-sm text-destructive">
              {galat}
            </p>
          ) : null}
          <Button type="submit" disabled={menyimpan || sisa === 0} className="self-start">
            {menyimpan ? "Menyimpan…" : "Simpan sesi"}
          </Button>
        </form>
      ) : galat ? (
        <p role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      ) : null}
    </div>
  );
}
