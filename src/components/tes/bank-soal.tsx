"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KISI, LABEL_STATUS_SOAL, PROGRAM_TES, bacaTempelanSoal, hurufOpsi, labelKisi, normalTeks, type ProgramTes, type SoalInput, type StatusSoal } from "@/lib/tes";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { BankSoalRecord, SoalRecord } from "@/lib/server/repositories/tes";
import { AREA, FormSoal } from "./form-soal";

const NADA: Record<StatusSoal, BadgeTone> = { DIAJUKAN: "warning", SIAP: "success", DIKEMBALIKAN: "danger", NONAKTIF: "neutral" };
const SEMUA = "__semua";
const CONTOH = [
  ["Agenda", "Pertanyaan", "A", "B", "C", "D", "E", "Kunci", "Pembahasan"],
  [
    "I",
    "Nilai dasar yang menjadi landasan kepemimpinan Pancasila adalah …",
    "Ketuhanan, kemanusiaan, persatuan, kerakyatan, keadilan",
    "Efisiensi anggaran",
    "Senioritas",
    "Kedekatan politik",
    "",
    "A",
    "Lihat modul Agenda I",
  ],
  ["II", "Indikator kinerja utama disingkat …", "IKU", "IKK", "SPM", "RKA", "", "A", ""],
];

/**
 * Bank Soal pre-test & post-test per program (sama dengan aplikasi lama). Admin & Ketua Diklat: semua soal, impor dari Excel,
 * memeriksa soal WI, menginput atas nama WI. Widyaiswara: menyusun soalnya sendiri, masuk "Menunggu diperiksa" dulu.
 */
