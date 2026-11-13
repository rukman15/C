"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Download, ExternalLink, FileText, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Alert } from "@/components/arc/alert/alert";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { LABEL_KEHADIRAN, labelBentuk } from "@/lib/kehadiran";
import { LABEL_STATUS_PESERTA } from "@/lib/peserta";
import { TAUTAN_MANDIRI_LAN } from "@/lib/beranda-peserta";
import { formatUkuran, materiProgram } from "@/lib/materi";
import { PERAN_SEMINAR, infoSeminar } from "@/lib/seminar";
import { LABEL_STATUS_TES } from "@/lib/tes";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import { JENIS_KELOMPOK_COACH } from "@/lib/kelompok";
import type { RuangBelajarRecord } from "@/lib/server/types";
import type { TesPesertaRecord } from "@/lib/server/repositories/tes";
import type { EvaluasiPesertaRecord } from "@/lib/server/repositories/evaluasi";
import type { MentorSayaRecord } from "@/lib/server/repositories/penugasan-angkatan";
import type { RekeningSayaRecord } from "@/lib/server/repositories/rekening-mentor";
import { labelProgram, periodeDiklat } from "./bagian";
import { FolderPeserta, type RingkasTugasWi } from "./folder-peserta";
import { KalenderSesi } from "@/components/absensi/kalender-sesi";
import type { ItemBerkas } from "@/lib/server/repositories/berkas-peserta";

type Props = {
  data: RuangBelajarRecord;
  tes: TesPesertaRecord[];
  evaluasi: EvaluasiPesertaRecord | null;
  mentor: MentorSayaRecord | null;
  rekening?: RekeningSayaRecord | null;
  folder: ItemBerkas[];
  tugasWi: RingkasTugasWi;
};

const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const namaHari = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    timeZone: "UTC",
  });
const waktuTes = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      })
    : null;

const NADA_HADIR: Record<string, BadgeTone> = {
  HADIR: "success",
  TIDAK_HADIR: "danger",
  DISPENSASI: "warning",
};
const TINGKAT: Record<string, { label: string; nada: BadgeTone }> = {
  aman: { label: "Aman", nada: "success" },
  peringatan: { label: "Mendekati batas", nada: "warning" },
  batas: { label: "Mencapai batas", nada: "danger" },
};
const LABEL_PANGGIL: Record<string, string> = {
  DIPANGGIL: "Giliran Anda, segera menuju ruang seminar",
  PRESENTASI: "Sedang presentasi",
  SELESAI: "Seminar selesai",
  TIDAK_HADIR: "Tercatat tidak hadir",
};
const STATUS_SEMINAR = {
  "belum-dijadwalkan": { teks: "Belum dijadwalkan", nada: "neutral" },
  "akan-datang": { teks: "Terjadwal", nada: "info" },
  "hari-ini": { teks: "Hari ini", nada: "warning" },
  selesai: { teks: "Sudah lewat", nada: "success" },
} as const;
const URAIAN_TAHAP: Record<string, string> = {
  ELEARNING:
    "Daring dari tempat kedudukan: sesi sinkron (tatap maya terjadwal, wajib hadir) dan asinkron (materi dikerjakan sesuai waktu masing-masing). Peserta dibagi dalam kelompok kecil.",
  KOMITMEN_BERSAMA: "Di instansi asal: diagnosa permasalahan dan membangun komitmen dengan atasan serta pemangku kepentingan.",
  AKTUALISASI: "Di tempat kerja: menerapkan rencana aksi perubahan dengan pendampingan coach dan mentor. Laporan (RAP/LAP) disusun pada tahap ini.",
  KLASIKAL: "Tatap muka di BBPKA-PDN II Jatinangor. Kehadiran dicatat penyelenggara; lihat tab Jadwal.",
};

