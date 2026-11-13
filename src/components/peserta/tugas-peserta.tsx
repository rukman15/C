"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Paperclip, Send, Upload } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { LABEL_BELUM, TERIMA_BERKAS_TUGAS, UKURAN_MAKS_TUGAS } from "@/lib/tugas";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { TugasPesertaRecord } from "@/lib/server/repositories/tugas";
import { kirimBerkas } from "@/lib/unggah";

const NADA: Record<string, BadgeTone> = { DRAF: "neutral", DIKIRIM: "warning", DITINJAU: "info", PERLU_REVISI: "danger", DITERIMA: "success" };
const AKSI: Record<string, string> = {
  KIRIM: "mengirim",
  MULAI_TINJAU: "mulai meninjau",
  REVISI: "meminta revisi",
  TERIMA: "menerima",
  CATATAN: "memberi catatan",
  SETUJU_MENTOR: "menyetujui isu & timeline",
};
const bolehUnggah = (s: string | undefined) => !s || s === "DRAF" || s === "PERLU_REVISI";
const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

type Tugas = TugasPesertaRecord["tugas"][number];

/**
 * Tugas peserta (EB-038), sama dengan aplikasi lama: unggah berkas (PDF/DOCX/XLSX/PPTX/JPG/PNG, maks 10 MB), kirim untuk
 * ditinjau, lalu baca catatan coach, mentor, atau pengampu. Setelah dikirim berkas terkunci sampai ditinjau; bila
 * diminta revisi, unggah berkas baru lalu kirim lagi.
 */
