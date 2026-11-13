"use client";

import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { Download, Printer } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import Toast from "@/components/arc/toast/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { LABEL_STATUS_PESERTA } from "@/lib/peserta";
import type { JenisEvaluasi } from "@/lib/kurikulum";
import {
  EVALUASI,
  JUMLAH_TERBAIK,
  LABEL_KELULUSAN,
  LABEL_KUALIFIKASI,
  LABEL_PENILAI,
  NILAI_REMEDIAL_MAKS,
  bacaNilai,
  formatNilai,
  kodeRemedial,
  type Kualifikasi,
  type StatusKelulusan,
} from "@/lib/penilaian";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { LembarPenilaianRecord, PesertaPenilaianRecord } from "@/lib/server/types";

const NADA_KUAL: Record<Kualifikasi, BadgeTone> = { SANGAT_MEMUASKAN: "success", MEMUASKAN: "success", BAIK: "info", KURANG_BAIK: "warning", TIDAK_MEMENUHI: "danger" };
const NADA_LULUS: Record<StatusKelulusan, BadgeTone> = { LULUS: "success", DITUNDA: "warning", TIDAK_LULUS: "danger", BELUM_LENGKAP: "neutral" };
const URUTAN_LULUS: StatusKelulusan[] = ["LULUS", "DITUNDA", "TIDAK_LULUS", "BELUM_LENGKAP"];
const SEL =
  "h-8 w-16 rounded-lg border bg-transparent px-2 text-right font-mono text-sm outline-none focus:border-primary disabled:opacity-50 placeholder:text-muted-foreground/60";
const keTeks = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const kunci = (pid: string, kode: string) => `${pid}|${kode}`;

/**
 * Tab Penilaian (sama dengan aplikasi lama): lembar nilai 0–100 per jenis evaluasi (boleh tempel blok dari Excel), lalu
 * Rekap & Kelulusan (Formulir 14: nilai × bobot, nilai akhir, kualifikasi, kelulusan, peringkat, remedial) dengan unduhan
 * CSV dan cetak Formulir 14. Ketua Diklat/admin mengisi nilai rekap (didahulukan); WI yang ditugaskan mengisi aspek
 * bagiannya (dirata-rata bila lebih dari satu); Kepala Balai melihat saja. Semua dijaga di API.
 */
