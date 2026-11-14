"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import {
  DIMENSI,
  NAMA_DIMENSI,
  RENTANG_PENSIUN,
  TIDAK_DIKETAHUI,
  cocokSaringan,
  kunciPegawai,
  pegawaiAktif,
  statistikPegawai,
  type Dimensi,
  type Kelompok,
  type Saringan,
  type StatistikPegawai,
} from "@/lib/statistik-pegawai";
import { cn } from "@/lib/utils";
import type { PegawaiRecord } from "@/lib/server/types";

const angka = (n: number) => n.toLocaleString("id-ID");
const SERI = [
  { jk: "Laki-laki", warna: "var(--tone-sky)" },
  { jk: "Perempuan", warna: "var(--tone-orchid)" },
];
const PANEL = "rounded-2xl border border-border p-4";
const bulanTahun = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Data Pegawai (lihat saja), sama dengan aplikasi lama: statistik interaktif (klik batang = saring; tiap grafik dihitung dari
 * pegawai yang lolos saringan grafik lain), piramida usia & jenis kelamin, proyeksi pensiun, lalu tabel pegawai.
 */
export function DataPegawai({ list }: { list: PegawaiRecord[] }) {
  const [hanyaAktif, setHanyaAktif] = useState(true);
  const [saringan, setSaringan] = useState<Saringan>({});
  const kini = useMemo(() => new Date(), []);
  const dipakai = hanyaAktif ? list.filter((p) => pegawaiAktif(p.status)) : list;
  const kunci = useMemo(() => dipakai.map((p) => kunciPegawai(p, kini)), [dipakai, kini]);
  const subset = (...kecuali: Dimensi[]) => {
    const s: Saringan = { ...saringan };
    for (const d of kecuali) delete s[d];
    return dipakai.filter((_, i) => cocokSaringan(kunci[i], s));
  };
  const semua = statistikPegawai(subset(), kini);
  const per = Object.fromEntries(DIMENSI.map((d) => [d, statistikPegawai(subset(d), kini)])) as Record<Dimensi, StatistikPegawai>;
  const piramida = statistikPegawai(subset("usia", "jenisKelamin"), kini);
  const aktif = DIMENSI.filter((d) => saringan[d] !== undefined);
  const baris = dipakai.map((p, i) => ({ p, k: kunci[i] })).filter((b) => cocokSaringan(b.k, saringan));
  const tahunIni = kini.getFullYear();
  const pilih = (d: Dimensi, label: string) =>
    setSaringan((s) => {
      const n = { ...s };
      if (n[d] === label) delete n[d];
      else n[d] = label;
      return n;
    });
  const pilihPiramida = (usia: string, jk: string) =>
    setSaringan((s) => {
      const n = { ...s };
      if (n.usia === usia && n.jenisKelamin === jk) {
        delete n.usia;
        delete n.jenisKelamin;
      } else {
        n.usia = usia;
        n.jenisKelamin = jk;
      }
      return n;
    });
  const redup = (d: Dimensi, label: string) => saringan[d] !== undefined && saringan[d] !== label;
  const maksPiramida = Math.max(1, ...piramida.piramida.map((b) => Math.max(b.laki, b.perempuan)));
  const panel: { d: Dimensi; judul: string; data: Kelompok[]; catatan?: string; lebar?: string }[] = [
    {
      d: "pensiun",
      judul: `Proyeksi pensiun ${tahunIni}–${tahunIni + RENTANG_PENSIUN}`,
      data: per.pensiun.pensiun,
      catatan:
        `${angka(per.pensiun.pensiunNanti)} pegawai pensiun setelah ${tahunIni + RENTANG_PENSIUN}` +
        (per.pensiun.pensiunTakTerhitung ? `; ${angka(per.pensiun.pensiunTakTerhitung)} tidak terhitung (non-ASN atau tanggal lahir & NIP kosong)` : "") +
        ". BUP: 65 JF ahli utama, 60 JF ahli madya & pimpinan tinggi, 58 lainnya; TMT = awal bulan setelah mencapai BUP.",
    },
    { d: "jenisJabatan", judul: "Jenis jabatan", data: per.jenisJabatan.jenisJabatan },
    {
      d: "jabatanFungsional",
      judul: "Jabatan fungsional",
      data: per.jabatanFungsional.jabatanFungsional,
      catatan: "Semua jenjang digabung; persen dari jumlah pejabat fungsional.",
      lebar: "10rem",
    },
    { d: "pendidikan", judul: "Pendidikan", data: per.pendidikan.pendidikan },
    { d: "golongan", judul: "Golongan", data: per.golongan.golongan },
    { d: "kelasJabatan", judul: "Kelas jabatan", data: per.kelasJabatan.kelasJabatan },
    { d: "jenisKepegawaian", judul: "Jenis kepegawaian", data: per.jenisKepegawaian.jenisKepegawaian, lebar: "8.5rem" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium">Statistik</h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hanyaAktif} onChange={(e) => setHanyaAktif(e.target.checked)} /> Hanya pegawai aktif
          {hanyaAktif && dipakai.length !== list.length ? ` (${list.length - dipakai.length} lainnya disembunyikan)` : ""}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={PANEL}>
          <p className="text-xs text-muted-foreground">Jumlah pegawai</p>
          <p className="mt-1 font-display font-mono text-2xl">{angka(semua.total)}</p>
        </div>
        {SERI.map((k) => (
          <button
            key={k.jk}
            type="button"
            aria-pressed={saringan.jenisKelamin === k.jk}
            onClick={() => pilih("jenisKelamin", k.jk)}
            className={cn(PANEL, "text-left hover:border-primary", saringan.jenisKelamin === k.jk && "border-primary", redup("jenisKelamin", k.jk) && "opacity-50")}
          >
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: k.warna }} />
              {k.jk}
            </p>
            <p className="mt-1 font-display font-mono text-2xl">{angka(k.jk === "Laki-laki" ? per.jenisKelamin.lakiLaki : per.jenisKelamin.perempuan)}</p>
          </button>
        ))}
        <div className={PANEL}>
          <p className="text-xs text-muted-foreground">Rata-rata usia</p>
          <p className="mt-1 font-display font-mono text-2xl">{semua.rataUsia === null ? "-" : `${semua.rataUsia.toLocaleString("id-ID")} th`}</p>
        </div>
      </div>
      {aktif.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Disaring:</span>
          {aktif.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSaringan((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== d)))}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1"
            >
              {NAMA_DIMENSI[d]}: {saringan[d]} <X size={12} />
            </button>
          ))}
          <button type="button" onClick={() => setSaringan({})} className="text-muted-foreground underline">
            Hapus semua
          </button>
        </div>
      ) : null}
      {dipakai.length ? (
        <>
          <p className="text-xs text-muted-foreground">Klik batang untuk menyaring daftar pegawai; klik lagi untuk melepas.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className={PANEL}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Usia & jenis kelamin</h3>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {SERI.map((s) => (
                    <span key={s.jk} className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm" style={{ background: s.warna }} />
                      {s.jk}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="mt-3 space-y-0.5">
                {piramida.piramida.map((b) => (
                  <li key={b.label} className="grid grid-cols-[1fr_5.5rem_1fr] items-center text-xs">
                    {SERI.map((s, i) => {
                      const n = i === 0 ? b.laki : b.perempuan;
                      const dipilih = saringan.usia === b.label && saringan.jenisKelamin === s.jk;
                      const mati = (saringan.usia !== undefined || saringan.jenisKelamin !== undefined) && !dipilih;
                      return (
                        <button
                          key={s.jk}
                          type="button"
                          aria-pressed={dipilih}
                          onClick={() => pilihPiramida(b.label, s.jk)}
                          title={`${s.jk}, usia ${b.label}: ${n} orang`}
                          className={cn("flex items-center gap-1.5 rounded py-1 hover:bg-muted", i === 0 ? "order-1 flex-row-reverse" : "order-3", mati && "opacity-40")}
                        >
                          <span
                            className={cn("block h-3", i === 0 ? "rounded-l" : "rounded-r", dipilih && "ring-2 ring-foreground")}
                            style={{ width: `${n ? Math.max(3, (n / maksPiramida) * 80) : 0}%`, background: s.warna }}
                          />
                          <span className="font-mono">{angka(n)}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => pilih("usia", b.label)}
                      className={cn(
                        "order-2 truncate rounded px-1 py-1 text-center hover:bg-muted",
                        saringan.usia === b.label && saringan.jenisKelamin === undefined ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {b.label === TIDAK_DIKETAHUI ? "Tak diketahui" : b.label}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Usia dari tanggal lahir; kalau kosong, dari 8 digit awal NIP.</p>
            </div>
            {panel.map((p) => {
              const maks = Math.max(1, ...p.data.map((k) => k.jumlah));
              return (
                <div key={p.d} className={PANEL}>
                  <h3 className="text-sm font-medium">{p.judul}</h3>
                  {!p.data.length ? (
                    <p className="mt-3 text-xs text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ul className="mt-3 space-y-0.5">
                      {p.data.map((k) => {
                        const dipilih = saringan[p.d] === k.label;
                        return (
                          <li key={k.label}>
                            <button
                              type="button"
                              aria-pressed={dipilih}
                              onClick={() => pilih(p.d, k.label)}
                              title={`${k.label}: ${k.jumlah} orang (${k.persen}%)`}
                              className={cn("grid w-full items-center gap-3 rounded px-1 py-1 text-left text-xs hover:bg-muted", redup(p.d, k.label) && "opacity-40")}
                              style={{ gridTemplateColumns: `${p.lebar ?? "7rem"} 1fr 6.5rem` }}
                            >
                              <span className={cn("truncate", dipilih ? "font-medium" : "text-muted-foreground")}>{k.label}</span>
                              <span className="h-3 rounded-r bg-muted">
                                <span
                                  className={cn("block h-3 rounded-r", k.label === TIDAK_DIKETAHUI ? "bg-muted-foreground/50" : "bg-primary", dipilih && "ring-2 ring-foreground")}
                                  style={{ width: `${k.jumlah ? Math.max(2, (k.jumlah / maks) * 100) : 0}%` }}
                                />
                              </span>
                              <span className="text-right font-mono">
                                {angka(k.jumlah)} <span className="text-muted-foreground">· {k.persen.toLocaleString("id-ID")}%</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {p.catatan ? <p className="mt-2 text-xs text-muted-foreground">{p.catatan}</p> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-medium">
          Daftar pegawai{" "}
          <span className="font-mono text-sm text-muted-foreground">
            ({baris.length}
            {baris.length !== dipakai.length ? ` dari ${dipakai.length}` : ""})
          </span>
        </h2>
        {aktif.length ? (
          <button type="button" onClick={() => setSaringan({})} className="text-xs text-primary underline">
            Hapus saringan
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
              {["Nama", "NIP", "Jabatan", "Usia", "Pangkat/gol", "Pendidikan", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map(({ p, k }) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.nama}</p>
                  <p className="text-xs text-muted-foreground">{p.jenisKepegawaian ?? "-"}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.nip ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.jabatan ?? "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono">{k.umur ?? "-"}</span>
                  {k.tmtPensiun ? <p className="text-xs text-muted-foreground">pensiun {bulanTahun(k.tmtPensiun)}</p> : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{[p.pangkat, p.golRuang].filter(Boolean).join(" / ") || "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{[p.tingkatPendidikan, p.jurusan].filter(Boolean).join(" - ") || "-"}</td>
                <td className="px-4 py-3">
                  <Badge size="sm" tone={p.status === "AKTIF" ? "success" : "warning"}>
                    {p.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {!baris.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada pegawai yang cocok dengan saringan.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