export function BankSoal({ penyelenggara }: { penyelenggara: boolean }) {
  const [program, setProgram] = useState<ProgramTes>("PKA");
  const [data, setData] = useState<BankSoalRecord | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [pesan, setPesan] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [saringStatus, setSaringStatus] = useState<string>(SEMUA);
  const [saringKisi, setSaringKisi] = useState<string>(SEMUA);
  const [cari, setCari] = useState("");
  const [mode, setMode] = useState<"" | "satu" | "impor">("");
  const [penyusun, setPenyusun] = useState("");
  const [teksImpor, setTeksImpor] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [kembalikan, setKembalikan] = useState<{ id: string; catatan: string } | null>(null);
  const [tersalin, setTersalin] = useState(false);

  const muat = useCallback(async () => {
    const r = await ambilJson<BankSoalRecord>(`/api/bank-soal?program=${program}`);
    if (r.ok) {
      setData(r.data);
      setGalatMuat("");
    } else setGalatMuat(r.error);
  }, [program]);
  useEffect(() => {
    muat();
  }, [muat]);

  const agenda = data?.agenda[program] ?? [];
  const tampil = useMemo(() => {
    const q = normalTeks(cari);
    return (data?.soal ?? []).filter(
      (s) =>
        (saringStatus === SEMUA || s.status === saringStatus) &&
        (saringKisi === SEMUA || s.kisi === saringKisi) &&
        (!q || normalTeks([s.pertanyaan, ...s.opsi, s.penyusun ?? ""].join(" ")).includes(q)),
    );
  }, [data, cari, saringStatus, saringKisi]);
  const sudahAda = useMemo(() => new Set((data?.soal ?? []).map((s) => normalTeks(s.pertanyaan))), [data]);
  const hasilImpor = teksImpor.trim() ? bacaTempelanSoal(teksImpor, penyelenggara ? sudahAda : new Set()) : null;

  async function simpanBaru(soal: SoalInput[]) {
    setMenyimpan(true);
    setPesan("");
    const res = await kirimJson<{ dibuat: number; dilewati: { nomor: number; alasan: string }[] }>("/api/bank-soal", "POST", {
      program,
      penyusun: penyelenggara ? penyusun.trim() || null : null,
      soal,
    });
    setMenyimpan(false);
    if (!res.ok) return setPesan(res.error);
    setToast(
      `${res.data.dibuat} soal disimpan` +
        (penyelenggara ? " (langsung siap dipakai)" : "; menunggu diperiksa admin/Ketua Diklat") +
        (res.data.dilewati.length ? `; ${res.data.dilewati.length} dilewati: ${res.data.dilewati.map((d) => `#${d.nomor} ${d.alasan}`).join("; ")}` : ""),
    );
    if (res.data.dibuat > 0) {
      setTeksImpor("");
      if (mode === "satu") setMode("");
    }
    await muat();
  }
  async function patch(s: SoalRecord, body: Record<string, unknown>) {
    setSibuk(s.id);
    const res = await kirimJson(`/api/bank-soal/${encodeURIComponent(s.id)}`, "PATCH", body);
    setSibuk(null);
    setPesan(res.ok ? "" : res.error);
    await muat();
    return res.ok;
  }
  async function hapus(s: SoalRecord) {
    if (!confirm("Hapus soal ini dari bank?")) return;
    setSibuk(s.id);
    const res = await kirimJson(`/api/bank-soal/${encodeURIComponent(s.id)}`, "DELETE");
    setSibuk(null);
    setPesan(res.ok ? "" : res.error);
    await muat();
  }
  async function salinContoh() {
    try {
      await navigator.clipboard.writeText(CONTOH.map((b) => b.join("\t")).join("\n"));
      setTersalin(true);
    } catch {
      setTersalin(false);
    }
  }
  const bisaUbah = (s: SoalRecord) => !s.terkunci && (penyelenggara || (s.milikSaya && (s.status === "DIAJUKAN" || s.status === "DIKEMBALIKAN")));
  const bisaHapus = (s: SoalRecord) => s.dipakaiTes === 0 && (penyelenggara || (s.milikSaya && s.status !== "SIAP"));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {penyelenggara
          ? "Soal pilihan ganda per program, dipakai lintas angkatan. Soal dari Widyaiswara diperiksa di sini sebelum bisa masuk paket. Bila WI belum menyusun, admin/Ketua Diklat bisa menginput atas namanya."
          : "Susun soal pilihan ganda untuk pre-test & post-test. Soal Anda diperiksa admin/Ketua Diklat sebelum dipakai."}
      </p>
      <div>
        <SegmentedControl label="Program" value={program} onValueChange={(v) => setProgram(v as ProgramTes)} options={PROGRAM_TES.map((p) => ({ value: p, label: p }))} />
      </div>

      {data ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-base font-medium">Soal siap dipakai · {program}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {KISI.map((k) => {
              const n = data.siap[program]?.[k] ?? 0;
              return (
                <div key={k} className="rounded-xl border border-border px-3 py-2" title={labelKisi(k, agenda)}>
                  <p className="text-[11px] text-muted-foreground">{k === "DASAR" ? "MP dasar" : k === "UMUM" ? "Umum" : `Agenda ${k}`}</p>
                  <p className={cn("font-mono text-lg", !n && "text-muted-foreground")}>{n}</p>
                </div>
              );
            })}
          </div>
          {penyelenggara && data.menunggu > 0 ? (
            <p className="text-xs text-warning">
              <span className="font-mono">{data.menunggu}</span> soal menunggu diperiksa.{" "}
              <button type="button" className="underline" onClick={() => setSaringStatus("DIAJUKAN")}>
                Tampilkan
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 font-display text-base font-medium">Tambah soal</h2>
          <Button size="sm" variant={mode === "satu" ? "primary" : "secondary"} onClick={() => setMode(mode === "satu" ? "" : "satu")}>
            Satu per satu
          </Button>
          <Button size="sm" variant={mode === "impor" ? "primary" : "secondary"} onClick={() => setMode(mode === "impor" ? "" : "impor")}>
            Tempel dari Excel
          </Button>
        </div>
        {mode && penyelenggara ? (
          <div className="sm:w-96">
            <Input
              label="Penyusun (nama Widyaiswara, bila menginput atas namanya; opsional)"
              value={penyusun}
              onChange={setPenyusun}
              maxLength={150}
              placeholder="mis. Dr. Arya, M.Si"
            />
          </div>
        ) : null}
        {mode === "satu" ? <FormSoal agenda={agenda} sibuk={menyimpan} onSimpan={(s) => simpanBaru([s])} onBatal={() => setMode("")} /> : null}
        {mode === "impor" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Kolom: <span className="font-medium text-foreground">Agenda | Pertanyaan | A | B | C | D | E | Kunci | Pembahasan</span>. Agenda diisi I, II, III, IV, Dasar, atau
              kosong (umum). Kunci huruf A–E. Pilihan C–E boleh kosong. Blok sel di Excel (termasuk baris judul), salin, lalu tempel di bawah.{" "}
              <button type="button" className="underline" onClick={salinContoh}>
                {tersalin ? "Contoh tersalin, tempel ke Excel" : "Salin contoh untuk Excel"}
              </button>
            </p>
            <textarea
              aria-label="Tempelan dari Excel"
              value={teksImpor}
              onChange={(e) => setTeksImpor(e.target.value)}
              rows={6}
              placeholder="Tempel di sini…"
              className={cn(AREA, "font-mono text-xs")}
            />
            {hasilImpor ? (
              <>
                <p className="text-sm">
                  <span className="text-success">{hasilImpor.soal.length} soal sah</span>
                  {hasilImpor.galat.length ? <span className="text-destructive"> · {hasilImpor.galat.length} baris bermasalah</span> : null}
                </p>
                {hasilImpor.galat.length ? (
                  <ul className="max-h-40 overflow-auto rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
                    {hasilImpor.galat.map((g) => (
                      <li key={g.nomor}>
                        Baris {g.nomor}: {g.alasan}. <span className="opacity-75">{g.teks}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {hasilImpor.soal.length ? (
                  <>
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Pratinjau soal sah</summary>
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {hasilImpor.soal.map((s, i) => (
                          <li key={i} className="text-foreground">
                            <span className="text-muted-foreground">[{s.kisi}]</span> {s.pertanyaan}{" "}
                            <span className="text-success">
                              → {hurufOpsi(s.kunci)}. {s.opsi[s.kunci]}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <div>
                      <Button size="sm" disabled={menyimpan} onClick={() => simpanBaru(hasilImpor.soal)}>
                        {menyimpan ? "Menyimpan…" : `Simpan ${hasilImpor.soal.length} soal`}
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
      {pesan ? <Alert tone="danger" title={pesan} /> : null}

      <section className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_14rem_12rem]">
          <Input label="Cari" value={cari} onChange={setCari} placeholder="Pertanyaan, pilihan, penyusun…" leftIcon={<Search size={16} />} />
          <Select
            label="Agenda"
            value={saringKisi}
            onValueChange={setSaringKisi}
            options={[{ value: SEMUA, label: "Semua agenda" }, ...KISI.map((k) => ({ value: k, label: labelKisi(k) }))]}
          />
          <Select
            label="Status"
            value={saringStatus}
            onValueChange={setSaringStatus}
            options={[{ value: SEMUA, label: "Semua status" }, ...Object.entries(LABEL_STATUS_SOAL).map(([k, v]) => ({ value: k, label: v }))]}
          />
        </div>
        {galatMuat ? (
          <Alert tone="danger" title={galatMuat} />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !tampil.length ? (
          <EmptyState
            title={`Belum ada soal${saringStatus !== SEMUA || saringKisi !== SEMUA || cari ? " yang cocok" : ""}`}
            description="Tambahkan soal satu per satu atau tempel dari Excel."
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{tampil.length}</span> soal
            </p>
            <ul className="flex flex-col gap-2">
              {tampil.map((s) => (
                <li key={s.id} className={cn("rounded-2xl border border-border p-3", s.status === "NONAKTIF" && "opacity-65")}>
                  {ubahId === s.id ? (
                    <FormSoal
                      agenda={agenda}
                      awal={s}
                      sibuk={sibuk === s.id}
                      labelSimpan="Simpan perubahan"
                      onSimpan={async (isi) => {
                        if (await patch(s, isi)) setUbahId(null);
                      }}
                      onBatal={() => setUbahId(null)}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge size="sm" tone="info">
                          {labelKisi(s.kisi)}
                        </Badge>
                        <Badge size="sm" tone={NADA[s.status]}>
                          {LABEL_STATUS_SOAL[s.status]}
                        </Badge>
                        {s.terkunci ? (
                          <span className="inline-flex items-center gap-1" title="Sudah dipakai tes yang terbit/dikerjakan">
                            <Lock size={12} /> terkunci
                          </span>
                        ) : null}
                        {s.dipakaiTes ? <span>di {s.dipakaiTes} paket tes</span> : null}
                        {s.penyusun ? <span>· penyusun {s.penyusun}</span> : null}
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm">{s.pertanyaan}</p>
                      <ol className="mt-1.5 flex flex-col gap-0.5 text-sm">
                        {s.opsi.map((o, i) => (
                          <li key={i} className={i === s.kunci ? "font-medium text-success" : "text-muted-foreground"}>
                            {hurufOpsi(i)}. {o}
                            {i === s.kunci ? " ✓" : ""}
                          </li>
                        ))}
                      </ol>
                      {s.pembahasan ? <p className="mt-1 text-xs text-muted-foreground">Pembahasan: {s.pembahasan}</p> : null}
                      {s.catatanPeriksa && s.status === "DIKEMBALIKAN" ? <p className="mt-1 text-xs text-destructive">Catatan pemeriksa: {s.catatanPeriksa}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {penyelenggara && (s.status === "DIAJUKAN" || s.status === "DIKEMBALIKAN") ? (
                          <Button size="sm" variant="secondary" disabled={sibuk === s.id} onClick={() => patch(s, { aksi: "setujui", catatan: null })}>
                            Setujui
                          </Button>
                        ) : null}
                        {penyelenggara && s.status === "DIAJUKAN" && !s.terkunci ? (
                          <Button size="sm" variant="ghost" disabled={sibuk === s.id} onClick={() => setKembalikan({ id: s.id, catatan: s.catatanPeriksa ?? "" })}>
                            Kembalikan
                          </Button>
                        ) : null}
                        {penyelenggara && s.status === "NONAKTIF" ? (
                          <Button size="sm" variant="ghost" disabled={sibuk === s.id} onClick={() => patch(s, { aksi: "aktifkan", catatan: null })}>
                            Aktifkan
                          </Button>
                        ) : null}
                        {penyelenggara && s.status === "SIAP" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={sibuk === s.id}
                            onClick={() => confirm("Nonaktifkan soal ini? Soal tidak bisa dipilih lagi untuk paket baru.") && patch(s, { aksi: "nonaktifkan", catatan: null })}
                          >
                            Nonaktifkan
                          </Button>
                        ) : null}
                        {bisaUbah(s) ? (
                          <Button size="sm" variant="ghost" disabled={sibuk === s.id} onClick={() => setUbahId(s.id)}>
                            Ubah
                          </Button>
                        ) : null}
                        {bisaHapus(s) ? (
                          <Button size="sm" variant="ghost" disabled={sibuk === s.id} onClick={() => hapus(s)}>
                            Hapus
                          </Button>
                        ) : null}
                      </div>
                      {kembalikan?.id === s.id ? (
                        <form
                          className="mt-2 flex flex-col gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (await patch(s, { aksi: "kembalikan", catatan: kembalikan.catatan.trim() })) setKembalikan(null);
                          }}
                        >
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Catatan perbaikan untuk penyusun
                            <textarea
                              value={kembalikan.catatan}
                              onChange={(e) => setKembalikan({ ...kembalikan, catatan: e.target.value })}
                              rows={2}
                              maxLength={1000}
                              className={cn(AREA, "font-normal")}
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={sibuk === s.id || !kembalikan.catatan.trim()}>
                              Kembalikan
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setKembalikan(null)}>
                              Batal
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <Toast title="Bank Soal" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
