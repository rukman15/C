"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JENIS_TUGAS, LABEL_BELUM, LABEL_STATUS_KIRIMAN, type StatusKiriman } from "@/lib/tugas";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { TugasDiklatRecord, TugasRecord } from "@/lib/server/repositories/tugas";

export const NADA_KIRIMAN: Record<string, BadgeTone> = { BELUM: "neutral", DRAF: "neutral", DIKIRIM: "warning", DITINJAU: "info", PERLU_REVISI: "danger", DITERIMA: "success" };
const URUT_REKAP: (StatusKiriman | "BELUM")[] = ["DIKIRIM", "DITINJAU", "PERLU_REVISI", "DITERIMA", "DRAF", "BELUM"];
const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";

/**
 * Tab Tugas (EB-038, sama dengan aplikasi lama): pengelola membuat Rancangan Aksi Perubahan, laporan progres, dan tugas
 * pembelajaran; pengampu membuat tugas pembelajaran mata pelatihannya. Rekap status kiriman per tugas; tinjauan dibuka di
 * halaman Tinjau Tugas. Status tinjauan tidak mengubah nilai.
 */
export function TabTugas({ awal }: { awal: TugasDiklatRecord }) {
  const [data, setData] = useState(awal);
  const [form, setForm] = useState<TugasRecord | "baru" | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const url = `/api/training/${encodeURIComponent(data.training.id)}/tugas`;
  const bolehBuat = data.bolehKelola || data.mataPelatihanSaya.length > 0;

  async function hapus(t: TugasRecord) {
    if (!window.confirm(`Hapus tugas "${t.judul}"? Hanya bisa bila belum ada peserta yang mengirim.`)) return;
    const res = await kirimJson<TugasDiklatRecord>(`${url}?tugasId=${encodeURIComponent(t.id)}`, "DELETE");
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setGalat("");
    setToast("Tugas dihapus.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tugas yang diunggah peserta dan ditinjau coach, mentor, atau pengampu. Status tinjauan tidak mengubah nilai; nilai tetap diisi di tab Penilaian.
        </p>
        {bolehBuat ? (
          <Button onClick={() => setForm("baru")}>
            <Plus size={16} /> Tambah tugas
          </Button>
        ) : null}
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data.tugas.length ? (
        <EmptyState title="Belum ada tugas" description="Tugas untuk angkatan ini akan tampil di sini, lengkap dengan rekap kiriman peserta." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.tugas.map((t) => {
            const terkirim = t.kiriman.filter((k) => k.status !== "DRAF");
            return (
              <li key={t.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-primary">
                      {t.jenisLabel}
                      {t.mataPelatihanNama ? ` · ${t.mataPelatihanNama}` : ""}
                    </p>
                    <h2 className="font-display text-lg font-medium">{t.judul}</h2>
                    {t.tenggat ? (
                      <p className="text-xs text-muted-foreground">
                        Tenggat <span className="font-mono">{formatTanggalId(t.tenggat)}</span>
                      </p>
                    ) : null}
                    {t.petunjuk ? <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{t.petunjuk}</p> : null}
                  </div>
                  {t.bolehUbah ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Ubah ${t.judul}`} onClick={() => setForm(t)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Hapus ${t.judul}`} onClick={() => hapus(t)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {URUT_REKAP.filter((s) => t.rekap[s]).map((s) => (
                    <Badge key={s} size="sm" tone={NADA_KIRIMAN[s]}>
                      {s === "BELUM" ? LABEL_BELUM : LABEL_STATUS_KIRIMAN[s]} <span className="font-mono">{t.rekap[s]}</span>
                    </Badge>
                  ))}
                </div>
                {terkirim.length ? (
                  <>
                    <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => setBuka(buka === t.id ? null : t.id)}>
                      {buka === t.id ? "Sembunyikan kiriman" : `Lihat ${terkirim.length} kiriman`}
                    </button>
                    {buka === t.id ? (
                      <ul className="mt-2 divide-y divide-border border-t border-border">
                        {terkirim.map((k) => (
                          <li key={k.id} className="flex items-center gap-3 py-2 text-sm">
                            <span className="w-6 font-mono text-xs text-muted-foreground">{k.nomor}</span>
                            <span className="min-w-0 flex-1 truncate">{k.pesertaNama}</span>
                            <Badge size="sm" tone={NADA_KIRIMAN[k.status] ?? "neutral"}>
                              {k.statusLabel}
                            </Badge>
                            <Link href={`/dashboard/tinjau-tugas/${encodeURIComponent(k.id)}`} className="text-xs text-primary hover:underline">
                              Buka
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent title={form === "baru" ? "Tugas baru" : "Ubah tugas"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {form ? (
            <FormTugas
              key={form === "baru" ? "baru" : form.id}
              url={url}
              data={data}
              tugas={form === "baru" ? null : form}
              onSelesai={(baru, pesan) => {
                setForm(null);
                if (baru) setData(baru);
                if (pesan) setToast(pesan);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Toast title="Tugas" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormTugas({
  url,
  data,
  tugas,
  onSelesai,
}: {
  url: string;
  data: TugasDiklatRecord;
  tugas: TugasRecord | null;
  onSelesai: (data: TugasDiklatRecord | null, pesan: string) => void;
}) {
  const pengampuSaja = !data.bolehKelola;
  const pilihanJenis = pengampuSaja ? JENIS_TUGAS.filter((j) => j.kode === "TUGAS_PEMBELAJARAN") : JENIS_TUGAS;
  const pilihanMp = pengampuSaja ? data.pilihanMataPelatihan.filter((m) => data.mataPelatihanSaya.includes(m.kode)) : data.pilihanMataPelatihan;
  const [jenis, setJenis] = useState<string>(tugas?.jenis ?? (pengampuSaja ? "TUGAS_PEMBELAJARAN" : "RANCANGAN_AKSI"));
  const [judul, setJudul] = useState(tugas?.judul ?? "");
  const [petunjuk, setPetunjuk] = useState(tugas?.petunjuk ?? "");
  const [tenggat, setTenggat] = useState(tugas?.tenggat ?? "");
  const [mp, setMp] = useState(tugas?.mataPelatihan ?? "");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!judul.trim()) return setGalat("Judul wajib diisi");
    if (jenis === "TUGAS_PEMBELAJARAN" && !mp) return setGalat("Pilih mata pelatihan");
    setSibuk(true);
    setGalat("");
    const isian = { jenis, judul: judul.trim(), petunjuk: petunjuk.trim() || null, tenggat: tenggat || null, mataPelatihan: jenis === "TUGAS_PEMBELAJARAN" ? mp || null : null };
    const res = tugas ? await kirimJson<TugasDiklatRecord>(url, "PATCH", { id: tugas.id, ...isian }) : await kirimJson<TugasDiklatRecord>(url, "POST", isian);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    onSelesai(res.data, tugas ? "Tugas diperbarui." : "Tugas dibuat. Peserta melihatnya di Ruang Belajar → Tugas.");
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Jenis tugas" value={jenis} onValueChange={setJenis} options={pilihanJenis.map((j) => ({ value: j.kode, label: j.label }))} />
        <Input label="Tenggat (opsional)" type="date" value={tenggat} onChange={setTenggat} />
      </div>
      {jenis === "TUGAS_PEMBELAJARAN" ? (
        <Select
          label="Mata pelatihan"
          placeholder="Pilih mata pelatihan"
          value={mp || undefined}
          onValueChange={setMp}
          options={pilihanMp.map((m) => ({ value: m.kode, label: m.nama }))}
        />
      ) : null}
      <Input label="Judul" value={judul} onChange={setJudul} maxLength={160} placeholder="Rancangan Aksi Perubahan (draf untuk seminar RAP)" />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Petunjuk (opsional)</span>
        <textarea
          value={petunjuk}
          onChange={(e) => setPetunjuk(e.target.value)}
          rows={3}
          maxLength={2000}
          className={AREA}
          placeholder="Format, isi minimal, dan hal yang akan ditinjau."
        />
      </label>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai(null, "")}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
