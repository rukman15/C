"use client";

import Link from "next/link";
import { ArrowRight, CalendarRange, Clock, MapPin, Tag, Users } from "lucide-react";
import { Drawer, DrawerContent, useDrawerItem } from "@/components/arc/drawer/drawer";
import { Badge } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";
import { kemajuan, lamaHari, periodeTeks, type JadwalDiklat } from "@/lib/jadwal";
import { labelKategori } from "@/lib/skema-training";
import { NADA_STATUS } from "./kartu-diklat";

/** Rincian singkat satu diklat di Drawer Arc dari kanan. */
export function DetailDiklat({
  diklat,
  hariIni,
  bolehRincian,
  onTutup,
}: {
  diklat: JadwalDiklat | null;
  hariIni: string;
  bolehRincian: boolean;
  onTutup: () => void;
}) {
  // Isi tetap tampil selama animasi menutup.
  const d = useDrawerItem(diklat);
  return (
    <Drawer open={!!diklat} onOpenChange={(o) => !o && onTutup()}>
      <DrawerContent side="right" title="Rincian diklat" description={d ? periodeTeks(d.startDate, d.endDate) : undefined}>
        {d ? <Isi d={d} hariIni={hariIni} bolehRincian={bolehRincian} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Isi({ d, hariIni, bolehRincian }: { d: JadwalDiklat; hariIni: string; bolehRincian: boolean }) {
  const k = kemajuan(d, hariIni);
  const nada = NADA_STATUS[d.status];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge tone={nada.tone} dot>
          {nada.label}
        </Badge>
        <p className="mt-3 text-xl font-medium text-pretty">{d.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
        {k.persen !== null ? <Progress value={k.persen} aria-label="Kemajuan diklat" className="mt-3" /> : null}
      </div>

      <dl className="grid gap-4 text-sm">
        <Baris ikon={<CalendarRange className="size-4" />} label="Periode" isi={periodeTeks(d.startDate, d.endDate)} />
        <Baris ikon={<Clock className="size-4" />} label="Lama" isi={<span className="font-mono">{lamaHari(d)} hari</span>} />
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
