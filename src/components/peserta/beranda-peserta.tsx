import { ArrowRight, BookOpen, ChevronDown, CalendarDays, CheckCircle2, ExternalLink, ListChecks, MapPin, PlayCircle, Presentation, UserCheck, Video } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { ButtonLink } from "@/components/ui/button";
import { Kartu } from "@/components/dasbor/halaman";
import { labelBentuk } from "@/lib/kehadiran";
import { TAUTAN_MANDIRI_LAN, diklatUtama, penerbitSertifikat, ringkasBeranda } from "@/lib/beranda-peserta";
import { formatTanggalId } from "@/lib/sesi";
import { cn } from "@/lib/utils";
import type { DiklatSayaRecord } from "@/lib/server/types";
import { DaftarPelatihan, DaftarTugas, StepperTahap, labelProgram } from "./bagian";
import { SalinTautan } from "./salin-tautan";

/**
 * Beranda peserta. Isinya sama dengan aplikasi lama (sambutan, angka, diklat aktif + tahapan, jadwal hari ini,
 * tugas & checklist, pembelajaran mandiri, daftar pelatihan, sertifikat); susunannya mengutamakan HP:
 * jadwal hari ini paling atas, lalu diklat aktif dan checklist. Di layar lebar: dua kolom.
 */
const IKON_BENTUK: Record<string, typeof Video> = {
  SINKRON: Video,
  ASINKRON: BookOpen,
  MANDIRI: BookOpen,
  KLASIKAL: Presentation,
  LAPANGAN: MapPin,
};
const TINGKAT = {
  aman: { label: "aman", nada: "success" },
  peringatan: { label: "mendekati batas", nada: "warning" },
  batas: { label: "mencapai batas", nada: "danger" },
} as const;
const tglPanjang = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

