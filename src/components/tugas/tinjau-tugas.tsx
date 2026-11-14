"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { BATAS_TUNGGU_HARI, LABEL_PERAN_PENINJAU, menungguTinjauan, type AksiPeninjau, type PeranPeninjau } from "@/lib/tugas";
import { formatTanggalId } from "@/lib/sesi";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { NADA_KIRIMAN } from "./tab-tugas";
import type { DaftarTinjau, DetailKirimanRecord } from "@/lib/server/repositories/tugas";

const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";
const tglPendek = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }) : "–");
const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Daftar Tinjau Tugas (EB-038): kiriman yang ditinjau akun ini sebagai coach/mentor/pengampu, atau semua di diklat yang dikelola. */
export function DaftarTinjauTugas({ awal }: { awal: DaftarTinjau }) {
  const [data, setData] = useState(awal);
  const [semua, setSemua] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    let batal = false;
    ambilJson<DaftarTinjau>(`/api/tugas/tinjau${semua ? "?semua=1" : ""}`).then((r) => {
      if (batal) return;
      if (r.ok) setData(r.data);
      else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [semua]);
  const sebagai = (peran: string[], pengelola: boolean) =>
    [...peran.map((x) => LABEL_PERAN_PENINJAU[x as keyof typeof LABEL_PERAN_PENINJAU] ?? x), ...(pengelola && !peran.length ? ["Penyelenggara"] : [])].join(", ");

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang sudah ditinjau
      </label>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data.siap ? (
        <EmptyState title="Alur tugas belum aktif" description="Migrasi database untuk tugas belum dijalankan." />
      ) : !data.butir.length ? (
        <EmptyState
          title={semua ? "Belum ada kiriman tugas" : "Tidak ada yang menunggu"}
          description="Kiriman Rancangan Aksi, laporan progres, dan tugas pembelajaran tampil di sini."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {data.butir.map((b) => (
            <li key={b.kirimanId}>
              <Link href={`/dashboard/tinjau-tugas/${encodeURIComponent(b.kirimanId)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-muted/50">
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-sm font-medium">{b.pesertaNama}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.judul} · {b.jenisLabel}
                    {b.versi > 1 ? ` · versi ${b.versi}` : ""}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{b.trainingNama}</span>
                </span>
                <span className="text-xs text-muted-foreground">{sebagai(b.peran, b.pengelola)}</span>
                <span className="font-mono text-xs">
                  {tglPendek(b.dikirimPada)}
                  {b.hariMenunggu > BATAS_TUNGGU_HARI ? <span className="block text-destructive">{b.hariMenunggu} hari</span> : null}
                </span>
                <Badge size="sm" tone={NADA_KIRIMAN[b.status] ?? "neutral"}>
                  {b.statusLabel}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const AKSI: Record<string, string> = {
  KIRIM: "mengirim",
  MULAI_TINJAU: "mulai meninjau",
  REVISI: "meminta revisi",
  TERIMA: "menerima",
  CATATAN: "memberi catatan",
  SETUJU_MENTOR: "menyetujui isu & timeline",
};
const PESAN: Partial<Record<AksiPeninjau, string>> = {
  TERIMA: "Tugas diterima.",
  REVISI: "Permintaan revisi terkirim ke peserta.",
  SETUJU_MENTOR: "Persetujuan mentor tercatat.",
  MULAI_TINJAU: "Status: sedang ditinjau.",
  CATATAN: "Catatan tersimpan.",
};

/**
 * Satu kiriman tugas (EB-038): berkas, riwayat, dan tindakan peninjau. Pengelola yang bukan peninjau mencatat ATAS NAMA
 * peninjau tanpa akun (Dokumen Induk 5.3); namanya sendiri tetap tercatat sebagai pencatat.
 */
export function DetailTinjauTugas({ awal }: { awal: DetailKirimanRecord }) {
  const [data, setData] = useState(awal);
  const [catatan, setCatatan] = useState("");
  const [sebagai, setSebagai] = useState<PeranPeninjau | "">(awal.peran[0] ?? awal.peranAtasNama[0] ?? "");
  const [atasNama, setAtasNama] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const peninjau = data.peran.length > 0;
  const wakil = !peninjau && data.pengelola;
  const pilihanSebagai = peninjau ? data.peran : data.peranAtasNama;
  const status = data.kiriman.status;
  const berkas = `/api/tugas/kiriman/${encodeURIComponent(data.kiriman.id)}/berkas`;

  async function tindak(aksi: AksiPeninjau) {
    setGalat("");
    if (wakil && atasNama.trim().length < 3) return setGalat("Isi nama peninjau yang diwakili.");
    setSibuk(true);
    const res = await kirimJson<DetailKirimanRecord>(`/api/tugas/kiriman/${encodeURIComponent(data.kiriman.id)}`, "POST", {
      aksi,
      catatan: catatan.trim() || null,
      sebagai: sebagai || null,
      atasNama: wakil ? atasNama.trim() : null,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setCatatan("");
    setToast(PESAN[aksi] ?? "Tersimpan.");
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary">
              {data.tugas.jenisLabel}
              {data.tugas.mataPelatihanNama ? ` · ${data.tugas.mataPelatihanNama}` : ""}
            </p>
            {data.tugas.tenggat ? (
              <p className="text-xs text-muted-foreground">
                Tenggat <span className="font-mono">{formatTanggalId(data.tugas.tenggat)}</span>
              </p>
            ) : null}
          </div>
          <Badge tone={NADA_KIRIMAN[status] ?? "neutral"}>{data.kiriman.statusLabel}</Badge>
        </div>
        {data.tugas.petunjuk ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{data.tugas.petunjuk}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {data.kiriman.berkasNama ? (
            <ButtonLink size="sm" variant="secondary" href={berkas} target="_blank" rel="noopener">
              <ExternalLink size={14} /> Buka berkas · versi <span className="font-mono">{data.kiriman.versi}</span>
            </ButtonLink>
          ) : null}
          {data.kiriman.mentorSetuju ? (
            <Badge size="sm" tone="success">
              Isu & timeline disetujui mentor
            </Badge>
          ) : null}
        </div>
      </section>

      {(peninjau || wakil) && status !== "DRAF" ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-medium">Tinjauan</h2>
          {wakil ? (
            <p className="text-xs text-muted-foreground">
              Anda bukan peninjau tugas ini. Sebagai penyelenggara, Anda dapat mencatat tinjauan atas nama peninjau yang tidak memakai aplikasi; nama Anda tetap tercatat sebagai
              pencatat.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {pilihanSebagai.length > 1 || wakil ? (
              <Select
                label={wakil ? "Peran yang diwakili" : "Bertindak sebagai"}
                value={sebagai || undefined}
                onValueChange={(v) => setSebagai(v as PeranPeninjau)}
                options={pilihanSebagai.map((p) => ({ value: p, label: LABEL_PERAN_PENINJAU[p] }))}
              />
            ) : null}
            {wakil ? <Input label="Nama peninjau yang diwakili" value={atasNama} onChange={setAtasNama} maxLength={120} placeholder="Nama mentor atau coach" /> : null}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Catatan untuk peserta</span>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={4} maxLength={2000} className={AREA} placeholder="Wajib diisi bila meminta revisi." />
          </label>
          {galat ? <Alert tone="danger" title={galat} /> : null}
          <div className="flex flex-wrap gap-2">
            {menungguTinjauan(status) ? (
              <>
                <Button disabled={sibuk} onClick={() => tindak("TERIMA")}>
                  Terima
                </Button>
                <Button variant="secondary" disabled={sibuk} onClick={() => tindak("REVISI")}>
                  Minta revisi
                </Button>
                {status === "DIKIRIM" ? (
                  <Button variant="secondary" disabled={sibuk} onClick={() => tindak("MULAI_TINJAU")}>
                    Tandai sedang ditinjau
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="ghost" disabled={sibuk || !catatan.trim()} onClick={() => tindak("CATATAN")}>
              Simpan catatan saja
            </Button>
            {data.tugas.jenis === "RANCANGAN_AKSI" && sebagai === "MENTOR" && !data.kiriman.mentorSetuju ? (
              <Button variant="secondary" disabled={sibuk} onClick={() => tindak("SETUJU_MENTOR")}>
                Setujui isu & timeline (mentor)
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border p-4">
        <h2 className="mb-2 font-display text-lg font-medium">Riwayat</h2>
        {!data.riwayat.length ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {data.riwayat.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium">{r.atasNama ?? r.aktorNama}</span>{" "}
                <span className="text-muted-foreground">({r.peranAktor === "PENGELOLA" ? `dicatat ${r.aktorNama}` : r.peranLabel})</span> {AKSI[r.aksi] ?? r.aksi}
                {r.aksi === "KIRIM" ? ` versi ${r.versi}` : ""}
                <time dateTime={r.waktu} className="ml-1 font-mono text-xs text-muted-foreground">
                  {waktu(r.waktu)}
                </time>
                {r.adaBerkas ? (
                  <a href={`${berkas}?riwayat=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener" className="ml-2 text-xs text-primary hover:underline">
                    berkas
                  </a>
                ) : null}
                {r.catatan ? <p className="mt-1 rounded-lg bg-muted px-3 py-2 whitespace-pre-line">{r.catatan}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      <Toast title="Tinjau tugas" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
