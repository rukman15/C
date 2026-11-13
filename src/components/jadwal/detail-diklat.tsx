"use client";

import Link from "next/link";
import { ArrowRight, CalendarRange, Clock, MapPin, Tag, Users } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { kemajuan, lamaHari, periodeTeks, type JadwalDiklat } from "@/lib/jadwal";
import { labelKategori } from "@/lib/skema-training";
import { cn } from "@/lib/utils";
import { BilahKemajuan, WARNA_STATUS } from "./kartu-diklat";

/** Panel rincian singkat satu diklat. */
export function DetailDiklat({
  diklat: d,
  hariIni,
  bolehRincian,
  onTutup,
}: {
  diklat: JadwalDiklat | null;
  hariIni: string;
  bolehRincian: boolean;
  onTutup: () => void;
}) {
  return (
    <Panel buka={!!d} onTutup={onTutup} judul="Rincian diklat">
      {d ? <Isi d={d} hariIni={hariIni} bolehRincian={bolehRincian} /> : null}
    </Panel>
  );
}

function Isi({ d, hariIni, bolehRincian }: { d: JadwalDiklat; hariIni: string; bolehRincian: boolean }) {
  const k = kemajuan(d, hariIni);
  const warna = WARNA_STATUS[d.status];
  const lama = lamaHari(d);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs", warna.blok)}>
          <span className={cn("size-1.5 rounded-full", warna.titik)} aria-hidden />
          {warna.label}
        </span>
        <p className="mt-3 text-xl font-medium text-pretty">{d.name}</p>
        <p className={cn("mt-1 text-sm", d.status === "Berjalan" ? "text-success" : "text-muted-foreground")}>{k.label}</p>
        {k.persen !== null ? <BilahKemajuan persen={k.persen} className="mt-3 h-2" /> : null}
      </div>

      <dl className="grid gap-4 text-sm">
        <Baris ikon={<CalendarRange className="size-4" />} label="Periode" isi={periodeTeks(d.startDate, d.endDate)} />
        <Baris ikon={<Clock className="size-4" />} label="Lama" isi={<span className="font-mono">{lama} hari</span>} />
        <Baris ikon={<MapPin className="size-4" />} label="Tempat" isi={d.tempat} />
        <Baris ikon={<Tag className="size-4" />} label="Kategori" isi={labelKategori(d.category)} />
        <Baris
          ikon={<Users className="size-4" />}
          label="Peserta"
          isi={d.participants > 0 ? <span className="font-mono">{d.participants}</span> : <span className="text-muted-foreground">Belum diisi</span>}
        />
      </dl>

      {bolehRincian ? (
        <Link
          href={`/dashboard/diklat/${encodeURIComponent(d.id)}`}
          className="group flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm transition-colors hover:border-border-strong hover:bg-card"
        >
          <span>
            Buka rincian diklat
            <span className="block text-xs text-muted-foreground">Ubah, hapus, kurikulum, pengampu, peserta</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function Baris({ ikon, label, isi }: { ikon: React.ReactNode; label: string; isi: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground" aria-hidden>
        {ikon}
      </span>
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{isi}</dd>
    </div>
  );
}
