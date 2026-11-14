"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { tanggalPanjang } from "@/lib/dokumen";
import { INSTRUKSI_DISPOSISI, KEAMANAN, SIFAT_SURAT, TIPE_BERKAS_SURAT_MASUK } from "@/lib/persuratan";
import type { PilihanKlien } from "@/lib/persuratan-klien";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { kirimBerkas } from "@/lib/unggah";
import { cn } from "@/lib/utils";
import type { SuratMasukRecord } from "@/lib/server/repositories/surat-masuk";
import { AREA, ISIAN, LABEL } from "./isian";

const SEMUA = "__semua";
const LABEL_STATUS: Record<string, string> = { BARU: "Baru", DIDISPOSISI: "Didisposisi", SELESAI: "Selesai", DIBACA: "Dibaca" };
const NADA_STATUS: Record<string, BadgeTone> = { BARU: "warning", DIDISPOSISI: "info", DIBACA: "info", SELESAI: "success" };

type FormMasuk = { tanggalTerima: string; asal: string; nomorSurat: string; tanggalSurat: string; hal: string; sifat: string; keamanan: string; ringkasan: string };

/**
 * Surat masuk (sama dengan aplikasi lama): dicatat TU (nomor agenda per tahun, pindaian PDF/JPG/PNG ≤ 5 MB di penyimpanan privat),
 * didisposisikan pimpinan, diteruskan penerima. Pegawai lain hanya melihat surat yang didisposisikan kepadanya.
 */
