"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, ChevronRight, GraduationCap, Info, UserRound } from "lucide-react";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { Progress } from "@/components/arc/progress/progress";
import { Badge } from "@/components/arc/badge/badge";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { daftarMataPelatihan, getJenjang, jpTatapMuka, labelMode, labelTipeTahap, ringkasanKurikulum, tahapKurikulum, type TahapData } from "@/lib/kurikulum";
import { masihButuhWi } from "@/lib/kapasitas";
import { lamaHari } from "@/lib/jadwal";
import { rekapPengampu, type Pengampu, type RincianDiklat } from "@/lib/rincian";
import { cn } from "@/lib/utils";

type SaringMp = "semua" | "kosong" | "terisi";

export function IsiRincian({ rincian: d, bolehAtur }: { rincian: RincianDiklat; bolehAtur: boolean }) {
  const r = rekapPengampu(d);
  const butuhWi = masihButuhWi(d, r.wiDisetujui, r.jpDisetujui);
  const jenjang = getJenjang(d.jenisPelatihan);

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Ringkasan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Peserta" value={d.participants} suffix={"\u00a0orang"} context={d.participants > 0 ? "Jumlah rencana peserta" : "Belum diisi"} />
        <MetricCard label="Lama" value={lamaHari(d)} suffix={"\u00a0hari"} context={d.status === "Berjalan" ? "Sedang berlangsung" : d.status === "Terjadwal" ? "Belum dimulai" : "Sudah selesai"} />
        <MetricCard
          label="JP pengampu"
          value={r.jpDisetujui}
          suffix={d.jpDibutuhkan > 0 ? `\u00a0/\u00a0${d.jpDibutuhkan}\u00a0JP` : "\u00a0JP"}
          context={d.jpDibutuhkan > 0 ? `${r.persen}% kebutuhan terisi` : "Kebutuhan JP belum diisi"}
        />
        <MetricCard label="Pengampu" value={r.wiDisetujui} suffix={"\u00a0WI"} context={butuhWi ? "Masih butuh pengampu" : "Kebutuhan terpenuhi"} />
      </section>

      {d.jpDibutuhkan > 0 ? (
        <div className="-mt-6">
          <Progress value={r.persen} label="JP pengampu terisi" showValue />
        </div>
      ) : null}

      {r.menunggu.length > 0 ? (
        <Alert tone="warning" title={`${r.menunggu.length} pengajuan lama belum ditetapkan`}>
          <span className="font-mono">{r.jpMenunggu}</span> JP dari pengajuan sebelum 27 Okt 2026. Lihat daftar pengampu di bawah.
        </Alert>
      ) : null}

      {jenjang ? <Kurikulum d={d} /> : null}
      {jenjang ? <MataPelatihan d={d} aktif={r.aktif} /> : null}
      <DaftarPengampu daftar={d.penugasan} bolehAtur={bolehAtur} />
    </div>
  );
}