export function TabPenilaian({ awal }: { awal: LembarPenilaianRecord }) {
  const [data, setData] = useState(awal);
  const wi = data.peran === "WI";
  const penyelenggara = data.peran === "PENYELENGGARA";
  const evaluasiAda = EVALUASI.filter((e) => data.aspek.some((a) => a.jenisEvaluasi === e.kode));
  const [tab, setTab] = useState<JenisEvaluasi | "REKAP">(evaluasiAda[0]?.kode ?? "REKAP");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const peserta = data.peserta;
  const aktif = peserta.filter((p) => p.status === "AKTIF");
  const aspekTab = tab === "REKAP" ? [] : data.aspek.filter((a) => a.jenisEvaluasi === tab);
  const bobot = (j: JenisEvaluasi) => data.aspek.filter((a) => a.jenisEvaluasi === j).reduce((s, a) => s + a.bobot, 0);
  const evaluasiPeserta = (p: PesertaPenilaianRecord, j: JenisEvaluasi) => p.hasil?.evaluasi.find((e) => e.kode === j) ?? null;

  /** Isian tersimpan milik pengguna ini (WI: isiannya; penyelenggara: nilai rekap). */
  function awalSel(p: PesertaPenilaianRecord, kode: string): number | null {
    const jenis = /^REMEDIAL-(.+)$/.exec(kode)?.[1] as JenisEvaluasi | undefined;
    if (jenis) return p.remedial?.[jenis] ?? null;
    const sel = p.nilai[kode];
    if (!sel) return null;
    if (wi) return sel.milikSaya;
    return sel.dari === "REKAP" ? sel.nilai : null;
  }
  /** Rata-rata isian WI sebagai petunjuk bila penyelenggara belum menetapkan nilai. */
  const petunjuk = (p: PesertaPenilaianRecord, kode: string) => {
    const sel = p.nilai[kode];
    return !sel || wi || sel.dari !== "RATA" ? "" : keTeks(sel.nilai);
  };
  const teksSel = (p: PesertaPenilaianRecord, kode: string) => draft[kunci(p.id, kode)] ?? keTeks(awalSel(p, kode));
  const salah = (p: PesertaPenilaianRecord, kode: string) => {
    const t = draft[kunci(p.id, kode)];
    return t !== undefined && bacaNilai(t) === undefined;
  };

  const perubahan = useMemo(() => {
    const out: { pesertaId: string; kodeAspek: string; nilai: number | null; sah: boolean }[] = [];
    for (const [k, teks] of Object.entries(draft)) {
      const [pid, kode] = k.split("|");
      const p = data.peserta.find((x) => x.id === pid);
      if (!p) continue;
      const n = bacaNilai(teks);
      if (n === undefined) out.push({ pesertaId: pid, kodeAspek: kode, nilai: null, sah: false });
      else if (n !== awalSel(p, kode)) out.push({ pesertaId: pid, kodeAspek: kode, nilai: n, sah: true });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, data]);

  // Peringatan bila menutup/memuat ulang halaman dengan isian belum tersimpan.
  useEffect(() => {
    const cegah = (e: BeforeUnloadEvent) => {
      if (perubahan.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [perubahan.length]);

  const ketik = (p: PesertaPenilaianRecord, kode: string, teks: string) => setDraft((d) => ({ ...d, [kunci(p.id, kode)]: teks }));

  /** Tempel blok dari Excel: ke kanan (aspek) dan ke bawah (peserta aktif); sel kosong dilewati. */
  function tempel(e: ClipboardEvent<HTMLInputElement>, mulai: PesertaPenilaianRecord, kolom: number) {
    const teks = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(teks.trim())) return;
    e.preventDefault();
    const baris = aktif.indexOf(mulai);
    if (baris < 0) return;
    const baru: Record<string, string> = {};
    teks
      .replace(/\r/g, "")
      .replace(/\n+$/, "")
      .split("\n")
      .forEach((r, i) => {
        const p = aktif[baris + i];
        if (!p) return;
        r.split("\t").forEach((v, j) => {
          const a = aspekTab[kolom + j];
          const isi = v.replace(/ /g, "").trim();
          if (a && isi !== "" && (!wi || (a.bisaDiisiWi && p.nilai[a.kode]?.bolehIsi !== false))) baru[kunci(p.id, a.kode)] = isi;
        });
      });
    setDraft((d) => ({ ...d, ...baru }));
  }

  async function simpan() {
    setGalat("");
    const tidakSah = perubahan.filter((x) => !x.sah);
    if (tidakSah.length) return setGalat(`${tidakSah.length} isian bukan angka 0–100 (paling banyak 2 desimal). Perbaiki sel yang bergaris merah.`);
    const kirim = perubahan.map(({ pesertaId, kodeAspek, nilai }) => ({ pesertaId, kodeAspek, nilai }));
    if (!kirim.length) return setDraft({});
    setSibuk(true);
    const res = await kirimJson<LembarPenilaianRecord>(`/api/training/${encodeURIComponent(data.training.id)}/penilaian`, "PUT", { nilai: kirim });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setDraft({});
    setToast(`${kirim.length} nilai tersimpan.`);
  }

  function progres(j: JenisEvaluasi) {
    const as = data.aspek.filter((a) => a.jenisEvaluasi === j);
    let isi = 0;
    for (const p of aktif)
      for (const a of as) {
        const sel = p.nilai[a.kode];
        if (wi ? sel?.milikSaya != null : sel?.nilai != null) isi++;
      }
    return { isi, total: as.length * aktif.length };
  }

  const ringkasan = URUTAN_LULUS.map((s) => ({ s, n: aktif.filter((p) => p.hasil?.status === s).length })).filter((x) => x.n);

  function unduhCsv() {
    const angka = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2).replace(".", ","));
    const sel = (t: string) => (/[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    const kepala = [
      "No",
      "Nama Peserta",
      "NIP",
      ...evaluasiAda.map((e) => `${e.label} (${bobot(e.kode)}%)`),
      "Nilai Akhir",
      "Kualifikasi",
      "Kelulusan",
      "Peringkat",
      "Status Peserta",
    ];
    const baris = peserta.map((p) => [
      String(p.nomor),
      p.nama,
      p.nip ? `="${p.nip}"` : "",
      ...evaluasiAda.map((e) => angka(evaluasiPeserta(p, e.kode)?.kontribusi)),
      angka(p.hasil?.nilaiAkhir),
      p.hasil?.kualifikasi ? LABEL_KUALIFIKASI[p.hasil.kualifikasi] : "",
      p.hasil ? LABEL_KELULUSAN[p.hasil.status] : "",
      p.peringkat ? String(p.peringkat) : "",
      LABEL_STATUS_PESERTA[p.status],
    ]);
    const csv = "﻿" + [kepala, ...baris].map((r) => r.map(sel).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap nilai akhir - ${data.training.name}.csv`.replace(/[\\/:*?"<>|]/g, "-");
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const namaPeserta = (p: PesertaPenilaianRecord, catatanKehadiran = false) => (
    <div className="min-w-0">
      <p className="truncate text-sm">
        <span className="font-mono text-xs text-muted-foreground">{p.nomor}.</span> {p.nama}
      </p>
      {p.status !== "AKTIF" ? (
        <Badge size="sm">{LABEL_STATUS_PESERTA[p.status]}</Badge>
      ) : catatanKehadiran && p.kehadiran === "batas" ? (
        <Badge size="sm" tone="danger">
          Kehadiran di batas
        </Badge>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        {wi ? (
          <p>
            Isi nilai <span className="font-mono">0–100</span> untuk aspek yang Anda nilai (pengampu materi, penguji, pendamping studi lapangan, coach). Nilai seminar RAP/LAP hanya
            untuk peserta yang Anda uji atau bimbing sebagai coach. Bila beberapa Widyaiswara menilai aspek yang sama, nilainya dirata-rata; Ketua Diklat dapat menetapkan nilai
            akhirnya.
          </p>
        ) : (
          <p>
            <span className="text-foreground">{aktif.length} peserta aktif</span> · nilai 0–100 per aspek, dikalikan bobotnya (Formulir 14).
            {penyelenggara ? " Angka pucat di sel = rata-rata isian Widyaiswara; ketik untuk menetapkan nilai." : ""}
          </p>
        )}
        {data.bolehUbah ? <p className="mt-1 text-xs">Tip: salin satu kolom atau blok nilai dari Excel, klik sel pertama, lalu tempel (Ctrl+V).</p> : null}
      </div>

      <div className="tanpa-bilah sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur" role="group" aria-label="Jenis evaluasi">
        {evaluasiAda.map((e) => {
          const pr = progres(e.kode);
          return (
            <button
              key={e.kode}
              type="button"
              aria-pressed={tab === e.kode}
              onClick={() => setTab(e.kode)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs",
                tab === e.kode ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              {e.singkat} <span className="font-mono opacity-80">{wi ? `${pr.isi} terisi` : `${pr.isi}/${pr.total}`}</span>
            </button>
          );
        })}
        {!wi ? (
          <button
            type="button"
            aria-pressed={tab === "REKAP"}
            onClick={() => setTab("REKAP")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs",
              tab === "REKAP" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            Rekap & Kelulusan
          </button>
        ) : null}
      </div>

      {!peserta.length ? (
        <EmptyState title="Belum ada peserta" description={`Tambahkan dulu di tab Peserta${wi ? " (oleh Ketua Diklat)" : ""}.`} />
      ) : tab !== "REKAP" ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-medium">
            {EVALUASI.find((e) => e.kode === tab)?.label} <span className="text-sm text-muted-foreground">· bobot {bobot(tab)}%</span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left align-bottom text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-44 bg-muted px-3 py-2 font-medium">Peserta</th>
                  {aspekTab.map((a) => (
                    <th key={a.kode} className="min-w-28 max-w-44 px-2 py-2 font-normal" title={a.nama}>
                      <span className="line-clamp-3 font-medium text-foreground">{a.nama}</span>
                      <span className="mt-0.5 block">
                        <span className="font-mono">{a.bobot}%</span> · {LABEL_PENILAI[a.penilai]}
                      </span>
                    </th>
                  ))}
                  {!wi ? <th className="px-3 py-2 text-right font-medium">Nilai evaluasi</th> : null}
                </tr>
              </thead>
              <tbody>
                {peserta.map((p) => {
                  const evp = evaluasiPeserta(p, tab);
                  return (
                    <tr key={p.id} className={cn("border-t border-border", p.status !== "AKTIF" && "opacity-60")}>
                      <td className="sticky left-0 z-10 bg-background px-3 py-2">{namaPeserta(p)}</td>
                      {aspekTab.map((a, j) => {
                        const sel = p.nilai[a.kode];
                        return (
                          <td key={a.kode} className="px-2 py-2">
                            {data.bolehUbah && (!wi || (a.bisaDiisiWi && sel?.bolehIsi !== false)) ? (
                              <>
                                <input
                                  className={cn(SEL, salah(p, a.kode) ? "border-destructive" : "border-border")}
                                  inputMode="decimal"
                                  aria-label={`Nilai ${p.nama}: ${a.nama}`}
                                  value={teksSel(p, a.kode)}
                                  placeholder={petunjuk(p, a.kode)}
                                  disabled={p.status !== "AKTIF"}
                                  onChange={(e) => ketik(p, a.kode, e.target.value)}
                                  onPaste={(e) => tempel(e, p, j)}
                                />
                                {!wi && sel && sel.jumlahPenilai > 0 ? (
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground" title="Banyaknya Widyaiswara yang mengisi aspek ini">
                                    {sel.jumlahPenilai} WI
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="font-mono">{sel?.nilai == null ? "–" : formatNilai(sel.nilai)}</span>
                            )}
                          </td>
                        );
                      })}
                      {!wi ? (
                        <td className="px-3 py-2 text-right">
                          {evp?.nilai != null && evp.kualifikasiAwal ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono">{formatNilai(evp.nilai)}</span>
                              <Badge size="sm" tone={NADA_KUAL[evp.kualifikasiAwal]}>
                                {LABEL_KUALIFIKASI[evp.kualifikasiAwal]}
                              </Badge>
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{evp ? `${evp.terisi}/${evp.jumlahAspek} aspek` : "–"}</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {ringkasan.map(({ s, n }) => (
                <Badge key={s} tone={NADA_LULUS[s]}>
                  <span className="font-mono">{n}</span> {LABEL_KELULUSAN[s].toLowerCase()}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink size="sm" variant="secondary" href={`/cetak/formulir-14/${data.training.id}`} target="_blank" rel="noopener">
                <Printer size={14} /> Cetak Formulir 14
              </ButtonLink>
              <Button size="sm" variant="secondary" onClick={unduhCsv}>
                <Download size={14} /> Unduh CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left align-bottom text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-44 bg-muted px-3 py-2 font-medium">Peserta</th>
                  {evaluasiAda.map((e) => (
                    <th key={e.kode} className="px-2 py-2 text-right font-medium" title={e.label}>
                      {e.singkat}
                      <span className="block font-mono font-normal">{bobot(e.kode)}%</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Nilai akhir</th>
                  <th className="px-3 py-2 font-medium">Kelulusan</th>
                  <th className="px-3 py-2 text-right font-medium">Peringkat</th>
                </tr>
              </thead>
              <tbody>
                {peserta.map((p) => (
                  <tr key={p.id} className={cn("border-t border-border align-top", p.status !== "AKTIF" && "opacity-60")}>
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">{namaPeserta(p, true)}</td>
                    {evaluasiAda.map((e) => {
                      const ev = evaluasiPeserta(p, e.kode);
                      return (
                        <td
                          key={e.kode}
                          className={cn(
                            "px-2 py-2 text-right font-mono",
                            ev?.kualifikasi === "TIDAK_MEMENUHI" && "bg-destructive/10 text-destructive",
                            ev?.kualifikasi === "KURANG_BAIK" && "bg-warning/10 text-warning",
                          )}
                          title={
                            ev?.nilaiDipakai != null && ev.kualifikasi
                              ? `Nilai ${formatNilai(ev.nilaiDipakai)} — ${LABEL_KUALIFIKASI[ev.kualifikasi]}${ev.remedial !== null ? " (remedial)" : ""}`
                              : `${ev?.terisi ?? 0}/${ev?.jumlahAspek ?? 0} aspek terisi`
                          }
                        >
                          {ev?.kontribusi == null ? "–" : formatNilai(ev.kontribusi)}
                          {ev?.remedial != null ? <span className="block font-sans text-[11px]">remedial</span> : null}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      <span className="font-mono">{formatNilai(p.hasil?.nilaiAkhir)}</span>
                      {p.hasil?.kualifikasi ? <span className="block text-xs text-muted-foreground">{LABEL_KUALIFIKASI[p.hasil.kualifikasi]}</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      {p.hasil ? (
                        <>
                          <Badge size="sm" tone={NADA_LULUS[p.hasil.status]}>
                            {LABEL_KELULUSAN[p.hasil.status]}
                          </Badge>
                          {p.hasil.status !== p.hasil.statusAwal ? <span className="block text-xs text-muted-foreground">setelah remedial</span> : null}
                          {p.hasil.perluKeputusanTim ? (
                            <span className="mt-1 block max-w-56 text-xs text-muted-foreground">
                              Sikap perilaku kurang baik tidak bisa diremedial — diputus Tim Evaluasi Akhir.
                            </span>
                          ) : null}
                          {p.hasil.perluRemedial.length && p.status === "AKTIF" ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {p.hasil.perluRemedial.map((jenis) => {
                                const kode = kodeRemedial(jenis);
                                const label = `Remedial ${EVALUASI.find((x) => x.kode === jenis)?.singkat.toLowerCase()}`;
                                return (
                                  <label key={jenis} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="w-28">{label}</span>
                                    {penyelenggara ? (
                                      <input
                                        className={cn(SEL, salah(p, kode) ? "border-destructive" : "border-border")}
                                        inputMode="decimal"
                                        aria-label={`${label} ${p.nama}`}
                                        value={teksSel(p, kode)}
                                        onChange={(e) => ketik(p, kode, e.target.value)}
                                      />
                                    ) : (
                                      <span className="font-mono text-foreground">{formatNilai(p.remedial?.[jenis] ?? null)}</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.peringkat ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono">{p.peringkat}</span>
                          {p.peringkat <= JUMLAH_TERBAIK ? (
                            <Badge size="sm" tone="info">
                              Terbaik
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Lulus bila kelima evaluasi minimal &quot;baik&quot; (&gt; 70); ada yang &quot;kurang baik&quot; (60,01–70) = ditunda dan mendapat satu kali remedial (kecuali sikap
            perilaku), nilai akhir setelah remedial paling tinggi {NILAI_REMEDIAL_MAKS},00; ada yang &quot;tidak memenuhi&quot; (≤ 60) = tidak lulus. Peringkat {JUMLAH_TERBAIK}{" "}
            terbaik hanya di antara peserta aktif yang lulus. Penetapan tetap oleh Tim Evaluasi Akhir.
          </p>
        </section>
      )}

      {data.bolehUbah && (perubahan.length > 0 || galat) ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-3">
          {perubahan.length ? (
            <>
              <Button disabled={sibuk} onClick={simpan}>
                {sibuk ? "Menyimpan…" : `Simpan ${perubahan.length} perubahan`}
              </Button>
              <Button
                variant="ghost"
                disabled={sibuk}
                onClick={() => {
                  setDraft({});
                  setGalat("");
                }}
              >
                Batalkan
              </Button>
            </>
          ) : null}
          {galat ? <Alert tone="danger" title={galat} className="flex-1" /> : null}
        </div>
      ) : null}
      <Toast title="Penilaian" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
