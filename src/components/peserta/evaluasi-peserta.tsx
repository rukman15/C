"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { DEFINISI_FORMULIR, RENTANG_NILAI, type AspekEvaluasi, type FormulirEvaluasi } from "@/lib/evaluasi";
import { ASPEK_23B, FORMULIR_23B } from "@/lib/evaluasi-penyelenggaraan";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { EvaluasiPesertaRecord } from "@/lib/server/repositories/evaluasi";

type Sasaran = EvaluasiPesertaRecord["sasaran"][number];
type Isian = Record<string, string>;

const keNilai = (aspek: AspekEvaluasi[], isi: Isian) =>
  Object.fromEntries(
    aspek.map((a) => {
      const t = (isi[a.kode] ?? "").trim().replace(",", ".");
      return [a.kode, t === "" ? null : Number(t)];
    }),
  );
const dariSimpanan = (aspek: AspekEvaluasi[], nilai?: Record<string, number>) =>
  Object.fromEntries(aspek.map((a) => [a.kode, nilai?.[a.kode] != null ? String(nilai[a.kode]) : ""]));

/**
 * Evaluasi tenaga pelatihan oleh peserta (Formulir 16–21 KepKa LAN 2/2023) dan, untuk PKA/PKP, evaluasi penyelenggaraan
 * (Formulir 23B). Sama dengan aplikasi lama: nilai 1–100 per aspek dengan tombol rentang cepat; bisa diisi setelah
 * sesinya berlangsung dan diubah selama penyelenggara belum menutup. Isian rahasia.
 */