export function TugasPeserta({ pesertaId, awal }: { pesertaId: string; awal: TugasPesertaRecord }) {
  const [data, setData] = useState(awal);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ j: string; i: string } | null>(null);
  const url = `/api/belajar/${encodeURIComponent(pesertaId)}/tugas`;

  async function unggah(tugasId: string, berkas: File) {
    setGalat((g) => ({ ...g, [tugasId]: "" }));
    if (berkas.size > UKURAN_MAKS_TUGAS) return setGalat((g) => ({ ...g, [tugasId]: "Ukuran berkas maksimal 10 MB." }));
    setSibuk(tugasId);
    const res = await kirimBerkas<TugasPesertaRecord>(url, "tugas", { tugasId }, berkas);
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [tugasId]: res.error }));
    setData(res.data);
    setToast({ j: "Berkas tersimpan", i: "Tersimpan sebagai draf. Tekan Kirim bila sudah siap ditinjau." });
  }

  async function kirim(tugasId: string) {
    setGalat((g) => ({ ...g, [tugasId]: "" }));
    setSibuk(tugasId);
    const res = await kirimJson<TugasPesertaRecord>(url, "PATCH", { tugasId, aksi: "KIRIM" });
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [tugasId]: res.error }));
    setData(res.data);
    setToast({ j: "Tugas terkirim", i: "Peninjau akan memberi catatan di sini." });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`/dashboard/belajar/${pesertaId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Ruang belajar
      </Link>
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">Tugas</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.training.name}</p>
      {data.tugas.length === 0 ? (
        <EmptyState className="mt-8" title="Belum ada tugas" description="Tugas dari widyaiswara dan penyelenggara akan tampil di sini." />
      ) : (
        // Dua kelompok (EB-051): tugas pembelajaran dari WI pengampu, lalu tugas aksi perubahan (RAP, laporan progres).
        [
          { id: "wi", judul: "Tugas dari WI", isi: data.tugas.filter((t) => t.jenis === "TUGAS_PEMBELAJARAN") },
          { id: "aksi", judul: "Tugas aksi perubahan", isi: data.tugas.filter((t) => t.jenis !== "TUGAS_PEMBELAJARAN") },
        ]
          .filter((g) => g.isi.length)
          .map((g) => (
            <section key={g.id} id={g.id} className="mt-6 scroll-mt-20">
              <h2 className="mb-3 text-sm text-muted-foreground">
                {g.judul} · <span className="font-mono">{g.isi.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {g.isi.map((t) => (
                  <KartuTugas key={t.id} t={t} sibuk={sibuk} galat={galat[t.id] ?? ""} onUnggah={(f) => unggah(t.id, f)} onKirim={() => kirim(t.id)} />
                ))}
              </ul>
            </section>
          ))
      )}
      <Toast title={toast?.j ?? ""} description={toast?.i} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function KartuTugas({ t, sibuk, galat, onUnggah, onKirim }: { t: Tugas; sibuk: string | null; galat: string; onUnggah: (f: File) => void; onKirim: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const k = t.kiriman;
  return (
    <li className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {t.jenisLabel}
            {t.mataPelatihanNama ? ` · ${t.mataPelatihanNama}` : ""}
          </p>
          <h2 className="mt-0.5 font-medium text-pretty">{t.judul}</h2>
          {t.tenggat ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tenggat <span className="font-mono">{formatTanggalId(t.tenggat)}</span>
            </p>
          ) : null}
        </div>
        <Badge size="sm" tone={k ? (NADA[k.status] ?? "neutral") : "neutral"} dot>
          {k ? k.statusLabel : LABEL_BELUM}
        </Badge>
      </div>
      {t.petunjuk ? <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{t.petunjuk}</p> : null}
      {k?.berkasNama || k?.mentorSetuju ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {k?.berkasNama ? (
            <a
              href={`/api/tugas/kiriman/${encodeURIComponent(k.id)}/berkas`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Paperclip size={12} /> {k.berkasNama}
            </a>
          ) : null}
          {k && k.versi > 0 ? (
            <span className="text-muted-foreground">
              versi terkirim <span className="font-mono">{k.versi}</span>
            </span>
          ) : null}
          {k?.mentorSetuju ? (
            <Badge size="sm" tone="success">
              Isu & timeline disetujui mentor
            </Badge>
          ) : null}
        </div>
      ) : null}
      {bolehUnggah(k?.status) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={TERIMA_BERKAS_TUGAS}
            className="sr-only"
            aria-label={`Unggah berkas ${t.judul}`}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) onUnggah(f);
            }}
          />
          <Button size="sm" variant="secondary" disabled={sibuk !== null} onClick={() => input.current?.click()}>
            <Upload size={14} /> {sibuk === t.id ? "Mengunggah…" : k?.berkasNama ? "Ganti berkas" : "Unggah berkas"}
          </Button>
          {k?.berkasNama ? (
            <Button size="sm" disabled={sibuk !== null} onClick={onKirim}>
              <Send size={14} /> {k.status === "PERLU_REVISI" ? "Kirim revisi" : "Kirim untuk ditinjau"}
            </Button>
          ) : null}
          <span className="text-[11px] text-muted-foreground">PDF, DOCX, XLSX, PPTX, JPG, PNG · maks 10 MB</span>
        </div>
      ) : null}
      {galat ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {galat}
        </p>
      ) : null}
      {t.riwayat.length ? (
        <ol className="mt-4 flex flex-col gap-3 border-l border-border pl-4">
          {t.riwayat.map((r) => (
            <li key={r.id} className="relative text-xs">
              <span className="absolute top-1 -left-[1.3rem] size-2 rounded-full bg-border-strong" aria-hidden />
              <p>
                <span className="text-foreground">{r.atasNama ?? r.aktorNama}</span>{" "}
                <span className="text-muted-foreground">({r.peranAktor === "PENGELOLA" ? "dicatat penyelenggara" : r.peranLabel})</span> {AKSI[r.aksi] ?? r.aksi}
                {r.aksi === "KIRIM" ? ` versi ${r.versi}` : ""}
                <time dateTime={r.waktu} className="ml-2 font-mono text-muted-foreground">
                  {waktu(r.waktu)}
                </time>
              </p>
              {r.catatan ? <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">{r.catatan}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}