function Judul({ ikon, judul, keterangan }: { ikon: React.ReactNode; judul: string; keterangan?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-base font-medium">
        <span className="text-muted-foreground" aria-hidden>
          {ikon}
        </span>
        {judul}
      </h2>
      {keterangan ? <p className="mt-1 max-w-3xl text-sm text-pretty text-muted-foreground">{keterangan}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Kurikulum */

function Kurikulum({ d }: { d: RincianDiklat }) {
  const jenjang = getJenjang(d.jenisPelatihan)!;
  const tahap = tahapKurikulum(d.jenisPelatihan, d.modePelatihan);
  const ringkas = ringkasanKurikulum(d.jenisPelatihan, d.modePelatihan);
  const tatapMuka = jpTatapMuka(d.jenisPelatihan, d.modePelatihan);
  const totalJp = tahap.reduce((n, t) => n + t.jp, 0);

  return (
    <section aria-labelledby="judul-kurikulum">
      <div id="judul-kurikulum">
        <Judul
          ikon={<BookOpen className="size-4" />}
          judul={`Kurikulum ${jenjang.kode}`}
          keterangan={
            <>
              {jenjang.nama}, {labelMode(d.modePelatihan).toLowerCase()}. Keputusan Kepala LAN No. 1/K.1/PDP.07/2023 dan No. 2/K.1/PDP.07/2023.
              {ringkas ? (
                <>
                  {" "}
                  Total <span className="font-mono text-foreground">{ringkas.totalJp}</span> JP dalam <span className="font-mono text-foreground">{ringkas.totalHari}</span> hari;{" "}
                  <span className="font-mono text-foreground">{tatapMuka}</span> JP di antaranya tatap muka.
                </>
              ) : null}
            </>
          }
        />
      </div>

      {/* Batang komposisi JP per tahap: arahkan atau fokus untuk melihat namanya. */}
      {totalJp > 0 ? (
        <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {tahap.map((t, i) => (
            <motion.div
              key={i}
              title={`${t.nama}: ${t.jp} JP`}
              className={cn("h-full border-r-2 border-background last:border-r-0", WARNA_TAHAP[t.tipe])}
              initial={{ width: 0 }}
              animate={{ width: `${(t.jp / totalJp) * 100}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 24, delay: i * 0.04 }}
            />
          ))}
        </div>
      ) : null}

      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {tahap.map((t, i) => (
          <BarisTahap key={i} t={t} nomor={i + 1} />
        ))}
      </ol>
    </section>
  );
}

const WARNA_TAHAP: Record<TahapData["tipe"], string> = {
  KLASIKAL: "bg-[var(--tone-sky)]",
  ELEARNING: "bg-[var(--tone-violet)]",
  MANDIRI: "bg-[var(--tone-teal)]",
  KOMITMEN_BERSAMA: "bg-[var(--tone-amber)]",
  STUDI_LAPANGAN: "bg-[var(--tone-orchid)]",
  AKTUALISASI: "bg-[var(--tone-green)]",
};

function BarisTahap({ t, nomor }: { t: TahapData; nomor: number }) {
  const [buka, setBuka] = useState(false);
  const reduce = useReducedMotion();
  const adaRincian = (t.kegiatan?.length ?? 0) > 1;
  const isi = (
    <>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", WARNA_TAHAP[t.tipe])} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {nomor}. {t.nama}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {labelTipeTahap(t.tipe)}
          {t.jpSync ? ` · ${t.jpSync} JP sinkron, ${t.jpAsync ?? 0} JP asinkron` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm">{t.jp} JP</span>
        <span className="block text-xs text-muted-foreground">{t.hari ? `${t.hari} hari${t.hariKalender ? " kalender" : ""}` : "–"}</span>
      </span>
      {adaRincian ? (
        <motion.span animate={{ rotate: buka ? 90 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="mt-0.5 text-muted-foreground" aria-hidden>
          <ChevronRight className="size-4" />
        </motion.span>
      ) : (
        <span className="w-4" aria-hidden />
      )}
    </>
  );

  return (
    <li>
      {adaRincian ? (
        <button type="button" onClick={() => setBuka((v) => !v)} aria-expanded={buka} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-card">
          {isi}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">{isi}</div>
      )}
      <AnimatePresence initial={false}>
        {buka && adaRincian ? (
          <motion.ul
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="overflow-hidden bg-card/60"
          >
            {t.kegiatan!.map((k, j) => (
              <li key={j} className="flex justify-between gap-4 border-t border-border py-2 pr-11 pl-9 text-sm">
                <span className="text-muted-foreground">{k.nama}</span>
                <span className="shrink-0 font-mono text-muted-foreground">{k.jp} JP</span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/* ------------------------------------------------------- Mata pelatihan */

function MataPelatihan({ d, aktif }: { d: RincianDiklat; aktif: Pengampu[] }) {
  const [saring, setSaring] = useState<SaringMp>("semua");
  const kelompok = useMemo(() => {
    const grup: { nama: string; baris: { kode: string; nama: string; pengampu: Pengampu[] }[] }[] = [];
    for (const mp of daftarMataPelatihan(d.jenisPelatihan)) {
      let g = grup.find((x) => x.nama === mp.kelompok);
      if (!g) grup.push((g = { nama: mp.kelompok, baris: [] }));
      g.baris.push({ kode: mp.kode, nama: mp.nama, pengampu: aktif.filter((p) => p.mataPelatihan === mp.kode) });
    }
    return grup;
  }, [d.jenisPelatihan, aktif]);

  const semua = kelompok.flatMap((g) => g.baris);
  const terisi = semua.filter((b) => b.pengampu.some((p) => p.status === "disetujui")).length;
  const cocok = (b: (typeof semua)[number]) => {
    const ada = b.pengampu.some((p) => p.status === "disetujui");
    return saring === "semua" || (saring === "terisi" ? ada : !ada);
  };

  return (
    <section aria-labelledby="judul-mp">
      <div id="judul-mp" className="flex flex-wrap items-end justify-between gap-3">
        <Judul
          ikon={<GraduationCap className="size-4" />}
          judul="Mata pelatihan & pengampu"
          keterangan={
            <>
              <span className="font-mono text-foreground">{terisi}</span> dari <span className="font-mono text-foreground">{semua.length}</span> mata pelatihan sudah punya
              pengampu. Satu mata pelatihan boleh diampu lebih dari satu WI.
            </>
          }
        />
        <div className="mb-4">
          <SegmentedControl
            label="Saring mata pelatihan"
            value={saring}
            onValueChange={(v) => setSaring(v as SaringMp)}
            options={[
              { value: "semua", label: "Semua" },
              { value: "kosong", label: "Belum ada pengampu" },
              { value: "terisi", label: "Sudah ada" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6">
        {kelompok.map((g) => {
          const baris = g.baris.filter(cocok);
          if (baris.length === 0) return null;
          return (
            <div key={g.nama}>
              <p className="mb-2 text-xs text-muted-foreground">{g.nama}</p>
              <motion.ul layout className="grid gap-2 md:grid-cols-2">
                <AnimatePresence initial={false}>
                  {baris.map((b) => (
                    <motion.li
                      key={b.kode}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="rounded-2xl border border-border p-4"
                    >
                      <p className="text-sm font-medium">{b.nama}</p>
                      {b.pengampu.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {b.pengampu.map((p) => (
                            <li key={p.id}>
                              <Badge tone={p.status === "disetujui" ? "neutral" : "warning"} icon={<UserRound size={12} />}>
                                {p.instructorName} · <span className="font-mono">{p.jp}</span> JP{p.status === "menunggu" ? " · menunggu" : ""}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Belum ada pengampu</p>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Daftar pengampu */

function DaftarPengampu({ daftar, bolehAtur }: { daftar: Pengampu[]; bolehAtur: boolean }) {
  return (
    <section aria-labelledby="judul-pengampu">
      <div id="judul-pengampu">
        <Judul
          ikon={<UserRound className="size-4" />}
          judul={`Pengampu (${daftar.length})`}
          keterangan="Pengampu langsung berlaku begitu ditetapkan; formalitasnya surat tugas. Sesi mengajar dicatat per pengampu."
        />
      </div>
      {bolehAtur ? (
        <Alert tone="info" title="Menetapkan pengampu dan mencatat sesi menyusul" className="mb-4">
          Di versi baru ini daftar pengampu baru bisa dilihat. Untuk menetapkan pengampu, mencatat sesi mengajar, dan surat tugas, pakai aplikasi lama sementara waktu.
        </Alert>
      ) : null}
      {daftar.length === 0 ? (
        <EmptyState icon={<Info size={20} />} title="Belum ada pengampu" description="Pengampu jadwal ini akan tampil di sini setelah ditetapkan." />
      ) : (
        <ul className="grid gap-2">
          {daftar.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-2xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {p.instructorName}
                  {p.status === "menunggu" ? (
                    <Badge size="sm" tone="warning">
                      Pengajuan lama · belum ditetapkan
                    </Badge>
                  ) : null}
                  {p.status === "ditolak" ? (
                    <Badge size="sm" tone="danger">
                      Ditolak
                    </Badge>
                  ) : null}
                  {p.overCapacity ? (
                    <Badge size="sm" tone="danger" outline>
                      Melebihi batas JP bulanan
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{p.jp}</span> JP{p.mataPelatihanNama ? ` · ${p.mataPelatihanNama}` : ""} · dicatat {p.diajukanOleh}
                </p>
                {p.catatan ? <p className="mt-1 text-xs break-words text-muted-foreground">Catatan: {p.catatan}</p> : null}
                {p.alasanTolak ? <p className="mt-1 text-xs break-words text-destructive">Alasan ditolak: {p.alasanTolak}</p> : null}
              </div>
              {p.status === "disetujui" ? (
                <div className="w-full shrink-0 sm:w-48">
                  <p className="mb-1 text-right text-xs text-muted-foreground">
                    <span className="font-mono">{p.jpSesi}</span>/<span className="font-mono">{p.jp}</span> JP di {p.jmlSesi} sesi
                  </p>
                  <Progress value={p.jp > 0 ? Math.min(100, Math.round((p.jpSesi / p.jp) * 100)) : 0} aria-label={`Sesi mengajar ${p.instructorName}`} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
