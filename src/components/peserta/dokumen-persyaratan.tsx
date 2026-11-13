"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Printer, RefreshCw, Upload } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { DokumenPesertaRecord, ItemDokumen } from "@/lib/server/repositories/dokumen-peserta";

const NADA: Record<string, BadgeTone> = { BELUM: "neutral", DIUNGGAH: "info", DITERIMA: "success", DITOLAK: "danger" };
const MAKS = 2 * 1024 * 1024;
const terima = (it: ItemDokumen) => it.format.map((f) => (f === "application/pdf" ? ".pdf" : f === "image/png" ? ".png" : ".jpg,.jpeg")).join(",");
const ukuran = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Dokumen persyaratan peserta PKA/PKP (keputusan 14 Okt 2026), sama dengan aplikasi lama: unggah tiap berkas
 * (PDF/JPG/PNG, maks 2 MB), lihat status pemeriksaan dan alasan penolakan, pakai berkas yang sudah diterima di
 * diklat sebelumnya. Pre/post-test dan evaluasi terbuka setelah semua berkas wajib diterima.
 */
export function DokumenPersyaratan({ pesertaId, data }: { pesertaId: string; data: DokumenPesertaRecord }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const base = `/api/belajar/${encodeURIComponent(pesertaId)}/dokumen`;
  const r = data.ringkas;

  async function unggah(it: ItemDokumen, berkas: File) {
    setGalat((g) => ({ ...g, [it.jenis]: "" }));
    if (berkas.size > MAKS) return setGalat((g) => ({ ...g, [it.jenis]: "Ukuran berkas maksimal 2 MB" }));
    const form = new FormData();
    form.set("jenis", it.jenis);
    form.set("berkas", berkas);
    setSibuk(it.jenis);
    const res = await fetch(base, { method: "POST", body: form })
      .then((x) => x.json() as Promise<{ ok: boolean; error?: string }>)
      .catch(() => ({ ok: false, error: "Tidak bisa terhubung ke server. Periksa koneksi Anda." }));
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [it.jenis]: res.error ?? "Gagal mengunggah" }));
    setToast(`${it.label} terunggah, menunggu diperiksa penyelenggara.`);
    router.refresh();
  }

  async function pakaiLama(it: ItemDokumen) {
    if (!it.berkasLama) return;
    setGalat((g) => ({ ...g, [it.jenis]: "" }));
    setSibuk(it.jenis);
    const res = await kirimJson(`${base}/salin`, "POST", { jenis: it.jenis, dokumenId: it.berkasLama.dokumenId });
    setSibuk(null);
    if (!res.ok) return setGalat((g) => ({ ...g, [it.jenis]: res.error }));
    setToast(`${it.label} dari diklat sebelumnya dipakai, menunggu diperiksa penyelenggara.`);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`/dashboard/belajar/${pesertaId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Ruang belajar
      </Link>
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">Dokumen Persyaratan</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.training.name}</p>

      <section className="mt-6 rounded-2xl border border-border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm">
            <span className="font-display text-2xl">{r.diterima.length}</span> <span className="text-muted-foreground">dari {r.wajib.length} berkas diterima</span>
          </p>
          {r.lengkap ? (
            <Badge tone="success" dot>
              Lengkap
            </Badge>
          ) : null}
        </div>
        <Progress className="mt-3" value={r.diterima.length} max={Math.max(1, r.wajib.length)} aria-label="Berkas diterima" />
        <p className="mt-3 text-xs text-muted-foreground">
          Format PDF, JPG, atau PNG, maksimal 2 MB. Berkas hanya dilihat penyelenggara diklat.
          {data.batas ? (
            <>
              {" "}
              Batas unggah <span className="text-foreground">{formatTanggalId(data.batas)}</span>
              {r.lewatBatas ? <span className="text-destructive"> (sudah lewat, hubungi penyelenggara)</span> : r.sisaHari !== null ? ` (${r.sisaHari} hari lagi)` : ""}.
            </>
          ) : null}
        </p>
      </section>

      <ul className="mt-4 flex flex-col gap-3">
        {data.item.map((it) => (
          <BarisDokumen
            key={it.jenis}
            it={it}
            pesertaId={pesertaId}
            unduh={it.dokumen ? `${base}/${encodeURIComponent(it.dokumen.id)}` : null}
            sibuk={sibuk}
            galat={galat[it.jenis] ?? ""}
            onUnggah={(f) => unggah(it, f)}
            onPakaiLama={() => pakaiLama(it)}
          />
        ))}
      </ul>
      <Toast title="Dokumen" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function BarisDokumen({
  it,
  pesertaId,
  unduh,
  sibuk,
  galat,
  onUnggah,
  onPakaiLama,
}: {
  it: ItemDokumen;
  pesertaId: string;
  unduh: string | null;
  sibuk: string | null;
  galat: string;
  onUnggah: (f: File) => void;
  onPakaiLama: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const diterima = it.status === "DITERIMA";
  return (
    <li className={cn("rounded-2xl border p-4", it.status === "DITOLAK" ? "border-destructive/40" : "border-border")}>
      <div className="flex items-start gap-3">
        {diterima ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{it.label}</p>
            <Badge size="sm" tone={NADA[it.status] ?? "neutral"}>
              {it.labelStatus}
            </Badge>
          </div>
          {it.keterangan ? <p className="mt-0.5 text-xs text-muted-foreground">{it.keterangan}</p> : null}
          {it.jenis === "PAKTA_INTEGRITAS" ? (
            <a
              href={`/cetak/pakta-integritas/${encodeURIComponent(pesertaId)}`}
              target="_blank"
              rel="noopener"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Printer size={12} /> Cetak Formulir 1 (identitas sudah terisi), tanda tangani di atas materai, lalu unggah
            </a>
          ) : null}
          {it.dokumen && unduh ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              <a href={unduh} target="_blank" rel="noopener" className="text-primary hover:underline">
                {it.dokumen.namaBerkas}
              </a>{" "}
              · <span className="font-mono">{ukuran(it.dokumen.ukuran)}</span>
            </p>
          ) : null}
          {it.status === "DITOLAK" && it.dokumen?.alasan ? <p className="mt-1.5 text-xs text-destructive">Ditolak: {it.dokumen.alasan}</p> : null}
          {it.berkasLama ? (
            <div className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
              Sudah pernah diterima di <span className="text-foreground">{it.berkasLama.dari}</span> ({it.berkasLama.namaBerkas}).
              <button type="button" disabled={!!sibuk} onClick={onPakaiLama} className="ml-1 inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
                <RefreshCw size={12} /> Pakai berkas ini
              </button>
            </div>
          ) : null}
          {galat ? (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {galat}
            </p>
          ) : null}
        </div>
        {!diterima ? (
          <>
            <input
              ref={input}
              type="file"
              accept={terima(it)}
              className="sr-only"
              aria-label={`Unggah ${it.label}`}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) onUnggah(f);
              }}
            />
            <Button size="sm" variant={it.dokumen ? "secondary" : "primary"} disabled={!!sibuk} onClick={() => input.current?.click()}>
              <Upload size={14} /> {sibuk === it.jenis ? "Mengunggah…" : it.dokumen ? "Ganti" : "Unggah"}
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
