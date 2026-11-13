"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, FileCheck2, Folder, GraduationCap, Presentation, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { UKURAN_MAKS_BERKAS, terimaBerkas } from "@/lib/berkas-peserta";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { ItemBerkas } from "@/lib/server/repositories/berkas-peserta";
import type { RuangBelajarRecord } from "@/lib/server/types";
import { kirimBerkas } from "@/lib/unggah";

export type RingkasTugasWi = { jumlah: number; perlu: number; diterima: number } | null;

const ukuran = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/**
 * Folder peserta (EB-051): empat folder di ruang belajar. Persyaratan dan Tugas dari WI menautkan ke halamannya;
 * Bahan tayang RAP/LAP dan Sertifikat self learning diunggah langsung di sini (maks 20 MB, bisa diganti/dihapus).
 */
export function FolderPeserta({
  pesertaId,
  pratinjau,
  dokumen,
  tugasWi,
  berkas,
}: {
  pesertaId: string;
  pratinjau: boolean;
  dokumen: RuangBelajarRecord["dokumen"];
  tugasWi: RingkasTugasWi;
  berkas: ItemBerkas[];
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const base = `/api/belajar/${encodeURIComponent(pesertaId)}/berkas`;
  const bahan = berkas.filter((b) => b.jenis !== "SERTIFIKAT_MANDIRI");
  const sertifikat = berkas.filter((b) => b.jenis === "SERTIFIKAT_MANDIRI");

  async function unggah(it: ItemBerkas, f: File) {
    setGalat((g) => ({ ...g, [it.jenis]: "" }));
    if (f.size > UKURAN_MAKS_BERKAS) return setGalat((g) => ({ ...g, [it.jenis]: "Ukuran berkas maksimal 20 MB." }));
    setSibuk(it.jenis);
    const res = await kirimBerkas(base, "berkas-peserta", { jenis: it.jenis }, f);
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [it.jenis]: res.error ?? "Gagal mengunggah" }));
    setToast(`${it.label} tersimpan.`);
    router.refresh();
  }

  async function hapus(it: ItemBerkas) {
    if (!it.berkas || !window.confirm(`Hapus ${it.label.toLowerCase()} "${it.berkas.namaBerkas}"?`)) return;
    setSibuk(it.jenis);
    const res = await kirimJson(`${base}/${encodeURIComponent(it.berkas.id)}`, "DELETE");
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [it.jenis]: res.error }));
    router.refresh();
  }

  const slot = (it: ItemBerkas) => (
    <SlotBerkas
      key={it.jenis}
      it={it}
      unduh={it.berkas ? `${base}/${encodeURIComponent(it.berkas.id)}` : null}
      pratinjau={pratinjau}
      sibuk={sibuk}
      galat={galat[it.jenis] ?? ""}
      onUnggah={(f) => unggah(it, f)}
      onHapus={() => hapus(it)}
    />
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <KartuFolder ikon={FileCheck2} judul="Persyaratan" keterangan="Dokumen persyaratan pelatihan yang diperiksa penyelenggara.">
        {dokumen ? (
          <Link href={`/dashboard/belajar/${pesertaId}/dokumen`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
            {dokumen.terkunci ? (
              <span className="flex-1 text-sm">
                <span className="font-mono">{dokumen.kurang}</span> berkas belum diterima
                {dokumen.ditolak ? <span className="text-destructive"> · {dokumen.ditolak} ditolak</span> : null}
              </span>
            ) : (
              <span className="flex flex-1 items-center gap-1.5 text-sm text-success">
                <CheckCircle2 size={16} /> Semua berkas diterima
              </span>
            )}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Jadwal ini tidak mewajibkan dokumen persyaratan.</p>
        )}
      </KartuFolder>

      <KartuFolder ikon={GraduationCap} judul="Tugas dari WI" keterangan="Tugas pembelajaran dari widyaiswara pengampu mata pelatihan.">
        {pratinjau ? (
          <p className="text-sm text-muted-foreground">Tugas dan kiriman peserta dibuka penyelenggara di Tinjau Tugas.</p>
        ) : tugasWi && tugasWi.jumlah ? (
          <Link href={`/dashboard/belajar/${pesertaId}/tugas#wi`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
            <span className="flex flex-1 flex-wrap items-center gap-2 text-sm">
              <span>
                <span className="font-mono">{tugasWi.jumlah}</span> tugas
              </span>
              {tugasWi.perlu ? (
                <Badge size="sm" tone="info">
                  {tugasWi.perlu} perlu dikerjakan
                </Badge>
              ) : null}
              {tugasWi.diterima ? (
                <Badge size="sm" tone="success">
                  {tugasWi.diterima} diterima
                </Badge>
              ) : null}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada tugas dari widyaiswara.</p>
        )}
      </KartuFolder>

      <KartuFolder ikon={Presentation} judul="Bahan tayang RAP & LAP" keterangan="Slide presentasi seminar. PPTX atau PDF, maks 20 MB; unggah ulang untuk mengganti.">
        <div className="flex flex-col gap-2">{bahan.map(slot)}</div>
      </KartuFolder>

      <KartuFolder ikon={Folder} judul="Sertifikat self learning" keterangan="Sertifikat dari SiBangkom LAN. PDF, JPG, atau PNG.">
        <div className="flex flex-col gap-2">{sertifikat.map(slot)}</div>
      </KartuFolder>
      <Toast title="Folder" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function KartuFolder({ ikon: Ikon, judul, keterangan, children }: { ikon: typeof Folder; judul: string; keterangan: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div className="flex items-start gap-3">
        <Ikon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-medium">{judul}</h2>
          <p className="text-xs text-muted-foreground">{keterangan}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SlotBerkas({
  it,
  unduh,
  pratinjau,
  sibuk,
  galat,
  onUnggah,
  onHapus,
}: {
  it: ItemBerkas;
  unduh: string | null;
  pratinjau: boolean;
  sibuk: string | null;
  galat: string;
  onUnggah: (f: File) => void;
  onHapus: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("rounded-xl border p-3", it.berkas ? "border-border" : "border-dashed border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">{it.label}</p>
        {!pratinjau ? (
          <>
            <input
              ref={input}
              type="file"
              accept={terimaBerkas(it.jenis)}
              className="sr-only"
              aria-label={`Unggah ${it.label}`}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) onUnggah(f);
              }}
            />
            <Button size="sm" variant={it.berkas ? "secondary" : "primary"} disabled={!!sibuk} onClick={() => input.current?.click()}>
              <Upload size={14} /> {sibuk === it.jenis ? "Mengunggah…" : it.berkas ? "Ganti" : "Unggah"}
            </Button>
          </>
        ) : null}
      </div>
      {it.berkas && unduh ? (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <a href={unduh} target="_blank" rel="noopener" className="min-w-0 truncate text-primary hover:underline">
            {it.berkas.namaBerkas}
          </a>
          <span className="shrink-0 font-mono">{ukuran(it.berkas.ukuran)}</span>
          <span className="shrink-0">· {tanggal(it.berkas.diunggahPada)}</span>
          {!pratinjau ? (
            <button type="button" disabled={!!sibuk} onClick={onHapus} aria-label={`Hapus ${it.label}`} className="ml-auto shrink-0 hover:text-destructive">
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{pratinjau ? "Belum diunggah." : it.keterangan}</p>
      )}
      {galat ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {galat}
        </p>
      ) : null}
    </div>
  );
}