export function SuratMasuk({ hariIni }: { hariIni: string }) {
  const params = useSearchParams();
  const [pilihan, setPilihan] = useState<PilihanKlien | null>(null);
  // ?tahun=…&id=… (tautan dari Disposisi untuk Saya) membuka surat itu langsung.
  const [tahun, setTahun] = useState(Number(params.get("tahun")) || Number(hariIni.slice(0, 4)));
  const [daftar, setDaftar] = useState<SuratMasukRecord[] | null>(null);
  const [dipilih, setDipilih] = useState<SuratMasukRecord | null>(null);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ awal: FormMasuk; id: string | null } | null>(null);
  const [saringStatus, setSaringStatus] = useState(SEMUA);
  const [cariSurat, setCariSurat] = useState("");
  const [mengunggah, setMengunggah] = useState(false);

  const muat = useCallback(async () => {
    const r = await ambilJson<SuratMasukRecord[]>(`/api/persuratan/surat-masuk?tahun=${tahun}`);
    if (r.ok) setDaftar(r.data);
    else setGalat(r.error);
  }, [tahun]);
  const buka = useCallback(async (id: string) => {
    setGalat("");
    const r = await ambilJson<SuratMasukRecord>(`/api/persuratan/surat-masuk/${encodeURIComponent(id)}`);
    if (r.ok) setDipilih(r.data);
    else setGalat(r.error);
  }, []);
  useEffect(() => {
    ambilJson<PilihanKlien>("/api/persuratan/pilihan").then((r) => (r.ok ? setPilihan(r.data) : setGalat(r.error)));
    const id = params.get("id");
    if (id) buka(id);
    // Parameter URL hanya dibaca saat halaman dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setDaftar(null);
    muat();
  }, [muat]);

  const q = cariSurat.trim().toLowerCase();
  const tampil = (daftar ?? []).filter((s) => (saringStatus === SEMUA || s.status === saringStatus) && (!q || `${s.asal} ${s.hal} ${s.nomorSurat}`.toLowerCase().includes(q)));
  const jumlahBaru = (daftar ?? []).filter((s) => s.status === "BARU").length;
  const hak = pilihan?.hak;

  function bukaForm(s?: SuratMasukRecord) {
    setForm(
      s
        ? {
            id: s.id,
            awal: {
              tanggalTerima: s.tanggalTerima,
              asal: s.asal,
              nomorSurat: s.nomorSurat,
              tanggalSurat: s.tanggalSurat ?? "",
              hal: s.hal,
              sifat: s.sifat,
              keamanan: s.keamanan,
              ringkasan: s.ringkasan ?? "",
            },
          }
        : { id: null, awal: { tanggalTerima: hariIni, asal: "", nomorSurat: "", tanggalSurat: "", hal: "", sifat: "Biasa", keamanan: "B", ringkasan: "" } },
    );
  }
  async function tandaiSelesai(s: SuratMasukRecord) {
    const isi = {
      tanggalTerima: s.tanggalTerima,
      asal: s.asal,
      nomorSurat: s.nomorSurat,
      tanggalSurat: s.tanggalSurat,
      hal: s.hal,
      sifat: s.sifat,
      keamanan: s.keamanan,
      ringkasan: s.ringkasan,
      selesai: true,
    };
    const r = await kirimJson<SuratMasukRecord>(`/api/persuratan/surat-masuk/${encodeURIComponent(s.id)}`, "PUT", isi);
    if (!r.ok) return setGalat(r.error);
    setDipilih(r.data);
    setToast("Surat ditandai selesai.");
    muat();
  }
  async function hapus(s: SuratMasukRecord) {
    if (!confirm(`Hapus surat masuk agenda ${s.nomorAgenda}/${s.tahun}?\n${s.asal}: ${s.hal}. Pindaiannya ikut terhapus.`)) return;
    const r = await kirimJson(`/api/persuratan/surat-masuk/${encodeURIComponent(s.id)}`, "DELETE");
    if (!r.ok) return setGalat(r.error);
    setToast("Surat masuk dihapus.");
    setDipilih(null);
    muat();
  }
  async function unggah(file: File | undefined) {
    if (!file || !dipilih) return;
    setMengunggah(true);
    const r = await kirimBerkas<SuratMasukRecord>(`/api/persuratan/surat-masuk/${encodeURIComponent(dipilih.id)}/berkas`, "dokumen", {}, file);
    setMengunggah(false);
    if (!r.ok) return setGalat(r.error);
    setDipilih(r.data);
    setToast("Pindaian diunggah.");
  }
  async function bukaPindaian(id: string) {
    const r = await ambilJson<{ url: string }>(`/api/persuratan/surat-masuk/${encodeURIComponent(id)}/berkas`);
    if (r.ok) window.open(r.data.url, "_blank", "noopener");
    else setGalat(r.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-lg font-medium">Surat masuk {tahun}</h2>
            <div className="flex items-end gap-2">
              <label className={cn(LABEL, "w-24")}>
                Tahun
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={tahun}
                  onChange={(e) => setTahun(Number(e.target.value) || tahun)}
                  className={cn(ISIAN, "font-mono font-normal")}
                />
              </label>
              {hak?.catatMasuk ? (
                <Button onClick={() => bukaForm()}>
                  <Plus size={16} /> Catat
                </Button>
              ) : null}
            </div>
          </div>
          {daftar?.length ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
              <Input label="Cari" value={cariSurat} onChange={setCariSurat} placeholder="Asal, hal, atau nomor surat…" leftIcon={<Search size={16} />} />
              <Select
                label="Status"
                value={saringStatus}
                onValueChange={setSaringStatus}
                options={[
                  { value: SEMUA, label: "Semua status" },
                  { value: "BARU", label: `Baru${jumlahBaru ? ` (${jumlahBaru})` : ""}` },
                  { value: "DIDISPOSISI", label: "Didisposisi" },
                  { value: "SELESAI", label: "Selesai" },
                ]}
              />
            </div>
          ) : null}
          {!daftar ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : !daftar.length ? (
            <EmptyState
              title={`Belum ada surat masuk${hak?.bacaMasuk || hak?.catatMasuk ? "" : " yang didisposisikan kepada Anda"}`}
              description="Surat yang dicatat TU tampil di sini."
            />
          ) : !tampil.length ? (
            <p className="text-sm text-muted-foreground">Tidak ada surat yang cocok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {tampil.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => buka(s.id)}
                    aria-current={dipilih?.id === s.id ? "true" : undefined}
                    className={cn("grid w-full grid-cols-[2.5rem_1fr_auto] items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50", dipilih?.id === s.id && "bg-muted/60")}
                  >
                    <span className="text-right font-mono text-sm">{s.nomorAgenda}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.asal}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.hal}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tanggalPanjang(s.tanggalTerima)} · {s.sifat}
                      </span>
                    </span>
                    <Badge size="sm" tone={NADA_STATUS[s.status] ?? "neutral"}>
                      {LABEL_STATUS[s.status] ?? s.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          {!dipilih ? (
            <p className="text-sm text-muted-foreground">Pilih surat untuk melihat rincian dan disposisinya.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-medium">
                  Agenda{" "}
                  <span className="font-mono">
                    {dipilih.nomorAgenda}/{dipilih.tahun}
                  </span>{" "}
                  · {dipilih.asal}
                </h2>
                <p className="text-sm">{dipilih.hal}</p>
                <p className="text-xs text-muted-foreground">
                  No. <span className="font-mono">{dipilih.nomorSurat}</span>
                  {dipilih.tanggalSurat ? ` tgl. ${tanggalPanjang(dipilih.tanggalSurat)}` : ""} · diterima {tanggalPanjang(dipilih.tanggalTerima)} · {dipilih.sifat}
                </p>
                {dipilih.ringkasan ? <p className="mt-1 text-sm text-muted-foreground">{dipilih.ringkasan}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ButtonLink size="sm" variant="ghost" href={`/cetak/disposisi/${encodeURIComponent(dipilih.id)}`} target="_blank" rel="noopener">
                  Lembar disposisi
                </ButtonLink>
                {dipilih.adaBerkas ? (
                  <Button size="sm" variant="ghost" onClick={() => bukaPindaian(dipilih.id)}>
                    Pindaian
                  </Button>
                ) : null}
                {hak?.susun && dipilih.disposisi.length ? (
                  <ButtonLink
                    size="sm"
                    variant="ghost"
                    href={`/dashboard/persuratan?dariSurat=${encodeURIComponent(dipilih.id)}`}
                    title="Dasar = surat ini, penerima = pegawai yang didisposisi"
                  >
                    Buat surat tugas
                  </ButtonLink>
                ) : null}
                {hak?.catatMasuk ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => bukaForm(dipilih)}>
                      Ubah
                    </Button>
                    {dipilih.status !== "SELESAI" ? (
                      <Button size="sm" variant="ghost" onClick={() => tandaiSelesai(dipilih)}>
                        Tandai selesai
                      </Button>
                    ) : null}
                    {!dipilih.disposisi.length ? (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => hapus(dipilih)}>
                        Hapus
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              {hak?.catatMasuk ? (
                <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Pindaian (PDF/JPG/PNG, ≤ 5 MB){dipilih.berkasNama ? `: ${dipilih.berkasNama}` : ""}
                  <input
                    type="file"
                    accept={TIPE_BERKAS_SURAT_MASUK.join(",")}
                    disabled={mengunggah}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      unggah(f);
                    }}
                    className="text-xs"
                  />
                  {mengunggah ? <span>Mengunggah…</span> : null}
                </label>
              ) : null}

              <h3 className="mt-2 text-sm font-medium">Disposisi</h3>
              {!dipilih.disposisi.length ? (
                <p className="text-sm text-muted-foreground">Belum ada disposisi.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dipilih.disposisi.map((d) => (
                    <li key={d.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="font-medium">
                        {d.dariJabatan} → {d.kepadaNama}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.instruksi.join(", ") || "tanpa instruksi"}
                        {d.batasWaktu ? ` · batas ${tanggalPanjang(d.batasWaktu)}` : ""} · {LABEL_STATUS[d.status] ?? d.status}
                      </div>
                      {d.catatan ? <div className="text-xs">Catatan: {d.catatan}</div> : null}
                      {d.tindakLanjut ? <div className="text-xs text-success">Tindak lanjut: {d.tindakLanjut}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
              {pilihan && (pilihan.hak.disposisi || (!!pilihan.pegawaiId && dipilih.disposisi.some((d) => d.kepadaPegawaiId === pilihan.pegawaiId))) ? (
                <FormDisposisi
                  key={dipilih.id}
                  surat={dipilih}
                  pilihan={pilihan}
                  onTerkirim={(s) => {
                    setDipilih(s);
                    setToast("Disposisi dikirim.");
                    muat();
                  }}
                />
              ) : null}
            </>
          )}
        </section>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent
          title={form?.id ? "Ubah surat masuk" : "Catat surat masuk"}
          onPointerDownOutside={(e) => e.preventDefault()}
          style={{ width: "min(calc(100vw - 2rem), 36rem)" }}
        >
          {form ? (
            <FormSuratMasuk
              awal={form.awal}
              onKirim={async (isi) => {
                const r = form.id
                  ? await kirimJson<SuratMasukRecord>(`/api/persuratan/surat-masuk/${encodeURIComponent(form.id)}`, "PUT", isi)
                  : await kirimJson<SuratMasukRecord>("/api/persuratan/surat-masuk", "POST", isi);
                if (!r.ok) return r.error;
                setToast(form.id ? "Surat masuk diperbarui." : `Surat masuk dicatat dengan nomor agenda ${r.data.nomorAgenda}.`);
                setForm(null);
                setDipilih(r.data);
                muat();
                return null;
              }}
              onBatal={() => setForm(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Toast title="Surat Masuk" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormSuratMasuk({ awal, onKirim, onBatal }: { awal: FormMasuk; onKirim: (isi: Record<string, unknown>) => Promise<string | null>; onBatal: () => void }) {
  const [f, setF] = useState(awal);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (k: keyof FormMasuk) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!f.asal.trim() || !f.nomorSurat.trim() || !f.hal.trim()) return setGalat("Asal, nomor surat, dan hal wajib diisi.");
    setSibuk(true);
    setGalat("");
    const g = await onKirim({ ...f, tanggalSurat: f.tanggalSurat || null, ringkasan: f.ringkasan || null });
    setSibuk(false);
    if (g) setGalat(g);
  }
  return (
    <form onSubmit={kirim} noValidate className="grid gap-3 sm:grid-cols-2">
      <Input label="Tanggal diterima" type="date" value={f.tanggalTerima} onChange={set("tanggalTerima")} />
      <Input label="Tanggal surat" type="date" value={f.tanggalSurat} onChange={set("tanggalSurat")} />
      <div className="sm:col-span-2">
        <Input label="Asal surat" value={f.asal} onChange={set("asal")} maxLength={300} />
      </div>
      <Input label="Nomor surat" value={f.nomorSurat} onChange={set("nomorSurat")} maxLength={150} />
      <Select label="Sifat" value={f.sifat} onValueChange={set("sifat")} options={SIFAT_SURAT.map((s) => ({ value: s, label: s }))} />
      <div className="sm:col-span-2">
        <Input label="Hal" value={f.hal} onChange={set("hal")} maxLength={500} />
      </div>
      <Select label="Klasifikasi keamanan" value={f.keamanan} onValueChange={set("keamanan")} options={KEAMANAN.map((k) => ({ value: k.kode, label: k.label }))} />
      <label className={cn(LABEL, "sm:col-span-2")}>
        Ringkasan isi (opsional)
        <textarea rows={3} value={f.ringkasan} onChange={(e) => set("ringkasan")(e.target.value)} maxLength={2000} className={cn(AREA, "font-normal")} />
      </label>
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2" /> : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function FormDisposisi({ surat, pilihan, onTerkirim }: { surat: SuratMasukRecord; pilihan: PilihanKlien; onTerkirim: (s: SuratMasukRecord) => void }) {
  const [kepada, setKepada] = useState<string[]>([]);
  const [instruksi, setInstruksi] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");
  const [batasWaktu, setBatasWaktu] = useState("");
  const [cari, setCari] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const q = cari.trim().toLowerCase();
  const tersaring = pilihan.pegawai.filter((p) => p.id !== pilihan.pegawaiId && (!q || `${p.nama} ${p.jabatan}`.toLowerCase().includes(q))).slice(0, 40);
  const nama = (id: string) => pilihan.pegawai.find((p) => p.id === id)?.nama ?? id;
  const toggle = (l: string[], v: string) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<SuratMasukRecord>(`/api/persuratan/surat-masuk/${encodeURIComponent(surat.id)}/disposisi`, "POST", {
      kepadaPegawaiIds: kepada,
      instruksi,
      catatan: catatan || null,
      batasWaktu: batasWaktu || null,
    });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setKepada([]);
    setInstruksi([]);
    setCatatan("");
    setBatasWaktu("");
    onTerkirim(r.data);
  }
  return (
    <form onSubmit={kirim} className="mt-2 flex flex-col gap-2 rounded-xl border border-border p-3">
      <span className="text-sm font-medium">{pilihan.hak.disposisi ? "Beri disposisi" : "Teruskan disposisi"}</span>
      {kepada.length ? (
        <div className="flex flex-wrap gap-1.5">
          {kepada.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setKepada(toggle(kepada, id))}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              {nama(id)} <X size={12} />
            </button>
          ))}
        </div>
      ) : null}
      <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari penerima…" aria-label="Cari penerima" className={ISIAN} />
      <div className="max-h-32 overflow-y-auto rounded-xl border border-border">
        {tersaring.map((p) => (
          <label key={p.id} className="flex items-center gap-2 px-3 py-1 text-sm">
            <input type="checkbox" checked={kepada.includes(p.id)} onChange={() => setKepada(toggle(kepada, p.id))} />
            {p.nama} <span className="text-xs text-muted-foreground">{p.jabatan}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {INSTRUKSI_DISPOSISI.map((ins) => (
          <label key={ins} className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={instruksi.includes(ins)} onChange={() => setInstruksi(toggle(instruksi, ins))} />
            {ins}
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan" aria-label="Catatan disposisi" className={AREA} />
        <label className={LABEL}>
          Batas waktu
          <input type="date" value={batasWaktu} onChange={(e) => setBatasWaktu(e.target.value)} className={cn(ISIAN, "font-normal")} />
        </label>
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div>
        <Button type="submit" size="sm" disabled={sibuk || !kepada.length}>
          Kirim disposisi
        </Button>
      </div>
    </form>
  );
}
