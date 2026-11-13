"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Select } from "@/components/arc/select/select";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { Alert } from "@/components/arc/alert/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BENTUK_SESI, labelBentuk } from "@/lib/kehadiran";
import { daftarMataPelatihan } from "@/lib/kurikulum";
import { JP_SESI_MAKS, SESI_MAKS_PER_PERMINTAAN, formatTanggalId, parseTempelan, totalJp } from "@/lib/sesi";
import { dariIso, keIso } from "@/lib/jadwal";
import { kirimJson } from "@/lib/api-klien";
import type { JadwalPembelajaran, SesiPembelajaran } from "@/lib/data-pembelajaran";

export function Galat({ teks }: { teks: string }) {
  return teks ? (
    <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {teks}
    </p>
  ) : null;
}

const OPSI_BENTUK = BENTUK_SESI.map((b) => ({ value: b.value, label: b.label }));

function PilihBentuk({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const b = BENTUK_SESI.find((x) => x.value === value);
  return (
    <div className="flex flex-col gap-2">
      <ChipGroup label="Bentuk" multiple={false} value={[value]} onValueChange={(v) => v[0] && onChange(v[0])} options={OPSI_BENTUK} />
      {b && !b.wajibHadir ? <p className="text-xs text-muted-foreground">Presensi tetap dicatat, tetapi tidak dihitung dalam batas ketidakhadiran.</p> : null}
    </div>
  );
}

/**
 * Tambah atau ubah satu sesi. Sama dengan form aplikasi lama: setelah menambah, tanggal, bentuk, dan
 * mata pelatihan dipertahankan supaya bisa mengisi beruntun. Aturan isian dijaga server.
 */
export function FormSesi({
  data,
  ubah,
  onSelesai,
  onTambah,
}: {
  data: JadwalPembelajaran;
  ubah: SesiPembelajaran | null;
  onSelesai: (pesan: string) => void;
  onTambah: (pesan: string) => void;
}) {
  const router = useRouter();
  const t = data.training;
  const mpPilihan = useMemo(() => daftarMataPelatihan(t.jenisPelatihan), [t.jenisPelatihan]);
  const awal = ubah?.tanggal ?? (data.sesi.length ? data.sesi[data.sesi.length - 1].tanggal : t.startDate);
  const [tanggal, setTanggal] = useState(awal);
  const [jam, setJam] = useState(ubah?.jamMulai ?? "");
  const [kegiatan, setKegiatan] = useState(ubah?.kegiatan ?? "");
  const [jp, setJp] = useState(ubah?.jp ?? 0);
  const [bentuk, setBentuk] = useState(ubah?.bentuk ?? "KLASIKAL");
  const [mp, setMp] = useState(ubah?.mataPelatihan ?? "");
  const [ruang, setRuang] = useState(ubah?.ruang ?? "");
  const [tautan, setTautan] = useState(ubah?.tautan ?? "");
  const [ket, setKet] = useState(ubah?.keterangan ?? "");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  function pilihMp(kode: string) {
    setMp(kode);
    // Kegiatan masih kosong: isi dengan nama mata pelatihan (bisa diubah).
    if (!kegiatan.trim()) setKegiatan(mpPilihan.find((m) => m.kode === kode)?.nama ?? "");
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!tanggal) return setGalat("Pilih tanggal sesi.");
    if (!kegiatan.trim()) return setGalat("Isi nama kegiatan.");
    if (jp < 1) return setGalat("Isi JP minimal 1.");
    setSibuk(true);
    setGalat("");
    const isi = {
      tanggal,
      jamMulai: jam.trim() || null,
      kegiatan,
      jp,
      bentuk,
      mataPelatihan: (mpPilihan.length > 0 && mp) || null,
      keterangan: ket.trim() || null,
      tautan: tautan.trim() || null,
      ruang: ruang.trim() || null,
    };
    const res = ubah
      ? await kirimJson(`/api/pembelajaran/${encodeURIComponent(ubah.id)}`, "PATCH", isi)
      : await kirimJson(`/api/training/${encodeURIComponent(t.id)}/pembelajaran`, "POST", { sesi: [isi] });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    if (ubah) return onSelesai("Perubahan sesi disimpan.");
    onTambah(`"${kegiatan.trim()}" ditambahkan pada ${formatTanggalId(tanggal)}.`);
    setKegiatan("");
    setJam("");
    setKet("");
    setTautan("");
    setJp(0);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <DatePicker label="Tanggal" value={dariIso(tanggal)} onChange={(d) => setTanggal(d ? keIso(d) : "")} locale="id-ID" format={{ weekday: "long", day: "numeric", month: "long", year: "numeric" }} />
        <Input label="Jam mulai" value={jam} onChange={setJam} placeholder="08:00" inputMode="numeric" maxLength={5} />
      </div>
      {mpPilihan.length > 0 ? (
        <Select label="Mata pelatihan" placeholder="Bukan mata pelatihan (mis. pembukaan)" value={mp || undefined} onValueChange={pilihMp} options={mpPilihan.map((m) => ({ value: m.kode, label: m.nama }))} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Input label="Kegiatan" value={kegiatan} onChange={setKegiatan} maxLength={200} placeholder="mis. Pembukaan dan orientasi" />
        <NumberField label="JP" value={jp} onValueChange={setJp} min={0} max={JP_SESI_MAKS} suffix=" JP" locale="id-ID" />
      </div>
      <PilihBentuk value={bentuk} onChange={setBentuk} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Ruang (opsional)" value={ruang} onChange={setRuang} maxLength={100} placeholder="Kosong = tempat diklat" />
        <Input label="Tautan rapat (opsional)" value={tautan} onChange={setTautan} maxLength={500} placeholder="https://…" inputMode="url" />
      </div>
      <Input label="Keterangan (opsional)" value={ket} onChange={setKet} maxLength={300} />
      <Galat teks={galat} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai("")}>
          {ubah ? "Batal" : "Selesai"}
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Tambah sesi"}
        </Button>
      </div>
    </form>
  );
}

/** Tempel banyak sesi dari Excel: Tanggal | Kegiatan | JP | Keterangan. Satu baris salah = tidak ada yang disimpan. */
export function FormTempel({ data, onSelesai }: { data: JadwalPembelajaran; onSelesai: (pesan: string) => void }) {
  const router = useRouter();
  const [teks, setTeks] = useState("");
  const [bentuk, setBentuk] = useState("KLASIKAL");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const hasil = useMemo(() => (teks.trim() ? parseTempelan(teks, { tahunDefault: Number(data.training.startDate.slice(0, 4)) }) : null), [teks, data.training.startDate]);
  const terlaluBanyak = (hasil?.baris.length ?? 0) > SESI_MAKS_PER_PERMINTAAN;

  async function simpan() {
    if (!hasil?.baris.length) return;
    setSibuk(true);
    setGalat("");
    const sesi = hasil.baris.map((b) => ({ tanggal: b.tanggal, kegiatan: b.kegiatan, jp: b.jp, bentuk, keterangan: b.keterangan ?? null }));
    const res = await kirimJson<unknown[]>(`/api/training/${encodeURIComponent(data.training.id)}/pembelajaran`, "POST", { sesi });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(`${res.data.length} sesi ditambahkan.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PilihBentuk value={bentuk} onChange={setBentuk} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Tempel di sini</span>
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          rows={8}
          placeholder={"Senin, 3 Nov 2026\tPembukaan\t2\n4/11/2026\tKebijakan publik\t6\tRuang A"}
          className="w-full rounded-2xl border border-border bg-transparent p-3 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus:border-border-strong"
        />
      </label>
      {hasil ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-mono">{hasil.baris.length}</span> sesi terbaca · <span className="font-mono">{totalJp(hasil.baris)}</span> JP · {labelBentuk(bentuk)}
          </p>
          {hasil.galat.length ? (
            <Alert tone="warning" title={`${hasil.galat.length} baris tidak terbaca dan akan dilewati`}>
              <ul className="mt-1 list-disc pl-4">
                {hasil.galat.slice(0, 6).map((g) => (
                  <li key={g.nomor}>
                    Baris <span className="font-mono">{g.nomor}</span>: {g.alasan}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {terlaluBanyak ? <Alert tone="danger" title={`Maksimal ${SESI_MAKS_PER_PERMINTAAN} sesi sekali simpan`}>Tempel sebagian dulu.</Alert> : null}
          {hasil.baris.length ? (
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-border text-sm">
              {hasil.baris.map((b, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{b.tanggal}</span>
                  <span className="min-w-0 flex-1 truncate">{b.kegiatan}</span>
                  <span className="font-mono text-xs">{b.jp} JP</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <Galat teks={galat} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai("")}>
          Batal
        </Button>
        <Button type="button" onClick={simpan} disabled={sibuk || !hasil?.baris.length || terlaluBanyak}>
          {sibuk ? "Menyimpan…" : `Simpan ${hasil?.baris.length ?? 0} sesi`}
        </Button>
      </div>
    </div>
  );
}
