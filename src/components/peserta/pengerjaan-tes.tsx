"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Send } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Button, ButtonLink } from "@/components/ui/button";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { PengerjaanRecord, TesPesertaRecord } from "@/lib/server/repositories/tes";

type Tanya = { judul: string; pesan: string; tombol: string; lanjut: () => void } | null;

/**
 * Pengerjaan pre-test / post-test (sama dengan aplikasi lama): satu soal per layar dengan panel nomor soal; jawaban
 * tersimpan otomatis setiap memilih (berurutan); waktu dihitung server (memuat ulang tidak mengulang waktu); saat waktu
 * habis jawaban dikirim otomatis.
 */
export function PengerjaanTes({ pesertaId, jenis }: { pesertaId: string; jenis: "pre" | "post" }) {
  const label = jenis === "post" ? "Post-test" : "Pre-test";
  const dasar = `/api/belajar/${encodeURIComponent(pesertaId)}/tes/${jenis}`;
  const kembali = `/dashboard/belajar/${pesertaId}`;
  const [info, setInfo] = useState<TesPesertaRecord | null>(null);
  const [kerja, setKerja] = useState<PengerjaanRecord | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [nomor, setNomor] = useState(0);
  const [simpan, setSimpan] = useState<"" | "menyimpan" | "tersimpan" | "gagal">("");
  const [mengirim, setMengirim] = useState(false);
  const [tanya, setTanya] = useState<Tanya>(null);
  const [batas, setBatas] = useState(0);
  const [kini, setKini] = useState(() => Date.now());
  const antrean = useRef<Promise<unknown>>(Promise.resolve());
  const otomatis = useRef(false);

  const terima = useCallback((r: PengerjaanRecord | null) => {
    setKerja(r);
    if (r) setBatas(Date.now() + r.sisaDetik * 1000);
  }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    const [daftar, k] = await Promise.all([ambilJson<TesPesertaRecord[]>(`/api/belajar/${encodeURIComponent(pesertaId)}/tes`), ambilJson<PengerjaanRecord | null>(dasar)]);
    setMemuat(false);
    if (!k.ok) return setGalat(k.error);
    setGalat("");
    setInfo(daftar.ok ? (daftar.data.find((t) => t.jenis.toLowerCase() === jenis) ?? null) : null);
    terima(k.data);
  }, [pesertaId, dasar, jenis, terima]);

  useEffect(() => void muat(), [muat]);
  useEffect(() => {
    const h = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);

  const sisa = kerja?.status === "BERJALAN" ? Math.max(0, Math.round((batas - kini) / 1000)) : 0;
  const jam = `${Math.floor(sisa / 60)}:${String(sisa % 60).padStart(2, "0")}`;
  const terjawab = kerja ? kerja.soal.filter((s) => s.jawaban !== null).length : 0;
  const soal = kerja?.soal[nomor] ?? null;

  async function mulai() {
    setMemuat(true);
    const res = await kirimJson<PengerjaanRecord>(dasar, "POST");
    setMemuat(false);
    if (!res.ok) return setGalat(res.error);
    setNomor(0);
    terima(res.data);
  }

  function pilih(soalId: string, i: number) {
    if (!kerja || kerja.status !== "BERJALAN") return;
    setKerja((k) => (k ? { ...k, soal: k.soal.map((s) => (s.soalId === soalId ? { ...s, jawaban: i } : s)) } : k));
    setSimpan("menyimpan");
    antrean.current = antrean.current.then(async () => {
      const res = await kirimJson<PengerjaanRecord>(dasar, "PUT", { jawaban: { [soalId]: i } });
      if (res.ok) setSimpan("tersimpan");
      else {
        setSimpan("gagal");
        if (/Waktu habis|sudah dikirim|ditutup/i.test(res.error)) await muat();
      }
    });
  }

  const kirim = useCallback(
    async (k: PengerjaanRecord) => {
      setMengirim(true);
      await antrean.current;
      const jawaban = Object.fromEntries(k.soal.filter((s) => s.jawaban !== null).map((s) => [s.soalId, s.jawaban]));
      const res = await kirimJson<PengerjaanRecord>(dasar, "PUT", { jawaban, kirim: true });
      setMengirim(false);
      if (res.ok) terima(res.data);
      else await muat();
      const daftar = await ambilJson<TesPesertaRecord[]>(`/api/belajar/${encodeURIComponent(pesertaId)}/tes`);
      if (daftar.ok) setInfo((x) => daftar.data.find((t) => t.jenis.toLowerCase() === jenis) ?? x);
    },
    [dasar, muat, pesertaId, jenis, terima],
  );

  // Waktu habis: kirim otomatis sekali.
  useEffect(() => {
    if (kerja?.status === "BERJALAN" && sisa === 0 && batas > 0 && !otomatis.current) {
      otomatis.current = true;
      void kirim(kerja);
    }
  }, [kerja, sisa, batas, kirim]);

  function mintaKirim() {
    if (!kerja || mengirim) return;
    const kosong = kerja.soal.length - terjawab;
    setTanya({
      judul: kosong > 0 ? `${kosong} soal belum dijawab. Tetap kirim?` : "Kirim jawaban?",
      pesan: "Jawaban tidak bisa diubah lagi setelah dikirim.",
      tombol: "Kirim jawaban",
      lanjut: () => void kirim(kerja),
    });
  }

  const kritis = sisa > 0 && sisa <= 60;
  const status = useMemo(() => ({ menyimpan: "Menyimpan…", tersimpan: "Tersimpan", gagal: "Gagal menyimpan, pilih lagi", "": "" })[simpan], [simpan]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href={kembali} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Ruang belajar
      </Link>
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">{label}</h1>

      {memuat && !kerja ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48" />
        </div>
      ) : galat ? (
        <div className="mt-6 rounded-2xl border border-border p-5">
          <p role="alert" className="text-sm text-destructive">
            {galat}
          </p>
          <ButtonLink variant="secondary" size="sm" className="mt-4" href={kembali}>
            Kembali ke ruang belajar
          </ButtonLink>
        </div>
      ) : !kerja ? (
        <section className="mt-6 rounded-2xl border border-border p-5">
          {info ? (
            <>
              <p className="text-sm">
                <span className="font-mono">{info.jumlahSoal}</span> soal pilihan ganda · waktu <span className="font-mono">{info.durasiMenit}</span> menit
              </p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                {[
                  "Dikerjakan sekali. Waktu berjalan sejak menekan Mulai, termasuk bila halaman ditutup.",
                  "Jawaban tersimpan otomatis setiap Anda memilih; bila koneksi putus, buka lagi halaman ini untuk melanjutkan.",
                  "Saat waktu habis, jawaban yang sudah tersimpan dikirim otomatis.",
                  "Hasil tidak memengaruhi kelulusan. Kerjakan sendiri sesuai pemahaman Anda.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              {info.statusBerlaku === "DIBUKA" ? (
                <Button
                  className="mt-5"
                  onClick={() =>
                    setTanya({
                      judul: `Mulai ${label.toLowerCase()} sekarang?`,
                      pesan: `Waktu ${info.durasiMenit} menit langsung berjalan dan tidak bisa dihentikan.`,
                      tombol: "Mulai",
                      lanjut: () => void mulai(),
                    })
                  }
                >
                  Mulai {label.toLowerCase()}
                </Button>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">{info.statusBerlaku === "TERJADWAL" ? "Belum dibuka." : "Sudah ditutup."}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{label} belum tersedia.</p>
          )}
        </section>
      ) : kerja.status === "SELESAI" ? (
        <section className="mt-6 flex flex-col items-center rounded-2xl border border-border p-8 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <p className="mt-3 text-sm">Jawaban {label.toLowerCase()} sudah terkirim. Terima kasih.</p>
          {kerja.skor != null ? (
            <>
              <p className="mt-4 font-display text-5xl">{kerja.skor.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{kerja.benar}</span> dari <span className="font-mono">{kerja.jumlahSoal}</span> soal benar
              </p>
            </>
          ) : kerja.jenis === "PRE" ? (
            <p className="mt-2 text-sm text-muted-foreground">Skor pre-test ditampilkan bersama post-test di akhir pelatihan.</p>
          ) : null}
          <ButtonLink variant="secondary" className="mt-6" href={kembali}>
            Kembali ke ruang belajar
          </ButtonLink>
        </section>
      ) : (
        <>
          <div className="sticky top-14 z-10 -mx-4 mt-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:top-16">
            <span
              aria-live="polite"
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm", kritis ? "bg-destructive/12 text-destructive" : "bg-muted")}
            >
              <Clock3 size={14} /> {jam}
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{terjawab}</span>/{kerja.soal.length} terjawab
            </span>
            <span className={cn("ml-auto text-xs", simpan === "gagal" ? "text-destructive" : "text-muted-foreground")}>{status}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(terjawab / Math.max(1, kerja.soal.length)) * 100}%` }} />
          </div>

          {soal ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={soal.soalId}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.16 }}
                className="mt-5"
              >
                <p className="text-xs text-muted-foreground">
                  Soal <span className="font-mono">{soal.nomor}</span> dari <span className="font-mono">{kerja.soal.length}</span>
                </p>
                <p className="mt-2 text-base whitespace-pre-line text-pretty">{soal.pertanyaan}</p>
                <div role="radiogroup" aria-label="Pilihan jawaban" className="mt-4 flex flex-col gap-2">
                  {soal.opsi.map((o) => {
                    const dipilih = soal.jawaban === o.i;
                    return (
                      <button
                        key={o.i}
                        type="button"
                        role="radio"
                        aria-checked={dipilih}
                        onClick={() => pilih(soal.soalId, o.i)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                          dipilih ? "border-primary bg-primary/8" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs",
                            dipilih ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
                          )}
                        >
                          {o.huruf}
                        </span>
                        <span className="pt-0.5">{o.teks}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex justify-between gap-2">
                  <Button variant="ghost" disabled={nomor === 0} onClick={() => setNomor((n) => n - 1)}>
                    <ArrowLeft size={16} /> Sebelumnya
                  </Button>
                  {nomor < kerja.soal.length - 1 ? (
                    <Button variant="secondary" onClick={() => setNomor((n) => n + 1)}>
                      Berikutnya <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button disabled={mengirim} onClick={mintaKirim}>
                      <Send size={16} /> {mengirim ? "Mengirim…" : "Kirim jawaban"}
                    </Button>
                  )}
                </div>
              </motion.section>
            </AnimatePresence>
          ) : null}

          <section className="mt-8 rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Nomor soal</p>
            <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {kerja.soal.map((s, i) => (
                <button
                  key={s.soalId}
                  type="button"
                  aria-label={`Soal ${i + 1}${s.jawaban !== null ? " (terjawab)" : ""}`}
                  aria-current={i === nomor ? "step" : undefined}
                  onClick={() => setNomor(i)}
                  className={cn(
                    "aspect-square rounded-lg border font-mono text-xs transition-colors",
                    s.jawaban !== null ? "border-primary/40 bg-primary/12 text-primary" : "border-border text-muted-foreground",
                    i === nomor && "ring-2 ring-primary",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button variant="secondary" className="mt-4 w-full" disabled={mengirim} onClick={mintaKirim}>
              {mengirim ? "Mengirim…" : "Selesai & kirim jawaban"}
            </Button>
          </section>
        </>
      )}

      <Dialog open={tanya !== null} onOpenChange={(o) => !o && setTanya(null)}>
        <DialogContent title={tanya?.judul ?? ""} description={tanya?.pesan} className="max-w-md">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTanya(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                const t = tanya;
                setTanya(null);
                t?.lanjut();
              }}
            >
              {tanya?.tombol}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
