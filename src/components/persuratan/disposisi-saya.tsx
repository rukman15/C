"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { tanggalPanjang } from "@/lib/dokumen";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { DisposisiRecord } from "@/lib/server/repositories/surat-masuk";

export type DisposisiSaya = DisposisiRecord & { surat: { id: string; nomorAgenda: number; tahun: number; asal: string; hal: string; sifat: string } };
const LABEL: Record<string, string> = { BARU: "Baru", DIBACA: "Dibaca", SELESAI: "Selesai" };
const NADA: Record<string, BadgeTone> = { BARU: "warning", DIBACA: "info", SELESAI: "success" };

/** Disposisi untuk Saya (sama dengan aplikasi lama): tandai dibaca/selesai dengan catatan tindak lanjut, buka suratnya. */
export function DaftarDisposisiSaya({ daftar, hariIni }: { daftar: DisposisiSaya[]; hariIni: string }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const lewat = (d: DisposisiSaya) => d.status !== "SELESAI" && !!d.batasWaktu && d.batasWaktu < hariIni;
  const urut = [...daftar].sort((a, b) => Number(a.status === "SELESAI") - Number(b.status === "SELESAI") || (a.batasWaktu ?? "9999").localeCompare(b.batasWaktu ?? "9999"));
  const terbuka = daftar.filter((d) => d.status !== "SELESAI").length;

  async function tandai(d: DisposisiSaya, status: "DIBACA" | "SELESAI") {
    setGalat("");
    const res = await kirimJson(`/api/persuratan/disposisi/${encodeURIComponent(d.id)}`, "PATCH", { status, tindakLanjut: catatan[d.id] || d.tindakLanjut || null });
    if (!res.ok) return setGalat(res.error);
    setToast(status === "SELESAI" ? "Disposisi diselesaikan." : "Ditandai dibaca.");
    router.refresh();
  }

  if (!daftar.length) return <EmptyState title="Belum ada disposisi" description="Disposisi surat masuk untuk Anda akan tampil di sini." />;
  return (
    <section className="flex flex-col gap-3">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">{terbuka}</span> perlu ditindaklanjuti · <span className="font-mono">{daftar.length - terbuka}</span> selesai
      </p>
      <ul className="flex flex-col gap-3">
        {urut.map((d) => (
          <li key={d.id} className={cn("rounded-2xl border p-4", lewat(d) ? "border-destructive/50" : "border-border")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {d.surat.asal} — {d.surat.hal}
                </p>
                <p className="text-xs text-muted-foreground">
                  Agenda{" "}
                  <span className="font-mono">
                    {d.surat.nomorAgenda}/{d.surat.tahun}
                  </span>{" "}
                  · {d.surat.sifat} · dari {d.dariJabatan} · {tanggalPanjang(d.createdAt.slice(0, 10))}
                  {d.batasWaktu ? (
                    <span className={cn(lewat(d) && "text-destructive")}>
                      {" "}
                      · batas {tanggalPanjang(d.batasWaktu)}
                      {lewat(d) ? " (lewat)" : ""}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs">
                  {d.instruksi.join(", ") || "tanpa instruksi"}
                  {d.catatan ? ` — ${d.catatan}` : ""}
                </p>
              </div>
              <Badge size="sm" tone={NADA[d.status] ?? "neutral"}>
                {LABEL[d.status] ?? d.status}
              </Badge>
            </div>
            {d.status === "SELESAI" ? (
              <p className="mt-2 text-xs text-success">Tindak lanjut: {d.tindakLanjut}</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1">
                  <Input label="Catatan tindak lanjut" value={catatan[d.id] ?? ""} onChange={(v) => setCatatan((c) => ({ ...c, [d.id]: v }))} maxLength={500} />
                </div>
                <ButtonLink size="sm" variant="ghost" href={`/dashboard/persuratan/surat-masuk?tahun=${d.surat.tahun}&id=${encodeURIComponent(d.surat.id)}`}>
                  Buka surat
                </ButtonLink>
                {d.status === "BARU" ? (
                  <Button size="sm" variant="secondary" onClick={() => tandai(d, "DIBACA")}>
                    Tandai dibaca
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => tandai(d, "SELESAI")}>
                  Selesai
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Toast title="Disposisi" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </section>
  );
}
