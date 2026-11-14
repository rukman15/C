"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { tanggalPanjang } from "@/lib/dokumen";
import type { PilihanKlien } from "@/lib/persuratan-klien";
import { ambilJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { SuratTugasGabungan } from "@/lib/server/repositories/surat-tugas-semua";
import { ISIAN, LABEL } from "./isian";

const SEMUA = "__semua";
const tautWord = (s: SuratTugasGabungan) =>
  s.sumber === "naskah" ? `/api/persuratan/naskah/${encodeURIComponent(s.id)}/docx` : `/api/surat-tugas/${encodeURIComponent(s.id)}/docx`;
const tautPdf = (s: SuratTugasGabungan) => (s.sumber === "naskah" ? `/cetak/naskah/${encodeURIComponent(s.id)}` : `/cetak/surat-tugas/${encodeURIComponent(s.id)}`);
// Mengubah: umum di isian naskah; mengajar di panel surat tugas Rincian Diklat.
const tautUbah = (s: SuratTugasGabungan) =>
  s.sumber === "naskah" ? `/dashboard/persuratan?ubah=${encodeURIComponent(s.id)}` : `/dashboard/diklat/${encodeURIComponent(s.trainingId ?? "")}#surat-tugas`;

/**
 * Surat Tugas: SATU daftar untuk surat tugas mengajar (dari Rincian Diklat) dan surat tugas umum (naskah dinas). Keputusan
 * 28 Okt 2026, sama dengan aplikasi lama.
 */
export function SuratTugasSemua({ hariIni }: { hariIni: string }) {
  const router = useRouter();
  const [pilihan, setPilihan] = useState<PilihanKlien | null>(null);
  const [tahun, setTahun] = useState(Number(hariIni.slice(0, 4)));
  const [daftar, setDaftar] = useState<SuratTugasGabungan[] | null>(null);
  const [galat, setGalat] = useState("");
  const [saringJenis, setSaringJenis] = useState(SEMUA);
  const [saringNomor, setSaringNomor] = useState(SEMUA);
  const [cari, setCari] = useState("");
  const [diklat, setDiklat] = useState("");

  useEffect(() => {
    ambilJson<PilihanKlien>("/api/persuratan/pilihan").then((r) => (r.ok ? setPilihan(r.data) : setGalat(r.error)));
  }, []);
  useEffect(() => {
    if (!pilihan || (!pilihan.hak.susun && !pilihan.hak.nomor)) return;
    let batal = false;
    setDaftar(null);
    ambilJson<SuratTugasGabungan[]>(`/api/persuratan/surat-tugas?tahun=${tahun}`).then((r) => {
      if (batal) return;
      if (r.ok) setDaftar(r.data);
      else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [pilihan, tahun]);

  const q = cari.trim().toLowerCase();
  const tampil = (daftar ?? []).filter(
    (s) =>
      (saringJenis === SEMUA || s.sumber === saringJenis) &&
      (saringNomor === SEMUA || (saringNomor === "belum" ? !s.nomor : !!s.nomor)) &&
      (!q || `${s.ringkas} ${s.trainingName ?? ""} ${s.nomor ?? ""}`.toLowerCase().includes(q)),
  );
  const jumlahBelum = (daftar ?? []).filter((s) => !s.nomor).length;

  if (galat && !pilihan) return <Alert tone="danger" title={galat} />;
  if (!pilihan) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (!pilihan.hak.susun && !pilihan.hak.nomor)
    return (
      <EmptyState title="Tidak berwenang" description="Surat tugas disusun oleh TU, Kepegawaian, Ketua Diklat, dan pimpinan. Surat tugas untuk Anda ada di Surat Tugas Saya." />
    );

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {pilihan.hak.susun ? (
        <section className="grid gap-4 rounded-2xl border border-border p-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-base font-medium">Surat tugas umum</h2>
            <p className="text-xs text-muted-foreground">Monitoring, rapat, lomba, studi lapangan, dll. Penerima pegawai mana pun.</p>
            <div>
              <ButtonLink href="/dashboard/persuratan?buat=SURAT_TUGAS">
                <Plus size={16} /> Buat surat tugas umum
              </ButtonLink>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-base font-medium">Surat tugas mengajar</h2>
            <p className="text-xs text-muted-foreground">Penerima adalah pengampu yang sudah ditetapkan di diklat itu.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  label="Diklat"
                  value={diklat}
                  onValueChange={setDiklat}
                  placeholder="Pilih diklat…"
                  options={pilihan.diklat.map((d) => ({ value: d.id, label: `${d.name} · ${tanggalPanjang(d.startDate)}` }))}
                />
              </div>
              <Button variant="secondary" disabled={!diklat} onClick={() => router.push(`/dashboard/diklat/${encodeURIComponent(diklat)}#surat-tugas`)}>
                Buka <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Daftar surat tugas {tahun}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56">
              <Input label="Cari" value={cari} onChange={setCari} placeholder="Isi, diklat, nomor…" leftIcon={<Search size={16} />} />
            </div>
            <div className="w-44">
              <Select
                label="Jenis"
                value={saringJenis}
                onValueChange={setSaringJenis}
                options={[
                  { value: SEMUA, label: "Mengajar & umum" },
                  { value: "surat-tugas", label: "Mengajar" },
                  { value: "naskah", label: "Umum" },
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Nomor"
                value={saringNomor}
                onValueChange={setSaringNomor}
                options={[
                  { value: SEMUA, label: "Semua" },
                  { value: "belum", label: `Belum bernomor${jumlahBelum ? ` (${jumlahBelum})` : ""}` },
                  { value: "sudah", label: "Sudah bernomor" },
                ]}
              />
            </div>
            <label className={cn(LABEL, "w-24")}>
              Tahun
              <input type="number" min={2020} max={2100} value={tahun} onChange={(e) => setTahun(Number(e.target.value) || tahun)} className={cn(ISIAN, "font-mono font-normal")} />
            </label>
          </div>
        </div>
        {!daftar ? (
          <p className="text-sm text-muted-foreground" role="status">
            Memuat…
          </p>
        ) : !daftar.length ? (
          <EmptyState title="Belum ada surat tugas pada tahun ini" description="Buat surat tugas umum atau surat tugas mengajar dari Rincian Diklat." />
        ) : !tampil.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada surat tugas yang cocok dengan saringan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Jenis</th>
                  <th className="px-3 py-2 font-medium">Untuk</th>
                  <th className="px-3 py-2 text-right font-medium">Penerima</th>
                  <th className="px-3 py-2 font-medium">Nomor</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((s) => (
                  <tr key={s.sumber + s.id} className="border-b border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2">{tanggalPanjang(s.tanggal)}</td>
                    <td className="px-3 py-2">
                      <Badge size="sm" tone={s.sumber === "surat-tugas" ? "info" : "neutral"}>
                        {s.sumber === "surat-tugas" ? "Mengajar" : "Umum"}
                      </Badge>
                      {s.trainingName ? <div className="mt-0.5 text-xs text-muted-foreground">{s.trainingName}</div> : null}
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <span className="line-clamp-2">{s.ringkas || "-"}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{s.jumlahPenerima}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {s.nomor ? (
                        <span className="font-mono">{s.nomor}</span>
                      ) : (
                        <Badge size="sm" tone="warning">
                          Belum bernomor
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <ButtonLink size="sm" variant="ghost" href={tautWord(s)} download>
                          Word
                        </ButtonLink>
                        <ButtonLink size="sm" variant="ghost" href={tautPdf(s)} target="_blank" rel="noopener">
                          PDF
                        </ButtonLink>
                        <ButtonLink size="sm" variant="secondary" href={tautUbah(s)}>
                          {!s.nomor ? "Isi nomor" : s.sumber === "naskah" ? "Ubah" : "Buka diklat"}
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
