import Link from "next/link";
import { Check, CheckCircle2, ChevronRight, Circle, Clock3, XCircle } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { labelMode } from "@/lib/kurikulum";
import { LABEL_STATUS_PESERTA } from "@/lib/peserta";
import { formatTanggalId } from "@/lib/sesi";
import { cn } from "@/lib/utils";
import type { StatusTugas } from "@/lib/beranda-peserta";
import type { DiklatSayaRecord, TrainingRecord } from "@/lib/server/types";

/** Bagian bersama halaman peserta (beranda, Diklat Saya, ruang belajar). Server component, tanpa state. */

export const NADA_STATUS_DIKLAT: Record<string, BadgeTone> = {
  Berjalan: "success",
  Terjadwal: "info",
  Selesai: "neutral",
};

export const periodeDiklat = (t: Pick<TrainingRecord, "startDate" | "endDate">) =>
  t.endDate ? `${formatTanggalId(t.startDate.slice(0, 10))} – ${formatTanggalId(t.endDate.slice(0, 10))}` : formatTanggalId(t.startDate.slice(0, 10));

export const labelProgram = (t: Pick<TrainingRecord, "jenisPelatihan" | "modePelatihan" | "angkatan">) =>
  t.jenisPelatihan ? [t.jenisPelatihan, t.modePelatihan ? labelMode(t.modePelatihan) : null, t.angkatan ? `Angkatan ${t.angkatan}` : null].filter(Boolean).join(" · ") : null;

const LABEL_TAHAP = {
  selesai: "Selesai",
  aktif: "Berlangsung",
  nanti: "Akan datang",
} as const;

/** Stepper tahapan kurikulum. `aktif` = indeks tahap berjalan (-1 belum mulai; = jumlah bila selesai). */
export function StepperTahap({ tahap, aktif }: { tahap: { label: string }[]; aktif: number }) {
  return (
    <ol className="-mx-1 flex overflow-x-auto px-1 pb-1" aria-label="Tahapan pelatihan">
      {tahap.map((t, i) => {
        const st = i < aktif ? "selesai" : i === aktif ? "aktif" : "nanti";
        return (
          <li key={i} className="relative flex min-w-[5.5rem] flex-1 flex-col items-center text-center" aria-current={st === "aktif" ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className={cn("absolute top-4 right-1/2 left-0 h-px", st === "nanti" ? "bg-border" : "bg-primary")} /> : null}
            {i < tahap.length - 1 ? <span aria-hidden className={cn("absolute top-4 right-0 left-1/2 h-px", i < aktif ? "bg-primary" : "bg-border")} /> : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border font-mono text-xs",
                st === "selesai" && "border-primary bg-primary text-primary-foreground",
                st === "aktif" && "border-primary bg-background text-primary ring-4 ring-primary/15",
                st === "nanti" && "border-border bg-background text-muted-foreground",
              )}
            >
              {st === "selesai" ? <Check size={14} /> : i + 1}
            </span>
            <span className={cn("mt-1.5 px-1 text-xs", st === "nanti" ? "text-muted-foreground" : "text-foreground")}>{t.label}</span>
            <span className={cn("text-[11px]", st === "aktif" ? "text-primary" : "text-muted-foreground")}>{LABEL_TAHAP[st]}</span>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS_TUGAS: Record<StatusTugas, { ikon: typeof Circle; kelas: string; label: string; nada: BadgeTone }> = {
  selesai: {
    ikon: CheckCircle2,
    kelas: "text-success",
    label: "Selesai",
    nada: "success",
  },
  perlu: {
    ikon: Circle,
    kelas: "text-primary",
    label: "Kerjakan",
    nada: "info",
  },
  nanti: {
    ikon: Clock3,
    kelas: "text-muted-foreground",
    label: "Nanti",
    nada: "neutral",
  },
  terlewat: {
    ikon: XCircle,
    kelas: "text-destructive",
    label: "Terlewat",
    nada: "danger",
  },
};

/** Checklist tugas peserta (dokumen, pre/post test, seminar, evaluasi). Butir yang perlu dikerjakan bisa diketuk. */
export function DaftarTugas({ tugas }: { tugas: DiklatSayaRecord["tugas"] }) {
  return (
    <ul className="divide-y divide-border">
      {tugas.map((t) => {
        const st = STATUS_TUGAS[t.status];
        const isi = (
          <>
            <st.ikon className={cn("size-5 shrink-0", st.kelas)} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.keterangan}</span>
            </span>
            <Badge size="sm" tone={st.nada}>
              {st.label}
            </Badge>
            {t.href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </>
        );
        return (
          <li key={t.kunci}>
            {t.href ? (
              <Link href={t.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/60">
                {isi}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-3">{isi}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const persenHari = (d: DiklatSayaRecord) => (d.hari ? Math.round((d.hari.ke / d.hari.total) * 100) : d.training.status === "Selesai" ? 100 : 0);

/** Kartu daftar pelatihan peserta dengan bilah kemajuan hari. */
export function DaftarPelatihan({ list }: { list: DiklatSayaRecord[] }) {
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Akun Anda belum terhubung ke daftar peserta diklat. Hubungi penyelenggara diklat bila Anda sudah terdaftar sebagai peserta.</p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((d) => {
        const p = persenHari(d);
        const program = labelProgram(d.training);
        return (
          <Link
            key={d.pesertaId}
            href={`/dashboard/belajar/${d.pesertaId}`}
            className="group flex flex-col gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-pretty">{d.training.name}</span>
              <Badge size="sm" tone={NADA_STATUS_DIKLAT[d.training.status] ?? "neutral"} dot>
                {d.training.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {program ? <span className="text-primary">{program} · </span> : null}
              {periodeDiklat(d.training)} · No. <span className="font-mono">{d.nomor}</span>
              {d.status !== "AKTIF" ? <span className="text-destructive"> · {LABEL_STATUS_PESERTA[d.status]}</span> : null}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan pelatihan">
              <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
            </div>
            <p className="flex justify-between text-[11px] text-muted-foreground">
              <span>{d.hari ? (d.hari.status === "belum" ? "Belum dimulai" : d.hari.status === "selesai" ? "Selesai" : `Hari ke-${d.hari.ke} dari ${d.hari.total}`) : ""}</span>
              <span>{d.kehadiranPersen !== null ? `Kehadiran ${d.kehadiranPersen}%` : ""}</span>
            </p>
          </Link>
        );
      })}
    </div>
  );
}
