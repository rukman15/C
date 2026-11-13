"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, RotateCw } from "lucide-react";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { JadwalPembelajaran, SesiPembelajaran } from "@/lib/data-pembelajaran";
import { Galat } from "./form-sesi";

const LAIN = "__lain";
type Isian = { kelompokId: string; wi: string; nama: string; tautan: string };

/**
 * Pengajar & tautan Zoom per kelompok e-learning untuk satu sesi (EB-052), mengikuti pola jadwal balai ("Kel. 1 …,
 * 2 …"). Diisi manual; "Salin sesi sebelumnya" mengambil isian sesi terakhir sebelum sesi ini, "Gilir" menggeser
 * pengajar satu kelompok (Kel. 1 → Kel. 2, …, terakhir → Kel. 1). Baris tanpa pengajar dan tautan dikosongkan.
 */
export function FormPerKelompok({ data, sesi, onSelesai }: { data: JadwalPembelajaran; sesi: SesiPembelajaran; onSelesai: (pesan: string) => void }) {
  const router = useRouter();
  const dariSesi = (s: SesiPembelajaran): Isian[] =>
    data.kelompokElearning.map((k) => {
      const p = s.perKelompok.find((x) => x.kelompokId === k.id);
      const wi = p?.pengajarPegawaiId && data.wi.some((w) => w.id === p.pengajarPegawaiId) ? p.pengajarPegawaiId : p?.pengajarNama ? LAIN : "";
      return { kelompokId: k.id, wi, nama: wi === LAIN ? (p?.pengajarNama ?? "") : "", tautan: p?.tautan ?? "" };
    });
  const [isi, setIsi] = useState<Isian[]>(() => dariSesi(sesi));
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const sebelumnya = [...data.sesi]
    .filter((s) => s.id !== sesi.id && s.perKelompok.length && (s.tanggal < sesi.tanggal || (s.tanggal === sesi.tanggal && (s.jamMulai ?? "") < (sesi.jamMulai ?? ""))))
    .pop();
  const atur = (i: number, k: keyof Isian, v: string) => setIsi((x) => x.map((b, j) => (j === i ? { ...b, [k]: v } : b)));

  function gilir() {
    setIsi((x) =>
      x.map((b, i) => {
        const dari = x[(i - 1 + x.length) % x.length];
        return { ...b, wi: dari.wi, nama: dari.nama, tautan: dari.tautan };
      }),
    );
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const baris = isi.map((b) => ({
      kelompokId: b.kelompokId,
      pengajarPegawaiId: b.wi && b.wi !== LAIN ? b.wi : null,
      pengajarNama: b.wi === LAIN ? b.nama.trim() || null : null,
      tautan: b.tautan.trim() || null,
    }));
    const res = await kirimJson(`/api/pembelajaran/${encodeURIComponent(sesi.id)}/kelompok`, "PUT", { baris });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(`Pengajar per kelompok disimpan untuk ${sesi.kegiatan}.`);
  }

  if (!data.kelompokElearning.length) {
    return <p className="text-sm text-muted-foreground">Kelompok e-learning belum dibentuk. Bentuk dulu di tab Kelompok (jenis E-learning).</p>;
  }
  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sebelumnya ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setIsi(dariSesi(sebelumnya))}>
            <Copy size={14} /> Salin sesi {formatTanggalId(sebelumnya.tanggal)}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="secondary" onClick={gilir}>
          <RotateCw size={14} /> Gilir pengajar
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {data.kelompokElearning.map((k, i) => (
          <fieldset key={k.id} className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-end">
            <legend className="sr-only">{k.label}</legend>
            <p className="text-sm font-medium sm:pb-2.5">{k.label}</p>
            <div className="flex flex-col gap-2">
              <Select
                label="Pengajar"
                placeholder="Belum ditentukan"
                value={isi[i].wi || undefined}
                onValueChange={(v) => atur(i, "wi", v)}
                options={[...data.wi.map((w) => ({ value: w.id, label: w.nama })), { value: LAIN, label: "Nama lain…" }]}
              />
              {isi[i].wi === LAIN ? <Input label="Nama pengajar" value={isi[i].nama} onChange={(v) => atur(i, "nama", v)} maxLength={150} /> : null}
            </div>
            <Input label="Tautan Zoom" value={isi[i].tautan} onChange={(v) => atur(i, "tautan", v)} maxLength={500} placeholder="https://zoom.us/j/…" inputMode="url" />
          </fieldset>
        ))}
      </div>
      <Galat teks={galat} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai("")}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
