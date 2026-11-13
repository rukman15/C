"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, LayoutList, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cip, Segmen } from "@/components/ui/segmen";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { cocokCari, type DataJadwal, type JadwalDiklat, type StatusDiklat } from "@/lib/jadwal";
import { KATEGORI_DIKLAT, labelKategori } from "@/lib/skema-training";
import type { TimDiklat } from "@/lib/tim-kerja";
import { KartuDiklat } from "./kartu-diklat";
import { Kalender } from "./kalender";
import { DetailDiklat } from "./detail-diklat";
import { JadwalMengajarSaya } from "./mengajar";
import { FormTambahJadwal } from "./form-tambah";

type Saring = "semua" | StatusDiklat;
type Tampilan = "daftar" | "kalender";

const KELOMPOK: { status: StatusDiklat; judul: string; kosong: string }[] = [
  { status: "Berjalan", judul: "Sedang berlangsung", kosong: "Tidak ada diklat yang sedang berlangsung." },
  { status: "Terjadwal", judul: "Akan datang", kosong: "Belum ada diklat terjadwal." },
  { status: "Selesai", judul: "Baru selesai", kosong: "Belum ada diklat yang selesai." },
];

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
  const [kategori, setKategori] = useState<string>("semua");
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
          (kategori === "semua" || d.category === kategori) &&
          cocokCari(d, labelKategori(d.category), cari),
      ),
    [data.diklat, saring, kategori, cari],
  );

  const adaSaringan = saring !== "semua" || kategori !== "semua" || cari.trim() !== "";
  const mengajar = data.mengajar ?? [];

  return (
    <HalamanDasbor
      judul="Jadwal Diklat"
      keterangan={`Kalender diklat BBPKA-PDN II${mengajar.length > 0 ? " dan jadwal mengajar Anda" : ""}.`}
      lebar="penuh"
    >
      <div className="-mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmen<Saring>
          label="Saring menurut status"
          nilai={saring}
          onPilih={setSaring}
          pilihan={[
            { value: "semua", label: "Semua", jumlah: data.diklat.length },
            { value: "Berjalan", label: "Berlangsung", jumlah: jumlah.Berjalan },
            { value: "Terjadwal", label: "Akan datang", jumlah: jumlah.Terjadwal },
            { value: "Selesai", label: "Selesai", jumlah: jumlah.Selesai },
          ]}
        />
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

      <AnimatePresence>
        {kabar ? (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm"
          >
            {kabar}
            <button type="button" onClick={() => setKabar(null)} aria-label="Tutup pesan" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {mengajar.length > 0 ? <JadwalMengajarSaya daftar={mengajar} hariIni={hariIni} /> : null}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex h-9 w-full shrink-0 items-center sm:w-64">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Cari diklat</span>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau tempat"
              className="h-9 w-full rounded-full border border-border bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-border-strong"
            />
          </label>
          <Cip
            gulir
            label="Saring menurut kategori"
            nilai={kategori}
            onPilih={setKategori}
            pilihan={[{ value: "semua", label: "Semua kategori" }, ...KATEGORI_DIKLAT.map((k) => ({ value: k.value as string, label: k.label }))]}
          />
        </div>
        <Segmen<Tampilan>
          label="Tampilan"
          nilai={tampilan}
          onPilih={setTampilan}
          pilihan={[
            {
              value: "daftar",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutList className="size-4" aria-hidden /> Daftar
                </span>
              ),
            },
            {
              value: "kalender",
              label: (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden /> Kalender
                </span>
              ),
            },
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
              <KosongSaringan
                ada={adaSaringan}
                onReset={() => {
                  setSaring("semua");
                  setKategori("semua");
                  setCari("");
                }}
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
            setKabar(`Jadwal "${nama}" ditambahkan.`);
          }}
        />
      ) : null}
    </HalamanDasbor>
  );
}

function KosongSaringan({ ada, onReset }: { ada: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-14 text-center">
      <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{ada ? "Tidak ada diklat yang cocok dengan saringan." : "Belum ada jadwal diklat."}</p>
      {ada ? (
        <button type="button" onClick={onReset} className="text-sm text-primary hover:underline">
          Hapus saringan
        </button>
      ) : null}
    </div>
  );
}