function Panel({ judul, aksi, className, children }: { judul?: React.ReactNode; aksi?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border p-5", className)}>
      {judul || aksi ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          {judul ? <h2 className="text-sm font-medium">{judul}</h2> : <span />}
          {aksi}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Ruang belajar satu peserta. Isi sama dengan aplikasi lama; disusun dalam tab supaya ringkas di HP.
 * Pada hari seminar halaman dimuat ulang tiap 30 detik supaya panggilan evaluator terlihat.
 */
export function RuangBelajar({ data, tes, evaluasi, mentor, rekening, folder, tugasWi }: Props) {
  const router = useRouter();
  const t = data.training;
  const id = data.peserta.id;
  const hariIni = hariIniWib();
  const iAktif = Math.min(Math.max(data.tahapAktif, 0), Math.max(data.tahap.length - 1, 0));
  const [tahapDipilih, setTahapDipilih] = useState<number | null>(null);
  const [semuaSesi, setSemuaSesi] = useState(false);
  const [tglJadwal, setTglJadwal] = useState<string | null>(null);

  const seminar = useMemo(() => infoSeminar(t.jenisPelatihan, t.modePelatihan, data.sesi, hariIni), [t.jenisPelatihan, t.modePelatihan, data.sesi, hariIni]);
  const materi = materiProgram(t.jenisPelatihan);
  const kelompokCoach = data.kelompok.find((k) => k.jenis === JENIS_KELOMPOK_COACH) ?? null;
  const giliran = data.seminar.find((x) => x.status === "DIPANGGIL" || x.status === "PRESENTASI") ?? null;
  const seminarHariIni = data.seminar.some((x) => x.tanggal === hariIni && x.status !== "SELESAI" && x.status !== "TIDAK_HADIR");

  useEffect(() => {
    if (!seminarHariIni || data.pratinjau) return;
    const h = setInterval(() => document.visibilityState === "visible" && router.refresh(), 30_000);
    return () => clearInterval(h);
  }, [seminarHariIni, data.pratinjau, router]);

  const ev23 = evaluasi?.penyelenggaraan ?? null;
  const evTotal = evaluasi ? evaluasi.sasaran.length + (ev23 ? 1 : 0) : 0;
  const evTerisi = evaluasi ? evaluasi.sasaran.filter((s) => s.sudah).length + (ev23?.sudah ? 1 : 0) : 0;
  const evBisa = evaluasi ? evaluasi.sasaran.filter((s) => s.tersedia).length + (ev23?.tersedia ? 1 : 0) : 0;
  const program = labelProgram(t);

  const tab = [
    { v: "ringkasan", l: "Ringkasan" },
    ...(t.jenisPelatihan ? [{ v: "folder", l: "Folder" }] : []),
    { v: "jadwal", l: "Jadwal" },
    { v: "tugas", l: t.jenisPelatihan ? "Tugas & tes" : "Evaluasi" },
    ...(seminar.length ? [{ v: "seminar", l: "Seminar" }] : []),
    ...(materi.length ? [{ v: "materi", l: "Materi" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href={data.pratinjau ? `/dashboard/diklat/${t.id}/peserta` : "/dashboard/belajar"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> {data.pratinjau ? "Peserta" : "Diklat Saya"}
      </Link>
      {data.pratinjau ? (
        <Alert tone="info" title="Pratinjau" className="mt-4">
          Beginilah halaman ini tampil bagi {data.peserta.nama}.
        </Alert>
      ) : null}
      <header className="mt-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-pretty">{t.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {program ? <span className="text-primary">{program} · </span> : null}
          {periodeDiklat(t)}
          {t.tempat ? ` · ${t.tempat}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          {data.peserta.nama}{" "}
          <span className="text-muted-foreground">
            · No. <span className="font-mono">{data.peserta.nomor}</span>
          </span>
          {data.peserta.instansi ? <span className="text-muted-foreground">· {data.peserta.instansi}</span> : null}
          {data.peserta.status !== "AKTIF" ? (
            <Badge size="sm" tone="neutral">
              {LABEL_STATUS_PESERTA[data.peserta.status]}
            </Badge>
          ) : null}
        </p>
      </header>

      {giliran ? (
        <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">
            {LABEL_PANGGIL[giliran.status]} (Seminar {giliran.jenis})
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {giliran.ruang ? `Ruang: ${giliran.ruang}` : ""}
            {giliran.pengujiNama ? ` · Penguji: ${giliran.pengujiNama}` : ""}
          </p>
          {giliran.tautanDaring ? (
            <ButtonLink size="sm" className="mt-2" href={giliran.tautanDaring} target="_blank" rel="noopener noreferrer">
              Buka Zoom <ExternalLink size={14} />
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {data.dokumen?.terkunci ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm">
            <span className="font-medium">Dokumen persyaratan belum lengkap.</span>{" "}
            <span className="text-muted-foreground">
              <span className="font-mono">{data.dokumen.kurang}</span> berkas belum diterima
              {data.dokumen.ditolak ? ` (${data.dokumen.ditolak} ditolak, perlu diganti)` : ""}
              {data.dokumen.menunggu ? ` · ${data.dokumen.menunggu} menunggu diperiksa` : ""}. Pre/post-test dan evaluasi terbuka setelah semua berkas diterima.
              {data.dokumen.batas
                ? ` Batas unggah ${formatTanggalId(data.dokumen.batas)}${data.dokumen.sisaHari !== null && data.dokumen.sisaHari < 0 ? " (sudah lewat)" : ""}.`
                : ""}
            </span>
          </p>
          <ButtonLink size="sm" href={`/dashboard/belajar/${id}/dokumen`}>
            Unggah dokumen <ArrowRight size={14} />
          </ButtonLink>
        </div>
      ) : null}

      <Tabs defaultValue="ringkasan" className="mt-6">
        <TabsList aria-label="Bagian ruang belajar">
          {tab.map((x) => (
            <TabsTrigger key={x.v} value={x.v}>
              {x.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4 flex flex-col gap-4">
          <TabRingkasan data={data} iAktif={iAktif} pilihan={tahapDipilih ?? iAktif} onPilih={setTahapDipilih} adaMateri={materi.length > 0} />
          {data.kelompok.map((k) => (
            <Panel
              key={k.jenis}
              judul={
                <>
                  <span className="block text-xs text-muted-foreground">{k.labelJenis}</span>
                  {k.label}
                </>
              }
              aksi={
                <div className="flex flex-wrap gap-2">
                  {k.jenis === JENIS_KELOMPOK_COACH ? (
                    <ButtonLink size="sm" variant="secondary" href={`/dashboard/coaching/${k.kelompokId}`}>
                      Ruang Coaching
                    </ButtonLink>
                  ) : null}
                  {k.tautan ? (
                    <ButtonLink size="sm" variant="ghost" href={k.tautan} target="_blank" rel="noopener noreferrer">
                      Ruang kelompok <ExternalLink size={14} />
                    </ButtonLink>
                  ) : null}
                </div>
              }
            >
              {k.coachNama || k.ketuaNama || k.lokus || k.kelas ? (
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {[
                    ["Coach", k.coachNama],
                    ["Ketua kelompok", k.ketuaNama],
                    ["Lokus", k.lokus],
                    ["Kelas seminar", k.kelas],
                  ]
                    .filter(([, v]) => v)
                    .map(([l, v]) => (
                      <div key={l}>
                        <dt className="inline text-muted-foreground">{l}: </dt>
                        <dd className="inline">{v}</dd>
                      </div>
                    ))}
                </dl>
              ) : null}
              {k.anggota.length ? (
                <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {k.anggota.join(" · ")}
                </p>
              ) : null}
            </Panel>
          ))}
          {mentor && !data.pratinjau && t.jenisPelatihan ? <PanelMentor pesertaId={id} mentor={mentor} rekening={rekening ?? null} /> : null}
          {data.dokumen && !data.dokumen.terkunci ? (
            <Panel
              judul="Dokumen persyaratan"
              aksi={
                <ButtonLink size="sm" variant="ghost" href={`/dashboard/belajar/${id}/dokumen`}>
                  Lihat
                </ButtonLink>
              }
            >
              <p className="flex items-center gap-1.5 text-sm text-success">
                <Check size={16} /> Semua berkas sudah diterima.
              </p>
            </Panel>
          ) : null}
        </TabsContent>

        <TabsContent value="jadwal" className="mt-4 flex flex-col gap-4">
          <PanelKehadiran data={data} />
          {data.sesi.length ? (
            <KalenderSesi
              sesi={data.sesi}
              mulai={t.startDate.slice(0, 10)}
              selesai={t.endDate ? t.endDate.slice(0, 10) : null}
              hariIni={hariIni}
              dipilih={tglJadwal}
              onPilih={(x) => setTglJadwal(x === tglJadwal ? null : x)}
            />
          ) : null}
          <PanelJadwal data={data} hariIni={hariIni} semua={semuaSesi} tanggal={tglJadwal} onSemua={() => setSemuaSesi((x) => !x)} onSemuaTanggal={() => setTglJadwal(null)} />
        </TabsContent>

        {t.jenisPelatihan ? (
          <TabsContent value="folder" className="mt-4">
            <FolderPeserta pesertaId={id} pratinjau={data.pratinjau} dokumen={data.dokumen} tugasWi={tugasWi} berkas={folder} />
          </TabsContent>
        ) : null}

        <TabsContent value="tugas" className="mt-4 flex flex-col gap-4">
          {t.jenisPelatihan ? (
            <Panel
              judul="Tugas"
              aksi={
                <ButtonLink size="sm" href={`/dashboard/belajar/${id}/tugas`}>
                  Buka tugas <ArrowRight size={14} />
                </ButtonLink>
              }
            >
              <p className="text-sm text-muted-foreground">
                Unggah dan kirim Rancangan Aksi Perubahan, laporan progres, dan tugas pembelajaran; baca catatan coach, mentor, dan pengampu.
              </p>
            </Panel>
          ) : null}
          {tes.length || t.jenisPelatihan ? <PanelTes id={id} tes={tes} pratinjau={data.pratinjau} terkunci={!!data.dokumen?.terkunci} /> : null}
          {evaluasi && evTotal && !data.dokumen?.terkunci ? (
            <Panel
              judul={`Evaluasi ${ev23 ? "pengajar & penyelenggaraan" : "pengajar"}`}
              aksi={
                <ButtonLink size="sm" variant={evTerisi < evBisa && !evaluasi.ditutup ? "primary" : "secondary"} href={`/dashboard/belajar/${id}/evaluasi`}>
                  {evaluasi.ditutup ? "Lihat" : evTerisi < evBisa ? "Isi evaluasi" : "Buka"}
                </ButtonLink>
              }
            >
              <p className="text-sm text-muted-foreground">
                <span className="font-mono text-foreground">{evTerisi}</span> dari <span className="font-mono text-foreground">{evBisa}</span> yang sudah bisa diisi
                {evTotal > evBisa ? ` (${evTotal - evBisa} menunggu waktunya)` : ""}. Rahasia: yang dilihat hanya rata-rata.
              </p>
            </Panel>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                j: "Nilai & kelulusan",
                d: "Hasil evaluasi tampil di sini setelah diumumkan penyelenggara pada penutupan pelatihan.",
              },
              {
                j: "Sosiometri",
                d: "Penilaian kerja sama, kedisiplinan, dan kepemimpinan sesama peserta. Diisi di sini saat dibuka penyelenggara.",
              },
            ].map((k) => (
              <Panel key={k.j} judul={k.j} aksi={<Badge size="sm">Segera tersedia</Badge>}>
                <p className="text-sm text-muted-foreground">{k.d}</p>
              </Panel>
            ))}
          </div>
        </TabsContent>

        {seminar.length ? (
          <TabsContent value="seminar" className="mt-4">
            <PanelSeminar data={data} seminar={seminar} hariIni={hariIni} coach={kelompokCoach} />
          </TabsContent>
        ) : null}

        {materi.length ? (
          <TabsContent value="materi" className="mt-4">
            <Panel judul="Modul kompetensi dasar">
              <p className="-mt-1 mb-3 text-sm text-muted-foreground">Modul wajib {t.jenisPelatihan} terbitan LAN.</p>
              <ul className="divide-y divide-border">
                {materi.map((m) => (
                  <li key={m.berkas}>
                    <a href={m.berkas} target="_blank" rel="noopener noreferrer" className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60">
                      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{m.judul}</span>
                        <span className="block text-xs text-muted-foreground">
                          {m.jenis} · PDF <span className="font-mono">{formatUkuran(m.ukuranKb)}</span>
                        </span>
                      </span>
                      <Download className="size-4 text-muted-foreground" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function TabRingkasan({
  data,
  iAktif,
  pilihan,
  onPilih,
  adaMateri,
}: {
  data: RuangBelajarRecord;
  iAktif: number;
  pilihan: number;
  onPilih: (i: number) => void;
  adaMateri: boolean;
}) {
  const t = data.training;
  const th = data.tahap[pilihan] ?? null;
  const persen = data.hari ? Math.round((data.hari.ke / data.hari.total) * 100) : 0;
  return (
    <>
      {data.hari ? (
        <Panel>
          {data.hari.status === "belum" ? (
            <p className="text-sm">
              Pelatihan dimulai <span className="font-medium">{formatTanggalId(t.startDate.slice(0, 10))}</span> (<span className="font-mono">{data.hari.total}</span> hari).
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm">
                  {data.hari.status === "selesai" ? (
                    <>Pelatihan telah selesai ({data.hari.total} hari).</>
                  ) : (
                    <>
                      Hari ke-
                      <span className="font-display text-lg">{data.hari.ke}</span> dari <span className="font-mono">{data.hari.total}</span>
                    </>
                  )}
                </p>
                <span className="font-mono text-xs text-muted-foreground">{persen}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${persen}%` }} />
              </div>
            </>
          )}
          {data.tahap.length ? (
            <ol className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Tahapan pelatihan">
              {data.tahap.map((x, i) => {
                const st = i < data.tahapAktif ? "selesai" : i === data.tahapAktif ? "aktif" : "nanti";
                return (
                  <li key={i} className="min-w-[7rem] flex-1">
                    <button
                      type="button"
                      onClick={() => onPilih(i)}
                      aria-pressed={i === pilihan}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors",
                        i === pilihan ? "border-primary bg-primary/8" : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span className={cn("h-1 rounded-full", st === "nanti" ? "bg-muted" : "bg-primary", st === "aktif" && "bg-primary/60")} />
                      <span className="text-xs">{x.nama}</span>
                      <span className={cn("text-[11px]", st === "aktif" ? "text-primary" : "text-muted-foreground")}>
                        {st === "selesai" ? "Selesai" : st === "aktif" ? "Berlangsung" : "Akan datang"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </Panel>
      ) : null}

      {th ? (
        <Panel
          judul={`${pilihan + 1}. ${th.nama}`}
          aksi={
            <span className="text-xs text-muted-foreground">
              {th.tipe} · <span className="font-mono">{th.jp}</span> JP
              {th.hari ? ` · ${th.hari} hari` : ""}
            </span>
          }
        >
          {pilihan === iAktif && data.tahapAktif >= 0 && data.tahapAktif < data.tahap.length ? (
            <p className="mb-2 text-xs text-primary">Tahap yang sedang berjalan (perkiraan dari jadwal dan kurikulum)</p>
          ) : null}
          {th.jpSync || th.jpAsync ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{th.jpSync ?? 0}</span> JP sinkron (tatap maya, wajib hadir) · <span className="font-mono">{th.jpAsync ?? 0}</span> JP asinkron
              (dikerjakan sendiri)
              {th.hariKalender && th.hari ? ` · ${th.hari} hari kalender` : ""}
            </p>
          ) : null}
          {th.kode === "MANDIRI" && data.mandiri ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Belajar mandiri di SiBangkom LAN dengan modul kompetensi dasar. Esai dan penilaian sikap perilaku pada tahap ini ikut dinilai.
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {data.mandiri.kegiatan.map((k, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span>
                      {k.nama}
                      {k.dinilai ? (
                        <Badge size="sm" tone="warning" className="ml-1.5">
                          dinilai
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{k.jp} JP</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink size="sm" variant="secondary" href={TAUTAN_MANDIRI_LAN} target="_blank" rel="noopener noreferrer">
                  Buka SiBangkom LAN <ExternalLink size={14} />
                </ButtonLink>
                {adaMateri ? <span className="self-center text-xs text-muted-foreground">Modul ada di tab Materi.</span> : null}
              </div>
            </>
          ) : (
            <>
              {URAIAN_TAHAP[th.kode] ? <p className="mt-2 text-sm text-muted-foreground">{URAIAN_TAHAP[th.kode]}</p> : null}
              {th.kegiatan?.length ? (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-primary">
                    Rincian kegiatan ({th.kegiatan.length}) <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2 divide-y divide-border">
                    {th.kegiatan.map((k, j) => (
                      <li key={j} className="flex items-start justify-between gap-3 py-2 text-sm">
                        <span>
                          {k.nama}
                          {k.dinilai ? (
                            <Badge size="sm" tone="warning" className="ml-1.5">
                              dinilai
                            </Badge>
                          ) : null}
                          {k.jpSync || k.jpAsync ? (
                            <span className="block text-xs text-muted-foreground">
                              {k.jpSync ?? 0} JP sinkron · {k.jpAsync ?? 0} JP asinkron
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{k.jp} JP</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </Panel>
      ) : null}
    </>
  );
}

function PanelKehadiran({ data }: { data: RuangBelajarRecord }) {
  const r = data.rekap;
  const ting = data.aturan ? TINGKAT[r.tingkat] : null;
  return (
    <Panel
      judul="Kehadiran saya"
      aksi={
        ting ? (
          <Badge size="sm" tone={ting.nada} dot>
            {ting.label}
          </Badge>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Hadir", v: r.jpHadir, s: "JP" },
          {
            l: "Tidak hadir",
            v: r.jpTidakHadir,
            s: `JP · ${r.hariTidakHadir} hari`,
          },
          { l: "Dispensasi", v: r.jpDispensasi, s: "JP" },
          { l: "Belum dicatat", v: r.sesiBelumDicatat, s: "sesi" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">{k.l}</dt>
            <dd className="mt-1">
              <span className="font-display text-xl">{k.v}</span> <span className="text-xs text-muted-foreground">{k.s}</span>
            </dd>
          </div>
        ))}
      </dl>
      {data.aturan ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Batas ketidakhadiran: <span className="font-mono">{data.aturan.maksJp}</span> JP atau <span className="font-mono">{data.aturan.maksHari}</span> hari pelatihan (sesi
          klasikal, e-learning sinkron, dan studi lapangan). Izin karena tugas yang tidak bisa diwakilkan dicatat sebagai dispensasi oleh penyelenggara.
        </p>
      ) : null}
    </Panel>
  );
}

function PanelJadwal({
  data,
  hariIni,
  semua,
  tanggal,
  onSemua,
  onSemuaTanggal,
}: {
  data: RuangBelajarRecord;
  hariIni: string;
  semua: boolean;
  tanggal: string | null;
  onSemua: () => void;
  onSemuaTanggal: () => void;
}) {
  const tampil = data.sesi.filter((s) => (tanggal ? s.tanggal === tanggal : semua || s.tanggal >= hariIni));
  const lewat = data.sesi.filter((s) => s.tanggal < hariIni).length;
  const perHari: { tanggal: string; sesi: typeof tampil }[] = [];
  for (const s of tampil) {
    const g = perHari[perHari.length - 1];
    if (g && g.tanggal === s.tanggal) g.sesi.push(s);
    else perHari.push({ tanggal: s.tanggal, sesi: [s] });
  }
  return (
    <Panel
      judul={tanggal ? `Jadwal ${formatTanggalId(tanggal)}` : "Jadwal saya"}
      aksi={
        tanggal ? (
          <Button size="sm" variant="ghost" onClick={onSemuaTanggal}>
            Semua tanggal
          </Button>
        ) : lewat > 0 ? (
          <Button size="sm" variant="ghost" onClick={onSemua}>
            {semua ? "Sembunyikan yang sudah lewat" : `Tampilkan ${lewat} sesi yang sudah lewat`}
          </Button>
        ) : undefined
      }
    >
      {data.sesi.length === 0 ? (
        <p className="text-sm text-muted-foreground">Jadwal pembelajaran belum disusun penyelenggara.</p>
      ) : perHari.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tanggal ? "Tidak ada sesi pada tanggal ini." : "Tidak ada sesi mendatang."}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {perHari.map((h) => (
            <div key={h.tanggal}>
              <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                {`${namaHari(h.tanggal)}, ${formatTanggalId(h.tanggal)}`}
                {h.tanggal === hariIni ? (
                  <Badge size="sm" tone="info">
                    hari ini
                  </Badge>
                ) : null}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {h.sesi.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{s.jamMulai ?? "–"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{s.kegiatan}</span>
                      <span className="block text-xs text-muted-foreground">
                        {labelBentuk(s.bentuk)} · <span className="font-mono">{s.jp}</span> JP
                        {s.mataPelatihanNama && s.mataPelatihanNama !== s.kegiatan ? ` · ${s.mataPelatihanNama}` : ""}
                      </span>
                      {s.pengajar ? <span className="block text-xs">Pengajar kelompok Anda: {s.pengajar}</span> : null}
                      {s.tautan && s.tanggal >= hariIni ? (
                        <a href={s.tautan} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Gabung rapat daring <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </span>
                    {!s.wajibHadir ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">tanpa absensi</span>
                    ) : s.kehadiran ? (
                      <Badge size="sm" tone={NADA_HADIR[s.kehadiran]}>
                        {LABEL_KEHADIRAN[s.kehadiran]}
                      </Badge>
                    ) : s.tanggal <= hariIni ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">belum dicatat</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PanelTes({ id, tes, pratinjau, terkunci }: { id: string; tes: TesPesertaRecord[]; pratinjau: boolean; terkunci: boolean }) {
  return (
    <Panel judul="Pre-test & post-test">
      <p className="-mt-1 text-sm text-muted-foreground">
        Mengukur kenaikan pengetahuan Anda selama pelatihan, tidak memengaruhi kelulusan. Dikerjakan sekali; waktu berjalan sejak Anda menekan Mulai.
      </p>
      {!tes.length ? (
        <p className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Belum diterbitkan penyelenggara. Pre-test biasanya dibuka di awal pelatihan dan post-test di akhir; tombol Mulai muncul di sini saat tes dibuka.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tes.map((x) => {
            const status = x.pengerjaan === "SELESAI" ? "Selesai" : x.pengerjaan === "BERJALAN" ? "Sedang dikerjakan" : LABEL_STATUS_TES[x.statusBerlaku];
            const nada: BadgeTone = x.pengerjaan === "SELESAI" ? "success" : x.pengerjaan === "BERJALAN" || x.statusBerlaku === "DIBUKA" ? "info" : "neutral";
            const bisa = !pratinjau && !terkunci && x.pengerjaan !== "SELESAI" && (x.statusBerlaku === "DIBUKA" || x.pengerjaan === "BERJALAN");
            return (
              <div key={x.jenis} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{x.label}</p>
                  <Badge size="sm" tone={nada}>
                    {status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{x.jumlahSoal}</span> soal · <span className="font-mono">{x.durasiMenit}</span> menit
                  {x.statusBerlaku === "TERJADWAL" && x.buka ? ` · dibuka ${waktuTes(x.buka)}` : ""}
                  {x.tutup && x.pengerjaan !== "SELESAI" ? ` · ditutup ${waktuTes(x.tutup)}` : ""}
                </p>
                {x.skor != null ? (
                  <p className="mt-2 font-display text-2xl">
                    {x.skor.toLocaleString("id-ID", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    <span className="text-xs text-muted-foreground">({x.benar} benar)</span>
                  </p>
                ) : x.pengerjaan === "SELESAI" ? (
                  <p className="mt-2 text-xs text-muted-foreground">Jawaban sudah terkirim. {x.jenis === "PRE" ? "Skor ditampilkan setelah post-test." : ""}</p>
                ) : null}
                {bisa ? (
                  <ButtonLink size="sm" className="mt-3" href={`/dashboard/belajar/${id}/tes/${x.jenis.toLowerCase()}`}>
                    {x.pengerjaan === "BERJALAN" ? "Lanjutkan" : "Mulai"} {x.label.toLowerCase()} <ArrowRight size={14} />
                  </ButtonLink>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {terkunci && tes.length ? (
        <p className="mt-3 text-xs text-warning">Tombol Mulai terbuka setelah semua dokumen persyaratan Anda diterima. Hasil yang sudah ada tetap ditampilkan.</p>
      ) : null}
    </Panel>
  );
}

function PanelSeminar({
  data,
  seminar,
  hariIni,
  coach,
}: {
  data: RuangBelajarRecord;
  seminar: ReturnType<typeof infoSeminar>;
  hariIni: string;
  coach: RuangBelajarRecord["kelompok"][number] | null;
}) {
  const [aspek, setAspek] = useState<string | null>(null);
  const statusPribadi = (tanggal: string | null) => (!tanggal ? "belum-dijadwalkan" : tanggal === hariIni ? "hari-ini" : tanggal > hariIni ? "akan-datang" : "selesai");
  return (
    <Panel
      judul="Seminar Aksi Perubahan"
      aksi={
        coach ? (
          <ButtonLink size="sm" variant="secondary" href={`/dashboard/coaching/${coach.kelompokId}`}>
            Siapkan bersama coach
          </ButtonLink>
        ) : undefined
      }
    >
      <p className="-mt-1 text-sm text-muted-foreground">
        Judul aksi perubahan: <span className="text-foreground">{data.peserta.judulAksiPerubahan ?? "belum dicatat penyelenggara"}</span>
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {seminar.map((sm) => {
          const pr = data.seminar.find((x) => x.jenis === sm.jenis) ?? null;
          const st = STATUS_SEMINAR[pr ? statusPribadi(pr.tanggal) : sm.status];
          return (
            <div key={sm.jenis} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{sm.judul}</p>
                <Badge size="sm" tone={st.nada}>
                  {st.teks}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sm.tahap}
                {sm.jp ? ` · ${sm.jp} JP` : ""}
              </p>
              {pr && pr.tanggal ? (
                <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs">
                  <p className="text-sm">
                    {formatTanggalId(pr.tanggal)}
                    {pr.jamMulai ? <span className="font-mono">, {pr.jamMulai} WIB</span> : null}
                    {pr.urutan ? <span className="text-muted-foreground"> · urutan ke-{pr.urutan}</span> : null}
                  </p>
                  {pr.ruang ? <p className="mt-1">Ruang: {pr.ruang}</p> : null}
                  {pr.pengujiNama ? <p>Penguji: {pr.pengujiNama}</p> : null}
                  {pr.mentorHadir ? <p className="text-muted-foreground">Mentor Anda hadir {pr.mentorHadir === "DARING" ? "daring lewat Zoom" : "langsung"}.</p> : null}
                  {pr.tautanDaring ? (
                    <a href={pr.tautanDaring} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                      Tautan Zoom seminar <ExternalLink size={12} />
                    </a>
                  ) : null}
                  {LABEL_PANGGIL[pr.status] && pr.status !== "DIPANGGIL" ? <p className="mt-1 text-muted-foreground">{LABEL_PANGGIL[pr.status]}</p> : null}
                </div>
              ) : sm.jadwal.length ? (
                <ul className="mt-3 flex flex-col gap-1 text-xs">
                  {sm.jadwal.map((j, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>
                        {formatTanggalId(j.tanggal)}
                        {j.jamMulai ? `, ${j.jamMulai} WIB` : ""}
                      </span>
                      {j.tautan ? (
                        <a href={j.tautan} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Gabung
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Jadwal diumumkan penyelenggara.</p>
              )}
              <button
                type="button"
                onClick={() => setAspek(aspek === sm.jenis ? null : sm.jenis)}
                aria-expanded={aspek === sm.jenis}
                className="mt-3 text-xs text-primary hover:underline"
              >
                {aspek === sm.jenis ? "Tutup" : "Lihat"} aspek yang dinilai ({sm.aspekLabel}, bobot {sm.bobotTotal})
              </button>
              {aspek === sm.jenis ? (
                <ul className="mt-2 divide-y divide-border text-xs">
                  {sm.aspek.map((a) => (
                    <li key={a.nama} className="flex justify-between gap-2 py-1.5">
                      <span>{a.nama}</span>
                      <span className="font-mono text-muted-foreground">{a.bobot}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground">Yang hadir dalam seminar</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {PERAN_SEMINAR.map((r) => (
            <li key={r.peran}>
              {r.peran}
              {r.peran === "Coach" && coach?.coachNama ? ` (${coach.coachNama})` : ""} <span className="text-muted-foreground">· {r.tugas}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Mentor saya (EB-035): diusulkan peserta, disetujui penyelenggara di tab Penugasan. */
function PanelMentor({ pesertaId, mentor: awal, rekening }: { pesertaId: string; mentor: MentorSayaRecord; rekening: RekeningSayaRecord | null }) {
  const [mentor, setMentor] = useState(awal);
  const [ubah, setUbah] = useState(false);
  const [isi, setIsi] = useState({
    nama: "",
    jabatan: "",
    instansi: "",
    email: "",
    ponsel: "",
  });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const atur = (k: keyof typeof isi) => (v: string) => setIsi((x) => ({ ...x, [k]: v }));
  const buka = () => {
    setIsi({
      nama: mentor.nama ?? "",
      jabatan: mentor.jabatan ?? "",
      instansi: mentor.instansi ?? "",
      email: mentor.email ?? "",
      ponsel: mentor.ponsel ?? "",
    });
    setGalat("");
    setUbah(true);
  };
  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (isi.nama.trim().length < 3) return setGalat("Isi nama mentor (minimal 3 huruf).");
    if (isi.jabatan.trim().length < 3) return setGalat("Isi jabatan mentor (minimal 3 huruf).");
    setSibuk(true);
    const res = await kirimJson<MentorSayaRecord>(`/api/belajar/${encodeURIComponent(pesertaId)}/mentor`, "POST", isi);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setMentor(res.data);
    setUbah(false);
  }
  const lencana =
    mentor.status === "USULAN"
      ? { t: "Menunggu persetujuan", n: "warning" as const }
      : mentor.status === "AKTIF"
        ? { t: "Disetujui", n: "success" as const }
        : mentor.status === "DITOLAK"
          ? { t: "Ditolak", n: "danger" as const }
          : null;
  return (
    <Panel
      judul="Mentor saya"
      aksi={
        lencana ? (
          <Badge size="sm" tone={lencana.n} dot>
            {lencana.t}
          </Badge>
        ) : undefined
      }
    >
      <p className="-mt-1 text-xs text-muted-foreground">
        Mentor adalah atasan langsung Anda atau pejabat yang ditunjuk instansi. Usulkan di sini; penyelenggara akan memeriksanya.
      </p>
      {mentor.nama && !ubah ? (
        <div className="mt-3">
          <p className="text-sm">{mentor.nama}</p>
          <p className="text-xs text-muted-foreground">{[mentor.jabatan, mentor.instansi, mentor.email, mentor.ponsel].filter(Boolean).join(" · ")}</p>
          {mentor.status === "DITOLAK" && mentor.alasan ? <p className="mt-1 text-xs text-destructive">Alasan: {mentor.alasan}</p> : null}
        </div>
      ) : null}
      {ubah ? (
        <form onSubmit={kirim} noValidate className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Nama mentor" value={isi.nama} onChange={atur("nama")} maxLength={120} />
          <Input label="Jabatan" value={isi.jabatan} onChange={atur("jabatan")} maxLength={160} />
          <Input label="Instansi" value={isi.instansi} onChange={atur("instansi")} maxLength={160} />
          <Input label="Email" type="email" value={isi.email} onChange={atur("email")} maxLength={160} />
          <Input label="Ponsel" type="tel" value={isi.ponsel} onChange={atur("ponsel")} maxLength={30} />
          {galat ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {galat}
            </p>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={sibuk}>
              {sibuk ? "Mengirim…" : "Kirim usulan"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setUbah(false)}>
              Batal
            </Button>
          </div>
        </form>
      ) : mentor.status !== "AKTIF" ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={buka}>
          {mentor.status === null ? "Usulkan mentor" : "Perbaiki usulan"}
        </Button>
      ) : null}
      {rekening && rekening.status !== "TIDAK_PERLU" && !ubah ? <RekeningMentor pesertaId={pesertaId} awal={rekening} /> : null}
    </Panel>
  );
}

/**
 * Rekening mentor daring (EB-045): muncul bila mentor hadir daring (Zoom) pada seminar. Diisi/diubah peserta kapan saja;
 * setelah tersimpan hanya tampil tersamar. Ganti mentor → isi ulang. Nomor lengkap hanya dibuka admin & Ketua Diklat.
 */
function RekeningMentor({ pesertaId, awal }: { pesertaId: string; awal: RekeningSayaRecord }) {
  const [r, setR] = useState(awal);
  const [isi, setIsi] = useState<{ namaBank: string; nomorRekening: string; atasNama: string; ponsel: string } | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const atur = (k: "namaBank" | "nomorRekening" | "atasNama" | "ponsel") => (v: string) => setIsi((x) => (x ? { ...x, [k]: v } : x));
  const buka = () => {
    setGalat("");
    setIsi({ namaBank: r.rekening?.namaBank ?? "", nomorRekening: "", atasNama: r.rekening?.atasNama ?? r.mentorNama ?? "", ponsel: "" });
  };
  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!isi) return;
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<RekeningSayaRecord>(`/api/belajar/${encodeURIComponent(pesertaId)}/rekening-mentor`, "PUT", isi);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setR(res.data);
    setIsi(null);
  }
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Rekening mentor (seminar daring)</p>
      <p className="text-xs text-muted-foreground">
        Mentor Anda hadir lewat Zoom. Isi rekening dan nomor HP mentor untuk keperluan honor; hanya admin dan Ketua Diklat yang dapat membuka nomor lengkapnya.
      </p>
      {r.status === "PERLU_ULANG" && !isi ? (
        <Alert tone="warning" title="Mentor Anda berganti" className="mt-3">
          Rekening yang tersimpan milik mentor sebelumnya. Isi rekening {r.mentorNama ?? "mentor baru"}.
        </Alert>
      ) : null}
      {r.status === "TERISI" && r.rekening && !isi ? (
        <dl className="mt-3 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Bank</dt>
          <dd>{r.rekening.namaBank}</dd>
          <dt className="text-muted-foreground">Nomor rekening</dt>
          <dd className="font-mono">{r.rekening.nomorSamar}</dd>
          <dt className="text-muted-foreground">Atas nama</dt>
          <dd>{r.rekening.atasNama}</dd>
          <dt className="text-muted-foreground">HP mentor</dt>
          <dd className="font-mono">{r.rekening.ponselSamar}</dd>
        </dl>
      ) : null}
      {isi ? (
        <form onSubmit={simpan} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Nama bank" value={isi.namaBank} onChange={atur("namaBank")} maxLength={80} placeholder="mis. Bank BJB" />
          <Input label="Nomor rekening" value={isi.nomorRekening} onChange={atur("nomorRekening")} maxLength={30} inputMode="numeric" autoComplete="off" />
          <Input label="Atas nama" value={isi.atasNama} onChange={atur("atasNama")} maxLength={120} />
          <Input label="Nomor HP mentor" type="tel" value={isi.ponsel} onChange={atur("ponsel")} maxLength={20} placeholder="0812…" />
          {galat ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {galat}
            </p>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan rekening"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsi(null)}>
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={buka}>
          {r.status === "TERISI" ? "Ubah rekening" : "Isi rekening mentor"}
        </Button>
      )}
    </div>
  );
}
