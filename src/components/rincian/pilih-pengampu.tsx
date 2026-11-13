"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Select } from "@/components/arc/select/select";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { daftarMataPelatihan } from "@/lib/kurikulum";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { RincianDiklat } from "@/lib/rincian";

type Wi = { id: string; nama: string; jabatan: string; cuti: boolean; jpTerpakai: number; jpMaksimal: number | null };
type Bentrok = { trainingId: string; trainingName: string; status: "menunggu" | "disetujui"; periode: string; hariBentrok: number };

const URUTAN_JENJANG = ["UTAMA", "MADYA", "MUDA", "PERTAMA"];
const peringkat = (j: string) => {
  const i = URUTAN_JENJANG.findIndex((x) => j.toUpperCase().includes(x));
  return i === -1 ? 99 : i;
};

/**
 * Tetapkan pengampu (Dialog Arc). Sama dengan PilihPengampu aplikasi lama: WI dikelompokkan per jenjang
 * dengan beban JP bulan mulai diklat, pratinjau bentrok (peringatan), mata pelatihan, JP, catatan.
 * Aturan yang mencegah (cuti, bentrok surat tugas, kembar) dijaga server.
 */
export function PilihPengampu({ d, kodeMp, buka, onTutup, onTersimpan }: { d: RincianDiklat; kodeMp: string; buka: boolean; onTutup: () => void; onTersimpan: (pesan: string) => void }) {
  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        title="Tetapkan pengampu"
        description="Pengampu langsung berlaku begitu disimpan; formalitasnya surat tugas."
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-w-2xl"
      >
        {buka ? <Isi d={d} kodeMp={kodeMp} onTersimpan={onTersimpan} onBatal={onTutup} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Isi({ d, kodeMp, onTersimpan, onBatal }: { d: RincianDiklat; kodeMp: string; onTersimpan: (pesan: string) => void; onBatal: () => void }) {
  const router = useRouter();
  const bulan = d.startDate.slice(0, 7);
  const [wiList, setWiList] = useState<Wi[] | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState("");
  const mpPilihan = daftarMataPelatihan(d.jenisPelatihan);
  const [mp, setMp] = useState(mpPilihan.some((m) => m.kode === kodeMp) ? kodeMp : "");
  const [jp, setJp] = useState(0);
  const [catatan, setCatatan] = useState("");
  const [bentrok, setBentrok] = useState<Bentrok[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    ambilJson<Wi[]>(`/api/wi?bulan=${bulan}`).then((r) => (r.ok ? setWiList(r.data) : setGalat(r.error)));
  }, [bulan]);

  useEffect(() => {
    setBentrok([]);
    if (!pilih) return;
    let batal = false;
    ambilJson<Bentrok[]>(`/api/penugasan-wi/bentrokan?trainingId=${encodeURIComponent(d.id)}&instructorId=${encodeURIComponent(pilih)}`).then((r) => {
      if (!batal && r.ok) setBentrok(r.data);
    });
    return () => {
      batal = true;
    };
  }, [pilih, d.id]);

  const kelompok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const urut = (wiList ?? [])
      .filter((w) => !q || w.nama.toLowerCase().includes(q) || w.jabatan.toLowerCase().includes(q))
      .sort((a, b) => peringkat(a.jabatan) - peringkat(b.jabatan) || a.nama.localeCompare(b.nama, "id"));
    const peta = new Map<string, Wi[]>();
    for (const w of urut) peta.set(w.jabatan || "Lainnya", [...(peta.get(w.jabatan || "Lainnya") ?? []), w]);
    return [...peta];
  }, [wiList, cari]);

  const wi = wiList?.find((w) => w.id === pilih);
  const sisa = wi && wi.jpMaksimal !== null ? wi.jpMaksimal - wi.jpTerpakai : null;
  const melebihi = sisa !== null && jp > sisa;
  const jpDisetujui = d.penugasan.filter((p) => p.status === "disetujui").reduce((n, p) => n + p.jp, 0);
  const sisaKebutuhan = !d.jenisPelatihan && d.jpDibutuhkan > 0 ? Math.max(0, d.jpDibutuhkan - jpDisetujui) : 0;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!pilih) return setGalat("Pilih widyaiswara dulu.");
    if (jp < 1) return setGalat("Isi JP minimal 1.");
    setMenyimpan(true);
    setGalat("");
    const res = await kirimJson("/api/penugasan-wi", "POST", { trainingId: d.id, instructorId: pilih, jp, catatan: catatan.trim() || undefined, mataPelatihan: mp || null });
    setMenyimpan(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onTersimpan(`${wi?.nama ?? "Widyaiswara"} ditetapkan sebagai pengampu.`);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-5">
      <div>
        <label className="relative flex h-10 items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Cari widyaiswara</span>
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama atau jenjang"
            className="h-10 w-full rounded-full border border-border bg-transparent pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-border-strong"
          />
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">Beban JP dihitung untuk bulan mulai diklat.</p>
        <div role="radiogroup" aria-label="Widyaiswara" className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-border">
          {wiList === null ? (
            <div className="flex flex-col gap-2 p-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : kelompok.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada widyaiswara yang cocok.</p>
          ) : (
            kelompok.map(([jabatan, daftar]) => (
              <div key={jabatan}>
                <p className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">{jabatan}</p>
                {daftar.map((w) => {
                  const persen = w.jpMaksimal ? Math.min(100, Math.round((w.jpTerpakai / w.jpMaksimal) * 100)) : 0;
                  const aktif = w.id === pilih;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={aktif}
                      disabled={w.cuti}
                      onClick={() => {
                        setPilih(w.id);
                        setGalat("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50",
                        aktif ? "bg-primary/8" : "hover:bg-card",
                      )}
                    >
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", aktif ? "border-primary" : "border-border-strong")}>
                        {aktif ? <motion.span layoutId="wi-dipilih" className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{w.nama}</span>
                      {w.cuti ? (
                        <Badge size="sm" tone="warning">
                          Cuti
                        </Badge>
                      ) : (
                        <span className="flex w-28 shrink-0 flex-col items-end gap-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {w.jpTerpakai}
                            {w.jpMaksimal !== null ? `/${w.jpMaksimal}` : ""} JP
                          </span>
                          {w.jpMaksimal !== null ? (
                            <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <span className={cn("block h-full rounded-full", persen >= 100 ? "bg-destructive" : persen >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${persen}%` }} />
                            </span>
                          ) : null}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {bentrok.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert tone="warning" title="Jadwal beririsan dengan diklat lain">
              <ul className="mt-1 list-disc pl-4">
                {bentrok.map((b) => (
                  <li key={b.trainingId}>
                    {b.trainingName} ({b.periode}) · <span className="font-mono">{b.hariBentrok}</span> hari beririsan{b.status === "menunggu" ? " · pengajuan lama" : ""}
                  </li>
                ))}
              </ul>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2">
        {mpPilihan.length > 0 ? (
          <Select
            label="Mata pelatihan"
            placeholder="Pilih mata pelatihan"
            value={mp || undefined}
            onValueChange={setMp}
            options={mpPilihan.map((m) => ({ value: m.kode, label: m.nama }))}
          />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <NumberField label="JP" value={jp} onValueChange={setJp} min={0} max={10_000} suffix=" JP" locale="id-ID" />
          {sisaKebutuhan > 0 && jp !== sisaKebutuhan ? (
            <button type="button" onClick={() => setJp(sisaKebutuhan)} className="self-start text-xs text-primary hover:underline">
              Isi sisa kebutuhan: {sisaKebutuhan} JP
            </button>
          ) : null}
        </div>
      </div>
      {melebihi ? (
        <Alert tone="warning" title="Melebihi batas JP bulanan">
          Sisa JP widyaiswara ini bulan itu <span className="font-mono">{Math.max(0, sisa!)}</span> JP. Penugasan tetap bisa disimpan dan akan ditandai.
        </Alert>
      ) : null}
      <Input label="Catatan (opsional)" maxLength={500} value={catatan} onChange={setCatatan} placeholder="mis. bersama coach kelompok B" />

      {galat ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {galat}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
        <Button type="submit" disabled={menyimpan || !pilih}>
          {menyimpan ? "Menyimpan…" : "Tetapkan pengampu"}
        </Button>
      </div>
    </form>
  );
}