export function EvaluasiPeserta({ pesertaId, data }: { pesertaId: string; data: EvaluasiPesertaRecord }) {
  const router = useRouter();
  const [buka, setBuka] = useState<string | null>(null); // kunci sasaran, atau "23B"
  const [isi, setIsi] = useState<Isian>({});
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const ev23 = data.penyelenggaraan;
  const terisi = data.sasaran.filter((s) => s.sudah).length;
  const bisa = data.sasaran.filter((s) => s.tersedia).length;
  const bolehIsi = !data.pratinjau && !data.ditutup;

  const grup: { formulir: FormulirEvaluasi; label: string; daftar: Sasaran[] }[] = [];
  for (const s of data.sasaran) {
    const g = grup.find((x) => x.formulir === s.formulir);
    if (g) g.daftar.push(s);
    else grup.push({ formulir: s.formulir, label: s.label, daftar: [s] });
  }

  function bukaForm(kunci: string, aspek: AspekEvaluasi[], isian: { nilai: Record<string, number>; catatan: string | null } | null) {
    if (buka === kunci) return setBuka(null);
    setBuka(kunci);
    setGalat("");
    setIsi(dariSimpanan(aspek, isian?.nilai));
    setCatatan(isian?.catatan ?? "");
  }

  async function simpan(url: string, body: Record<string, unknown>, pesan: string) {
    setGalat("");
    setMenyimpan(true);
    const res = await kirimJson(url, "PUT", body);
    setMenyimpan(false);
    if (!res.ok) return setGalat(res.error);
    setBuka(null);
    setToast(pesan);
    router.refresh();
  }

  const base = `/api/belajar/${encodeURIComponent(pesertaId)}/evaluasi`;
  const form = (aspek: AspekEvaluasi[], kirim: () => void, induk?: (a: AspekEvaluasi, i: number) => React.ReactNode) => (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
        {aspek.map((a, i) => (
          <div key={a.kode}>
            {induk?.(a, i)}
            <BarisNilai aspek={a} nomor={induk ? null : i + 1} nilai={isi[a.kode] ?? ""} onUbah={(v) => setIsi((x) => ({ ...x, [a.kode]: v }))} />
          </div>
        ))}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Catatan / saran (opsional)</span>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            maxLength={1000}
            rows={3}
            className="rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong"
          />
        </label>
        {galat ? (
          <p role="alert" className="text-sm text-destructive">
            {galat}
          </p>
        ) : null}
        <Button className="self-start" disabled={menyimpan} onClick={kirim}>
          {menyimpan ? "Menyimpan…" : "Simpan evaluasi"}
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`/dashboard/belajar/${pesertaId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Ruang belajar
      </Link>
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">{ev23 ? "Evaluasi Pengajar & Penyelenggaraan" : "Evaluasi Pengajar"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.training.name}</p>

      <section className="mt-6 rounded-2xl border border-border p-5">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Beri nilai <span className="text-foreground">1–100</span> untuk tiap aspek. Isian Anda rahasia: pengajar hanya melihat rata-rata dari sedikitnya 3 peserta, tanpa nama.
            Isian bisa diubah selama evaluasi belum ditutup penyelenggara.
          </span>
        </p>
        <div className="mt-4 flex items-baseline justify-between gap-2 text-sm">
          <span>
            <span className="font-display text-2xl">{terisi}</span> <span className="text-muted-foreground">dari {data.sasaran.length} terisi</span>
          </span>
          {bisa < data.sasaran.length ? <span className="text-xs text-muted-foreground">{data.sasaran.length - bisa} menunggu sesinya</span> : null}
        </div>
        <Progress className="mt-2" value={terisi} max={Math.max(1, data.sasaran.length)} aria-label="Evaluasi terisi" />
      </section>
      {data.ditutup ? (
        <Alert tone="warning" title="Evaluasi sudah ditutup penyelenggara" className="mt-4">
          Isian tidak bisa diubah lagi.
        </Alert>
      ) : null}
      {data.pratinjau ? (
        <Alert tone="info" title="Pratinjau" className="mt-4">
          Hanya peserta yang bisa mengisi.
        </Alert>
      ) : null}

      {grup.map((g) => (
        <section key={g.formulir} className="mt-8">
          <h2 className="mb-3 text-sm font-medium">
            {g.label} <span className="text-muted-foreground">· Formulir {DEFINISI_FORMULIR[g.formulir].nomor}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {g.daftar.map((s) => (
              <KartuSasaran
                key={s.kunci}
                judul={s.nama}
                keterangan={s.keterangan}
                sudah={s.sudah}
                tersedia={s.tersedia}
                mulai={s.tersediaMulai}
                terbuka={buka === s.kunci}
                bolehIsi={bolehIsi}
                onBuka={() => bukaForm(s.kunci, DEFINISI_FORMULIR[s.formulir].aspek, s.isian)}
              >
                <AnimatePresence initial={false}>
                  {buka === s.kunci
                    ? form(DEFINISI_FORMULIR[s.formulir].aspek, () =>
                        simpan(
                          base,
                          { sasaranKunci: s.kunci, nilai: keNilai(DEFINISI_FORMULIR[s.formulir].aspek, isi), catatan: catatan.trim() || null },
                          `Evaluasi untuk ${s.nama} tersimpan.`,
                        ),
                      )
                    : null}
                </AnimatePresence>
              </KartuSasaran>
            ))}
          </div>
        </section>
      ))}
      {data.sasaran.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">Belum ada pengajar yang bisa dievaluasi.</p> : null}

      {ev23 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">
            Penyelenggaraan pelatihan <span className="text-muted-foreground">· Formulir 23B</span>
          </h2>
          <KartuSasaran
            judul="Layanan penyelenggaraan pelatihan"
            keterangan="Registrasi, proses pembelajaran, sarana prasarana, konsumsi, dan pelayanan petugas."
            sudah={ev23.sudah}
            tersedia={ev23.tersedia}
            mulai={ev23.tersediaMulai}
            terbuka={buka === "23B"}
            bolehIsi={bolehIsi}
            onBuka={() => bukaForm("23B", ASPEK_23B, ev23.isian)}
          >
            <AnimatePresence initial={false}>
              {buka === "23B"
                ? form(
                    ASPEK_23B,
                    () => simpan(`${base}/penyelenggaraan`, { nilai: keNilai(ASPEK_23B, isi), catatan: catatan.trim() || null }, "Evaluasi penyelenggaraan tersimpan."),
                    (a, i) => {
                      const k = FORMULIR_23B.find((x) => x.aspek.some((y) => y.kode === a.kode))!;
                      const j = k.aspek.findIndex((y) => y.kode === a.kode);
                      const a23 = k.aspek[j];
                      return (
                        <>
                          {j === 0 ? (
                            <p className={cn("text-sm font-medium", i > 0 && "mt-4")}>
                              {k.no}. {k.nama}
                              {k.aspek.every((x) => x.opsional) ? (
                                <span className="block text-xs font-normal text-muted-foreground">Kosongkan bila pelatihan Anda tidak memiliki kegiatan ini.</span>
                              ) : null}
                            </p>
                          ) : null}
                          {a23.induk && a23.induk !== k.aspek[j - 1]?.induk ? <p className="mt-2 text-xs text-muted-foreground">{a23.induk}</p> : null}
                        </>
                      );
                    },
                  )
                : null}
            </AnimatePresence>
          </KartuSasaran>
        </section>
      ) : null}
      <Toast title="Evaluasi" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function KartuSasaran(p: {
  judul: string;
  keterangan: string | null;
  sudah: boolean;
  tersedia: boolean;
  mulai: string;
  terbuka: boolean;
  bolehIsi: boolean;
  onBuka: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 transition-colors", p.terbuka ? "border-primary" : "border-border")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{p.judul}</p>
          {p.keterangan ? <p className="text-xs text-muted-foreground">{p.keterangan}</p> : null}
        </div>
        {p.sudah ? (
          <Badge size="sm" tone="success" icon={<CheckCircle2 size={12} />}>
            terisi
          </Badge>
        ) : !p.tersedia ? (
          <Badge size="sm">mulai {formatTanggalId(p.mulai)}</Badge>
        ) : null}
        {p.tersedia && p.bolehIsi ? (
          <Button size="sm" variant={p.terbuka ? "ghost" : p.sudah ? "secondary" : "primary"} onClick={p.onBuka}>
            {p.terbuka ? "Tutup" : p.sudah ? "Ubah" : "Isi"}
          </Button>
        ) : null}
      </div>
      {p.children}
    </div>
  );
}

function BarisNilai({ aspek, nomor, nilai, onUbah }: { aspek: AspekEvaluasi; nomor: number | null; nilai: string; onUbah: (v: string) => void }) {
  const n = Number(nilai.replace(",", "."));
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start justify-between gap-3 text-sm">
        <span>
          {nomor ? `${nomor}. ` : ""}
          {aspek.nama}
          {aspek.opsional ? <span className="text-xs text-muted-foreground"> (kosongkan bila tidak ada)</span> : null}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={100}
          step={0.01}
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          aria-label={aspek.nama}
          className="h-9 w-20 shrink-0 rounded-xl border border-border bg-transparent px-2 text-right font-mono text-sm outline-none focus:border-border-strong"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {RENTANG_NILAI.map((r) => {
          const aktif = nilai !== "" && Math.abs(n - r.nilai) < 5;
          return (
            <button
              key={r.label}
              type="button"
              onClick={() => onUbah(String(r.nilai))}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                aktif ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
