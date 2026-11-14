"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tanggalPanjang } from "@/lib/dokumen";
import { hariAkhirPekan, kalimatTanggalTugas, rapikanRentang, type RentangTanggal } from "@/lib/persuratan";
import { cocokPilihanTtd, type PilihanTtd } from "@/lib/tata-naskah";
import { ambilJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";

/** Gaya isian bersama halaman persuratan (selaras dengan Input beUI). */
export const ISIAN = "h-10 w-full rounded-full border border-border bg-transparent px-4 text-sm outline-none focus:border-border-strong disabled:opacity-60";
export const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";
export const LABEL = "flex flex-col gap-1.5 text-sm font-medium";

/**
 * Isian tanggal tugas: satu atau beberapa rentang (hari kalender). Menampilkan kalimat yang dipasang di surat dan catatan bila
 * mencakup Sabtu/Minggu (hanya catatan, tidak diblokir).
 */
export function TanggalTugasIsian({ rentang, onUbah, label = "Tanggal tugas" }: { rentang: RentangTanggal[]; onUbah: (r: RentangTanggal[]) => void; label?: string }) {
  const rapi = rapikanRentang(rentang);
  const kalimat = kalimatTanggalTugas(rapi);
  const akhirPekan = hariAkhirPekan(rapi);
  function ubahBaris(i: number, kunci: "mulai" | "selesai", nilai: string) {
    const baru = rentang.map((r, j) => (j === i ? { ...r, [kunci]: nilai } : r));
    // Tanggal selesai mengikuti tanggal mulai bila kosong atau lebih awal.
    if (kunci === "mulai" && (!baru[i].selesai || baru[i].selesai < nilai)) baru[i] = { ...baru[i], selesai: nilai };
    onUbah(baru);
  }
  const akhir = rentang[rentang.length - 1];
  return (
    <div className={LABEL}>
      <span>{label} (boleh beberapa rentang; dihitung hari kalender)</span>
      {rentang.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 font-normal">
          <input type="date" value={r.mulai} onChange={(e) => ubahBaris(i, "mulai", e.target.value)} className={cn(ISIAN, "w-auto")} aria-label={`Mulai rentang ${i + 1}`} />
          <span className="text-muted-foreground">s.d.</span>
          <input
            type="date"
            value={r.selesai}
            min={r.mulai}
            onChange={(e) => ubahBaris(i, "selesai", e.target.value)}
            className={cn(ISIAN, "w-auto")}
            aria-label={`Selesai rentang ${i + 1}`}
          />
          <Button type="button" size="sm" variant="ghost" aria-label={`Hapus rentang ${i + 1}`} onClick={() => onUbah(rentang.filter((_, j) => j !== i))}>
            <X size={14} />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="secondary" onClick={() => onUbah([...rentang, { mulai: akhir?.selesai ?? "", selesai: akhir?.selesai ?? "" }])}>
          <Plus size={14} /> Rentang tanggal
        </Button>
      </div>
      {kalimat ? <span className="text-xs font-normal">Di surat: “…, {kalimat}”</span> : null}
      {akhirPekan.length ? <span className="text-xs font-normal text-warning">Catatan: termasuk hari Sabtu/Minggu ({akhirPekan.map(tanggalPanjang).join(", ")}).</span> : null}
    </div>
  );
}

/**
 * Pilihan penanda tangan sesuai kewenangan (Permendagri 18/2024 Lampiran VIII) pada tanggal surat: Kepala Balai, Plt./Plh. yang
 * berlaku, Kabag TU a.n. Kepala Balai. Memilih mengisi jabatan, nama, dan NIP. Jenis `wajib` (surat tugas) ditolak server bila di luar pilihan.
 */
export function PilihPenandatangan({
  jenis,
  tanggal,
  ttd,
  onPilih,
  className,
}: {
  jenis: string;
  tanggal: string;
  ttd: { jabatan: string; nama: string; nip: string };
  onPilih: (t: { jabatan: string; nama: string; nip: string }) => void;
  className?: string;
}) {
  const [pilihan, setPilihan] = useState<PilihanTtd[]>([]);
  const [wajib, setWajib] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    if (!jenis || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return;
    let batal = false;
    ambilJson<{ wajib: boolean; pilihan: PilihanTtd[] }>(`/api/penandatangan?jenis=${encodeURIComponent(jenis)}&tanggal=${tanggal}`).then((r) => {
      if (batal) return;
      if (r.ok) {
        setPilihan(r.data.pilihan);
        setWajib(r.data.wajib);
        setGalat("");
      } else setGalat(r.error);
    });
    return () => {
      batal = true;
    };
  }, [jenis, tanggal]);
  const terpilih = pilihan.findIndex((o) => cocokPilihanTtd([o], { jabatan: ttd.jabatan.split("\n"), nama: ttd.nama, nip: ttd.nip }));

  return (
    <label className={cn(LABEL, className)}>
      Penanda tangan (sesuai kewenangan pada tanggal surat)
      <select
        className={cn(ISIAN, "font-normal")}
        value={terpilih >= 0 ? String(terpilih) : ""}
        onChange={(e) => {
          const o = pilihan[Number(e.target.value)];
          if (o) onPilih({ jabatan: o.jabatan.join("\n"), nama: o.nama, nip: o.nip });
        }}
      >
        <option value="" disabled={wajib}>
          {wajib ? "Pilih penanda tangan…" : "Isian sendiri"}
        </option>
        {pilihan.map((o, i) => (
          <option key={i} value={String(i)}>
            {o.label} · {o.nama || "(nama belum diisi)"}
          </option>
        ))}
      </select>
      {galat ? (
        <span className="text-xs font-normal text-destructive">{galat}</span>
      ) : wajib && pilihan.length && terpilih < 0 ? (
        <span className="text-xs font-normal text-warning">
          Penanda tangan surat tugas harus salah satu pilihan di atas (Kepala Balai, Plt./Plh., atau Kabag TU a.n. Kepala Balai).
        </span>
      ) : !pilihan.length ? (
        <span className="text-xs font-normal text-muted-foreground">Nama Kepala Balai/Kabag TU belum diisi di Pengaturan Dokumen atau Data Pegawai.</span>
      ) : null}
    </label>
  );
}
