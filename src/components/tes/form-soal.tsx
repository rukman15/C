"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Select } from "@/components/arc/select/select";
import { Button } from "@/components/ui/button";
import { KISI, OPSI_MAKS, hurufOpsi, labelKisi, periksaSoal, type Kisi, type SoalInput } from "@/lib/tes";
import { cn } from "@/lib/utils";

export const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";
const ISIAN = "h-10 w-full rounded-full border border-border bg-transparent px-4 text-sm outline-none focus:border-border-strong";

/** Isian satu soal pilihan ganda (tambah / ubah): agenda, pertanyaan, pilihan A–E, kunci, pembahasan. C–E boleh kosong di belakang. */
export function FormSoal({
  awal,
  agenda = [],
  sibuk = false,
  labelSimpan = "Simpan soal",
  onSimpan,
  onBatal,
}: {
  awal?: SoalInput;
  agenda?: string[];
  sibuk?: boolean;
  labelSimpan?: string;
  onSimpan: (s: SoalInput) => void;
  onBatal?: () => void;
}) {
  const [kisi, setKisi] = useState<Kisi>(awal?.kisi ?? "I");
  const [pertanyaan, setPertanyaan] = useState(awal?.pertanyaan ?? "");
  const [opsi, setOpsi] = useState<string[]>(Array.from({ length: OPSI_MAKS }, (_, i) => awal?.opsi[i] ?? ""));
  const [kunci, setKunci] = useState(awal?.kunci ?? 0);
  const [pembahasan, setPembahasan] = useState(awal?.pembahasan ?? "");
  const [galat, setGalat] = useState("");

  function kirim(e: FormEvent) {
    e.preventDefault();
    const isi = opsi.map((o) => o.trim());
    while (isi.length && !isi[isi.length - 1]) isi.pop();
    const s: SoalInput = { kisi, pertanyaan: pertanyaan.trim(), opsi: isi, kunci, pembahasan: pembahasan.trim() || null };
    const g = periksaSoal(s) ?? "";
    setGalat(g);
    if (!g) onSimpan(s);
  }

  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-3">
      <Select label="Agenda / kisi-kisi" value={kisi} onValueChange={(v) => setKisi(v as Kisi)} options={KISI.map((k) => ({ value: k, label: labelKisi(k, agenda) }))} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Pertanyaan
        <textarea value={pertanyaan} onChange={(e) => setPertanyaan(e.target.value)} rows={3} maxLength={2000} className={cn(AREA, "font-normal")} />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Pilihan jawaban (pilih bulatan untuk kunci; C–E boleh kosong)</legend>
        {opsi.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="kunci" checked={kunci === i} onChange={() => setKunci(i)} disabled={!o.trim()} aria-label={`Kunci ${hurufOpsi(i)}`} />
            <span className={cn("w-4 font-mono text-sm", kunci === i ? "text-success" : "text-muted-foreground")}>{hurufOpsi(i)}</span>
            <input
              value={o}
              onChange={(e) => setOpsi((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={500}
              placeholder={i < 2 ? "wajib" : "opsional"}
              aria-label={`Pilihan ${hurufOpsi(i)}`}
              className={ISIAN}
            />
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Pembahasan (opsional, tidak tampil ke peserta)
        <textarea value={pembahasan} onChange={(e) => setPembahasan(e.target.value)} rows={2} maxLength={1000} className={cn(AREA, "font-normal")} />
      </label>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : labelSimpan}
        </Button>
        {onBatal ? (
          <Button type="button" size="sm" variant="ghost" onClick={onBatal}>
            Batal
          </Button>
        ) : null}
      </div>
    </form>
  );
}
