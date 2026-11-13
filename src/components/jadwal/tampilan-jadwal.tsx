"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import Toast from "@/components/arc/toast/toast";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { cocokCari, type DataJadwal, type JadwalDiklat, type StatusDiklat } from "@/lib/jadwal";
import { KATEGORI_DIKLAT, labelKategori } from "@/lib/skema-training";
import type { TimDiklat } from "@/lib/tim-kerja";
import { KartuDiklat } from "./kartu-diklat";
import { Kalender } from "./kalender";
import { DetailDiklat } from "./detail-diklat";
import { JadwalMengajarSaya } from "./mengajar";
import { FormTambahJadwal } from "./form-jadwal";

type Saring = "semua" | StatusDiklat;
type Tampilan = "daftar" | "kalender";

const KELOMPOK: { status: StatusDiklat; judul: string; kosong: string }[] = [
  { status: "Berjalan", judul: "Sedang berlangsung", kosong: "Tidak ada diklat yang sedang berlangsung." },
  { status: "Terjadwal", judul: "Akan datang", kosong: "Belum ada diklat terjadwal." },
  { status: "Selesai", judul: "Baru selesai", kosong: "Belum ada diklat yang selesai." },
];

function Jumlah({ n }: { n: number }) {
  return <span className="ml-1.5 font-mono text-xs opacity-60">{n}</span>;
}

export function TampilanJadwal({
  data,
  hariIni,
  bolehRincian,
  tambah,
}: {
  data: DataJadwal;
  hariIni: string;
  bolehRincian: boolean;
  tambah: { global: boolean; tim: TimDiklat[] } | null;
}) {
  const [tampilan, setTampilan] = useState<Tampilan>("daftar");
  const [saring, setSaring] = useState<Saring>("semua");
  const [kategori, setKategori] = useState<string[]>([]);
  const [cari, setCari] = useState("");
  const [dipilih, setDipilih] = useState<JadwalDiklat | null>(null);
  const [formBuka, setFormBuka] = useState(false);
  const [kabar, setKabar] = useState<string | null>(null);

  const jumlah = useMemo(() => {
    const n = { Berjalan: 0, Terjadwal: 0, Selesai: 0 } as Record<StatusDiklat, number>;
    data.diklat.forEach((d) => n[d.status]++);
    return n;
  }, [data.diklat]);

  const tersaring = useMemo(
    () =>
      data.diklat.filter(
        (d) =>
          (saring === "semua" || d.status === saring) &&
          (kategori.length === 0 || kategori.includes(d.category)) &&
          cocokCari(d, labelKategori(d.category), cari),
      ),
    [data.diklat, saring, kategori, cari],
  );

  const adaSaringan = saring !== "semua" || kategori.length > 0 || cari.trim() !== "";
  const mengajar = data.mengajar ?? [];

  return (
    <HalamanDasbor
      judul="Jadwal Diklat"
      keterangan={`Kalender diklat BBPKA-PDN II${mengajar.length > 0 ? " dan jadwal mengajar Anda" : ""}.`}
      lebar="penuh"
    >
      <div className="-mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="tanpa-bilah -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
          <SegmentedControl
            label="Saring menurut status"
            value={saring}
            onValueChange={(v) => setSaring(v as Saring)}
            options={[
              { value: "semua", label: "Semua", accessory: <Jumlah n={data.diklat.length} /> },
              { value: "Berjalan", label: "Berlangsung", accessory: <Jumlah n={jumlah.Berjalan} /> },
              { value: "Terjadwal", label: "Akan datang", accessory: <Jumlah n={jumlah.Terjadwal} /> },
              { value: "Selesai", label: "Selesai", accessory: <Jumlah n={jumlah.Selesai} /> },
            ]}
          />
        </div>
        {tambah ? (
          <Button
            onClick={() => {
              setKabar(null);
              setFormBuka(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Tambah jadwal
          </Button>
        ) : null}
      </div>

      {mengajar.length > 0 ? <JadwalMengajarSaya daftar={mengajar} hariIni={hariIni} /> : null}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex h-10 w-full shrink-0 items-center sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Cari diklat</span>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau tempat"
              className="h-10 w-full rounded-full border border-border bg-transparent pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-border-strong"
            />
          </label>
          <div className="tanpa-bilah -mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ChipGroup
              label="Saring menurut kategori"
              multiple
              value={kategori}
              onValueChange={setKategori}
              options={KATEGORI_DIKLAT.map((k) => ({ value: k.value, label: k.label }))}
            />
          </div>
        </div>
        <SegmentedControl
          label="Tampilan"
          value={tampilan}
          onValueChange={(v) => setTampilan(v as Tampilan)}
          options={[
            { value: "daftar", label: "Daftar" },
            { value: "kalender", label: "Kalender" },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tampilan === "kalender" ? (
          <motion.div key="kalender" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <Kalender diklat={tersaring} hariIni={hariIni} onPilih={setDipilih} />
          </motion.div>
        ) : (
          <motion.div key="daftar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {tersaring.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={20} />}
                title={adaSaringan ? "Tidak ada yang cocok" : "Belum ada jadwal diklat"}
                description={adaSaringan ? "Coba ubah saringan atau kata pencarian." : "Jadwal yang ditambahkan akan tampil di sini."}
                action={
                  adaSaringan ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSaring("semua");
                        setKategori([]);
                        setCari("");
                      }}
                    >
                      Hapus saringan
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-8">
                {KELOMPOK.filter((k) => saring === "semua" || saring === k.status).map((k) => {
                  const isi = tersaring.filter((d) => d.status === k.status);
                  if (isi.length === 0 && (adaSaringan || k.status === "Selesai")) return null;
                  return (
                    <section key={k.status} aria-labelledby={`kel-${k.status}`}>
                      <h2 id={`kel-${k.status}`} className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                        {k.judul}
                        <span className="font-mono text-xs">{isi.length}</span>
                      </h2>
                      {isi.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{k.kosong}</p>
                      ) : (
                        <motion.ul layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <AnimatePresence initial={false}>
                            {isi.map((d, i) => (
                              <KartuDiklat key={d.id} diklat={d} hariIni={hariIni} urutan={i} onPilih={() => setDipilih(d)} />
                            ))}
                          </AnimatePresence>
                        </motion.ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <DetailDiklat diklat={dipilih} hariIni={hariIni} bolehRincian={bolehRincian} onTutup={() => setDipilih(null)} />

      {tambah ? (
        <FormTambahJadwal
          buka={formBuka}
          global={tambah.global}
          pilihanTim={tambah.tim}
          onTutup={() => setFormBuka(false)}
          onTersimpan={(nama) => {
            setFormBuka(false);
            setKabar(`"${nama}" ditambahkan ke jadwal.`);
          }}
        />
      ) : null}

      <Toast title="Jadwal tersimpan" description={kabar ?? undefined} open={kabar !== null} onOpenChange={(o) => !o && setKabar(null)} />
    </HalamanDasbor>
  );
}
