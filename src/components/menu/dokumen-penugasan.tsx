"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { geserBulan, labelBulan, tanggalPanjang } from "@/lib/dokumen";
import { ambilJson } from "@/lib/api-klien";
import type { SuratTugasRecord } from "@/lib/server/repositories/dokumen";

type SuratDaftar = SuratTugasRecord & { bolehBukaDiklat: boolean };

/**
 * Dokumen Penugasan (sama dengan aplikasi lama): surat tugas mengajar (Word/PDF konsep tanpa tanda tangan untuk TTE) dan,
 * bagi pengelola & Koordinator WI, rekap JP tatap muka bulanan semua WI (CSV).
 */
export function DokumenPenugasan({ hariIni, pengelola, keteranganSurat }: { hariIni: string; pengelola: boolean; keteranganSurat: string }) {
  const tahunIni = Number(hariIni.slice(0, 4));
  const [tahun, setTahun] = useState(String(tahunIni));
  const [cari, setCari] = useState("");
  const [surat, setSurat] = useState<SuratDaftar[] | null>(null);
  const [galat, setGalat] = useState("");
  const [bulan, setBulan] = useState(hariIni.slice(0, 7));
  useEffect(() => {
    let batal = false;
    setSurat(null);
    ambilJson<SuratDaftar[]>(`/api/surat-tugas?tahun=${tahun}`).then((r) => {
      if (batal) return;
      if (r.ok) setSurat(r.data);
      else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [tahun]);
  const q = cari.trim().toLowerCase();
  const tampil = (surat ?? []).filter((s) => !q || [s.nomor ?? "", s.trainingName, ...s.penerima.map((p) => p.nama)].some((x) => x.toLowerCase().includes(q)));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium">Surat Tugas</h2>
            <p className="text-sm text-muted-foreground">{keteranganSurat}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <Select
                label="Tahun"
                value={tahun}
                onValueChange={setTahun}
                options={Array.from({ length: 4 }, (_, i) => String(tahunIni + 1 - i)).map((t) => ({ value: t, label: t }))}
              />
            </div>
            <Input label="Cari" value={cari} onChange={setCari} placeholder="Nomor, diklat, nama…" leftIcon={<Search size={16} />} />
          </div>
        </div>
        {galat ? (
          <Alert tone="danger" title={galat} />
        ) : !surat ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                  {["Tanggal", "Nomor", "Diklat", "Kepada", "Unduh"].map((h) => (
                    <th key={h} className="px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tampil.map((s) => (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{tanggalPanjang(s.tanggal)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.nomor ?? "—"}</td>
                    <td className="px-3 py-2">
                      {s.bolehBukaDiklat ? (
                        <Link href={`/dashboard/diklat/${s.trainingId}`} className="hover:underline">
                          {s.trainingName}
                        </Link>
                      ) : (
                        s.trainingName
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.penerima.length === 1 ? s.penerima[0].nama : `${s.penerima.length} orang`}
                      {s.penerima.length > 1 ? <span className="block text-xs text-muted-foreground">{s.penerima.map((p) => p.nama).join(", ")}</span> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <ButtonLink size="sm" variant="ghost" href={`/api/surat-tugas/${s.id}/docx`}>
                        <FileText size={14} /> Word
                      </ButtonLink>
                      <ButtonLink size="sm" variant="ghost" href={`/cetak/surat-tugas/${s.id}`} target="_blank" rel="noopener">
                        PDF
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
                {!tampil.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                      {cari ? "Tidak ada surat yang cocok." : `Belum ada surat tugas tahun ${tahun}.`}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pengelola ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <div>
            <h2 className="font-display text-lg font-medium">Rekap JP bulanan Widyaiswara</h2>
            <p className="text-sm text-muted-foreground">JP tatap muka semua WI dari sesi mengajar yang dicatat. KARKEN dibuat masing-masing WI di luar aplikasi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="ghost" aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan, -1))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-36 text-center text-sm">{labelBulan(bulan)}</span>
            <Button size="icon" variant="ghost" aria-label="Bulan berikutnya" onClick={() => setBulan(geserBulan(bulan, 1))}>
              <ChevronRight size={16} />
            </Button>
            <ButtonLink size="sm" href={`/api/rekap-jp?bulan=${bulan}&format=csv`}>
              <Download size={14} /> Unduh CSV (Excel)
            </ButtonLink>
            <ButtonLink size="sm" variant="ghost" href="/dashboard/wi">
              Lihat Beban JP di layar
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
