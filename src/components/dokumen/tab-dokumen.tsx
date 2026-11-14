"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ExternalLink, Upload } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatTanggalId } from "@/lib/sesi";
import { JALUR_PENDAFTARAN } from "@/lib/dokumen-peserta";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { kirimBerkas } from "@/lib/unggah";
import { cn } from "@/lib/utils";
import type { BarisDokumenJadwal, DokumenJadwalRecord, ItemDokumen } from "@/lib/server/repositories/dokumen-peserta";

const NADA: Record<string, BadgeTone> = { BELUM: "neutral", DIUNGGAH: "info", DITERIMA: "success", DITOLAK: "danger" };

/**
 * Tab Dokumen (keputusan 14 Okt 2026, sama dengan aplikasi lama): penyelenggara pemegang diklat mewajibkan dokumen (batas
 * bawaan H-7), memeriksa berkas (terima / tolak dengan alasan), mengubah jalur pendaftaran, dan mengunggahkan atas nama
 * peserta. Setiap pembukaan berkas dicatat di Log Audit. Data sensitif: tanpa unduhan massal.
 */
export function TabDokumen({ awal }: { awal: DokumenJadwalRecord }) {
  const [data, setData] = useState(awal);
  const [batas, setBatas] = useState(awal.batas ?? awal.batasBawaan);
  const [buka, setBuka] = useState<string | null>(null);
  const [tolak, setTolak] = useState<{ dokumenId: string; alasan: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const url = `/api/training/${encodeURIComponent(data.training.id)}/dokumen`;
  const aktif = data.peserta.filter((p) => p.status === "AKTIF");

  async function muat() {
    const r = await ambilJson<DokumenJadwalRecord>(url);
    if (r.ok) setData(r.data);
  }
  async function aksi(body: Record<string, unknown>) {
    setSibuk(true);
    setGalat("");
    const res = await kirimJson(url, "POST", body);
    setSibuk(false);
    if (!res.ok) {
      setGalat(res.error);
      return false;
    }
    await muat();
    return true;
  }
  async function unggahkan(b: BarisDokumenJadwal, it: ItemDokumen, f: File | undefined) {
    if (!f) return;
    setSibuk(true);
    setGalat("");
    const res = await kirimBerkas(`${url}/unggah`, "dokumen", { pesertaId: b.pesertaId, jenis: it.jenis }, f);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    await muat();
  }
  async function kirimTolak(e: FormEvent) {
    e.preventDefault();
    if (tolak && (await aksi({ aksi: "verifikasi", dokumenId: tolak.dokumenId, status: "DITOLAK", alasan: tolak.alasan.trim() }))) setTolak(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <h2 className="font-display text-lg font-medium">Dokumen persyaratan peserta</h2>
        {data.batas ? (
          <p className="text-sm text-muted-foreground">
            Wajib untuk jadwal ini, batas unggah <span className="font-mono">{formatTanggalId(data.batas)}</span>. Pre/post-test dan evaluasi peserta terkunci sampai semua
            berkasnya diterima. <span className="font-mono">{data.lengkap}</span> dari <span className="font-mono">{aktif.length}</span> peserta aktif lengkap ·{" "}
            <span className="font-mono">{data.menungguDiperiksa}</span> berkas menunggu diperiksa.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum diwajibkan. Setelah diwajibkan, peserta mengunggah berkasnya di ruang belajar, dan pre/post-test serta evaluasi terkunci sampai semua berkas diterima.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <Input label="Batas unggah" type="date" value={batas} onChange={setBatas} />
          </div>
          <Button size="sm" variant="secondary" disabled={sibuk || !batas} onClick={() => aksi({ aksi: "batas", tanggal: batas })}>
            {data.batas ? "Ubah batas" : "Wajibkan dokumen"}
          </Button>
          {data.batas ? (
            <Button size="sm" variant="ghost" disabled={sibuk} onClick={() => aksi({ aksi: "batas", tanggal: null })}>
              Tidak wajib
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Bawaan H-7: <span className="font-mono">{formatTanggalId(data.batasBawaan)}</span>
          </span>
        </div>
      </section>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data.peserta.length ? (
        <EmptyState title="Belum ada peserta" description="Tambahkan peserta di tab Peserta." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.peserta.map((b) => (
            <li key={b.pesertaId} className={cn("rounded-2xl border border-border p-3", b.status !== "AKTIF" && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 font-mono text-xs text-muted-foreground">{b.nomor}</span>
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {b.nama}
                  {b.status !== "AKTIF" ? " (tidak aktif)" : ""}
                </span>
                <span className={cn("font-mono text-xs", b.ringkas.lengkap ? "text-success" : "text-muted-foreground")}>
                  {b.ringkas.diterima.length}/{b.ringkas.wajib.length} diterima
                </span>
                {b.ringkas.menunggu.length ? (
                  <Badge size="sm" tone="info">
                    {b.ringkas.menunggu.length} menunggu
                  </Badge>
                ) : null}
                {b.ringkas.ditolak.length ? (
                  <Badge size="sm" tone="danger">
                    {b.ringkas.ditolak.length} ditolak
                  </Badge>
                ) : null}
                <select
                  aria-label={`Jalur pendaftaran ${b.nama}`}
                  value={b.jalur}
                  disabled={sibuk}
                  onChange={(e) => aksi({ aksi: "jalur", pesertaId: b.pesertaId, jalur: e.target.value })}
                  className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
                >
                  {JALUR_PENDAFTARAN.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" aria-expanded={buka === b.pesertaId} onClick={() => setBuka(buka === b.pesertaId ? null : b.pesertaId)}>
                  Berkas <ChevronDown size={14} className={cn("transition-transform", buka === b.pesertaId && "rotate-180")} />
                </Button>
              </div>
              {buka === b.pesertaId ? (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {b.item.map((it) => (
                    <li key={it.jenis} className="rounded-xl bg-muted/50 p-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1">
                          {it.label}
                          {it.sensitif ? <span className="ml-1 text-[11px] text-warning">sensitif</span> : null}
                          {it.jenis === "PAKTA_INTEGRITAS" ? (
                            <a className="ml-2 text-xs text-primary underline" href={`/cetak/pakta-integritas/${encodeURIComponent(b.pesertaId)}`} target="_blank" rel="noopener">
                              cetak Formulir 1
                            </a>
                          ) : null}
                        </span>
                        <Badge size="sm" tone={NADA[it.status] ?? "neutral"}>
                          {it.labelStatus}
                        </Badge>
                        {it.dokumen ? (
                          <>
                            <ButtonLink size="sm" variant="ghost" href={`${url}/${encodeURIComponent(it.dokumen.id)}`} target="_blank" rel="noopener">
                              <ExternalLink size={14} /> Buka
                            </ButtonLink>
                            {it.status !== "DITERIMA" ? (
                              <Button size="sm" variant="secondary" disabled={sibuk} onClick={() => aksi({ aksi: "verifikasi", dokumenId: it.dokumen!.id, status: "DITERIMA" })}>
                                Terima
                              </Button>
                            ) : null}
                            {it.status !== "DITOLAK" ? (
                              <Button size="sm" variant="ghost" disabled={sibuk} onClick={() => setTolak({ dokumenId: it.dokumen!.id, alasan: "" })}>
                                Tolak
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <Upload size={13} /> unggahkan
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={sibuk}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              unggahkan(b, it, f);
                            }}
                          />
                        </label>
                      </div>
                      {it.status === "DITOLAK" && it.dokumen?.alasan ? <p className="mt-1 text-xs text-destructive">Alasan: {it.dokumen.alasan}</p> : null}
                      {tolak && it.dokumen && tolak.dokumenId === it.dokumen.id ? (
                        <form onSubmit={kirimTolak} className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="min-w-64 flex-1">
                            <Input label="Alasan penolakan (dilihat peserta)" value={tolak.alasan} onChange={(v) => setTolak({ ...tolak, alasan: v })} maxLength={300} />
                          </div>
                          <Button type="submit" size="sm" disabled={sibuk || !tolak.alasan.trim()}>
                            Tolak berkas
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setTolak(null)}>
                            Batal
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