export function BerandaPeserta({ nama, list }: { nama: string; list: DiklatSayaRecord[] }) {
  const ringkas = ringkasBeranda(
    list.map((d) => ({
      status: d.training.status,
      statusPeserta: d.status,
      kehadiranPersen: d.kehadiranPersen,
    })),
  );
  const utama = diklatUtama(
    list.map((d) => ({
      ...d,
      status: d.training.status,
      statusPeserta: d.status,
      mulai: d.training.startDate,
    })),
  );
  const mandiri = list.filter((d) => d.mandiri && d.training.status !== "Selesai" && d.status === "AKTIF");
  const selesai = list.filter((d) => d.training.status === "Selesai" && d.status === "AKTIF");
  const depan = nama.split(/[,\s]+/).filter(Boolean)[0] ?? "";
  const hariIni = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const berjalan = utama?.training.status === "Berjalan";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="mb-2">
        <p className="text-sm text-muted-foreground">{hariIni}</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">Selamat datang kembali{depan ? `, ${depan}` : ""}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-pretty text-muted-foreground">
          {berjalan && utama ? (
            <>
              Anda sedang mengikuti <span className="text-foreground">{utama.training.name}</span>. Lanjutkan dari jadwal hari ini.
            </>
          ) : utama ? (
            <>
              Pelatihan Anda berikutnya: <span className="text-foreground">{utama.training.name}</span>, mulai {formatTanggalId(utama.training.startDate.slice(0, 10))}.
            </>
          ) : (
            "Jadwal, kehadiran, tahapan, dan hasil pelatihan Anda tampil di sini."
          )}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {utama ? (
            <>
              <Kartu>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="size-4 text-muted-foreground" aria-hidden /> Jadwal hari ini
                  </h2>
                  <span className="text-xs text-muted-foreground">{utama.training.name}</span>
                </div>
                {utama.sesiHariIni.length === 0 ? (
                  <div className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                    <p className="text-muted-foreground">Tidak ada sesi terjadwal hari ini.</p>
                    {utama.sesiBerikutnya ? (
                      <p className="mt-1">
                        Berikutnya: {utama.sesiBerikutnya.kegiatan}
                        <span className="text-muted-foreground">
                          {" "}
                          · {tglPanjang(utama.sesiBerikutnya.tanggal)}
                          {utama.sesiBerikutnya.jamMulai ? `, ${utama.sesiBerikutnya.jamMulai}` : ""}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {utama.sesiHariIni.map((s, i) => {
                      const Ikon = IKON_BENTUK[s.bentuk] ?? CalendarDays;
                      return (
                        <li key={i} className="flex items-start gap-3 rounded-xl border border-border p-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Ikon className="size-5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-pretty">{s.kegiatan}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {s.jamMulai ? <span className="font-mono">{s.jamMulai} WIB · </span> : null}
                              {labelBentuk(s.bentuk)} · <span className="font-mono">{s.jp}</span> JP
                            </p>
                            {s.pengajar ? <p className="mt-0.5 text-xs">Pengajar kelompok Anda: {s.pengajar}</p> : null}
                            {s.tautan ? (
                              <div className="mt-2.5">
                                <SalinTautan tautan={s.tautan} />
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Kartu>

              <Kartu>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm text-muted-foreground">{berjalan ? "Diklat aktif" : "Pelatihan berikutnya"}</h2>
                  <Badge size="sm" tone={berjalan ? "success" : "info"} dot>
                    {berjalan ? "Berlangsung" : `Mulai ${formatTanggalId(utama.training.startDate.slice(0, 10))}`}
                  </Badge>
                </div>
                <p className="mt-2 font-display text-lg leading-snug font-medium text-pretty">{utama.training.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {labelProgram(utama.training) ? (
                    <Badge size="sm" tone="info">
                      {labelProgram(utama.training)}
                    </Badge>
                  ) : null}
                  {utama.tingkatKehadiran && utama.kehadiranPersen !== null ? (
                    <Badge size="sm" tone={TINGKAT[utama.tingkatKehadiran].nada}>
                      Kehadiran {utama.kehadiranPersen}% · {TINGKAT[utama.tingkatKehadiran].label}
                    </Badge>
                  ) : null}
                </div>
                {utama.tahap.length ? (
                  <div className="mt-5">
                    <StepperTahap tahap={utama.tahap} aktif={utama.tahapAktif} />
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {utama.hari?.status === "berjalan" ? (
                    <p className="text-xs text-muted-foreground">
                      Hari ke-<span className="font-mono">{utama.hari.ke}</span> dari <span className="font-mono">{utama.hari.total}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <ButtonLink href={`/dashboard/belajar/${utama.pesertaId}`}>
                    Masuk ruang belajar <ArrowRight size={16} />
                  </ButtonLink>
                </div>
              </Kartu>

              {utama.tugas.length ? (
                <Kartu>
                  <h2 className="flex items-center gap-2 text-sm font-medium">
                    <ListChecks className="size-4 text-muted-foreground" aria-hidden /> Tugas &amp; checklist
                  </h2>
                  <div className="mt-1">
                    <DaftarTugas tugas={utama.tugas} />
                  </div>
                </Kartu>
              ) : null}
            </>
          ) : null}

          <Kartu>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">Daftar pelatihan saya</h2>
              {list.length ? <span className="text-xs text-muted-foreground">{list.length} pelatihan</span> : null}
            </div>
            <div className="mt-3">
              <DaftarPelatihan list={list} />
            </div>
          </Kartu>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3">
            {[
              {
                l: "Sedang diikuti",
                v: String(ringkas.berjalan),
                ikon: PlayCircle,
              },
              {
                l: "Terjadwal",
                v: String(ringkas.terjadwal),
                ikon: CalendarDays,
              },
              { l: "Selesai", v: String(ringkas.selesai), ikon: CheckCircle2 },
              {
                l: "Rata-rata kehadiran",
                v: ringkas.rataKehadiran === null ? "–" : `${ringkas.rataKehadiran}%`,
                ikon: UserCheck,
              },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl border border-border p-4">
                <k.ikon className="size-4 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-display text-2xl font-medium tabular-nums">{k.v}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.l}</p>
              </div>
            ))}
          </section>

          {mandiri.map((d) => {
            const m = d.mandiri!;
            return (
              <Kartu key={d.pesertaId}>
                <h2 className="text-sm font-medium">Pembelajaran mandiri</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{m.jp}</span> JP
                  {m.hari ? ` · ${m.hari} hari` : ""} · {d.training.name}
                </p>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">
                  Tahap pertama pelatihan blended: belajar mandiri tanpa tatap muka. Esai dan penilaian sikap perilaku pada tahap ini ikut dinilai.
                </p>
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-primary">
                    Lihat kegiatan ({m.kegiatan.length}) <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {m.kegiatan.map((k, i) => (
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
                </details>
                <ButtonLink variant="secondary" size="sm" className="mt-4" href={TAUTAN_MANDIRI_LAN} target="_blank" rel="noopener noreferrer">
                  Buka SiBangkom LAN <ExternalLink size={14} />
                </ButtonLink>
                <p className="mt-2 text-xs text-muted-foreground">Masuk dengan akun LAN Anda. Sertifikat self learning didapat dari sana.</p>
              </Kartu>
            );
          })}

          <Kartu>
            <h2 className="text-sm font-medium">Sertifikat</h2>
            {selesai.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada pelatihan yang selesai.</p>
            ) : (
              <>
                <ul className="mt-3 flex flex-col gap-2">
                  {selesai.map((d) => {
                    const ps = penerbitSertifikat(d.training.jenisPelatihan);
                    return (
                      <li key={d.pesertaId} className="rounded-xl border border-border px-3 py-2.5">
                        <p className="text-sm">{d.training.name}</p>
                        <p className="text-xs text-muted-foreground">Diterbitkan {ps.penerbit}</p>
                        {ps.tautan ? (
                          <a href={ps.tautan} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Unduh TTE di SiBangkom LAN <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className={cn("mt-3 text-xs text-muted-foreground")}>
                  Sertifikat elektronik (TTE) diunduh sendiri oleh peserta dari penerbitnya. Sertifikat fisik diambil penyelenggara di BPSDM dan diserahkan kemudian.
                </p>
              </>
            )}
          </Kartu>
        </aside>
      </div>
    </div>
  );
}
