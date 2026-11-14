"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_PEGAWAI_BAKU, statusMenutupAkun } from "@/lib/plt";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { PegawaiRecord } from "@/lib/server/types";

const KOSONG = "__kosong";

/**
 * Kelola Pegawai (admin), sama dengan aplikasi lama: tambah pegawai, ubah data HR per baris. Status PINDAH/PENSIUN/BERHENTI/
 * NONAKTIF menutup akun dan mencabut Plt/Plh-nya (server). Edit manual bisa tertimpa bila data HR disinkronkan ulang.
 */
export function KelolaPegawai({ awal }: { awal: PegawaiRecord[] }) {
  const [list, setList] = useState(awal);
  const [cari, setCari] = useState("");
  const [tambah, setTambah] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const q = cari.trim().toLowerCase();
  const tampil = q ? list.filter((p) => p.nama.toLowerCase().includes(q) || (p.nip ?? "").includes(q) || (p.jabatan ?? "").toLowerCase().includes(q)) : list;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Data HR (<span className="font-mono">{list.length}</span> pegawai). Perubahan langsung tersimpan; bila data HR disinkronkan ulang dari Excel, edit manual bisa tertimpa.
      </p>
      {tambah ? (
        <FormTambah
          onSelesai={(p) => {
            setTambah(false);
            if (p) {
              setList((l) => [...l, p]);
              setToast(`${p.nama} ditambahkan.`);
            }
          }}
        />
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setTambah(true)}>
            <Plus size={16} /> Tambah pegawai baru
          </Button>
        </div>
      )}
      <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama, NIP, atau jabatan…" leftIcon={<Search size={16} />} />
      {!tampil.length ? (
        <EmptyState title="Tidak ada pegawai yang cocok" description="Ubah kata kunci pencarian." />
      ) : (
        <ul className="flex flex-col gap-2">
          {tampil.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{p.nip ?? "NIP —"}</span> · {p.jabatan ?? "Jabatan —"} ·{" "}
                    <span className={p.status === "AKTIF" ? "text-success" : "text-destructive"}>{p.status}</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setBuka(buka === p.id ? null : p.id)}>
                  <Pencil size={14} /> {buka === p.id ? "Tutup" : "Ubah"}
                </Button>
              </div>
              {buka === p.id ? (
                <FormUbah
                  pegawai={p}
                  onSelesai={(baru) => {
                    setBuka(null);
                    setList((l) => l.map((x) => (x.id === baru.id ? baru : x)));
                    setToast(`${baru.nama} disimpan.`);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Toast title="Kelola Pegawai" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormTambah({ onSelesai }: { onSelesai: (p: PegawaiRecord | null) => void }) {
  const [f, setF] = useState({ nama: "", nip: "", jenisKepegawaian: "", jabatan: "" });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!f.nama.trim()) return setGalat("Nama wajib diisi");
    setSibuk(true);
    const res = await kirimJson<PegawaiRecord>("/api/pegawai", "POST", {
      nama: f.nama.trim(),
      nip: f.nip.trim() || undefined,
      jenisKepegawaian: f.jenisKepegawaian.trim() || undefined,
      jabatan: f.jabatan.trim() || undefined,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    onSelesai(res.data);
  }
  return (
    <form onSubmit={simpan} noValidate className="grid gap-3 rounded-2xl border border-primary/40 p-4 sm:grid-cols-2">
      <Input label="Nama lengkap" value={f.nama} onChange={set("nama")} maxLength={150} />
      <Input label="NIP (opsional)" value={f.nip} onChange={set("nip")} maxLength={30} inputMode="numeric" />
      <Input label="Jenis kepegawaian (opsional)" value={f.jenisKepegawaian} onChange={set("jenisKepegawaian")} maxLength={60} />
      <Input label="Jabatan (opsional)" value={f.jabatan} onChange={set("jabatan")} maxLength={200} />
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2" /> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Tambah"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onSelesai(null)}>
          Batal
        </Button>
      </div>
    </form>
  );
}

function FormUbah({ pegawai, onSelesai }: { pegawai: PegawaiRecord; onSelesai: (p: PegawaiRecord) => void }) {
  const [f, setF] = useState({
    nama: pegawai.nama,
    nip: pegawai.nip ?? "",
    jenisKelamin: pegawai.jenisKelamin ?? "",
    jenisKepegawaian: pegawai.jenisKepegawaian ?? "",
    pangkat: pegawai.pangkat ?? "",
    golRuang: pegawai.golRuang ?? "",
    jabatan: pegawai.jabatan ?? "",
    jenisJabatan: pegawai.jenisJabatan ?? "",
    tingkatPendidikan: pegawai.tingkatPendidikan ?? "",
    jurusan: pegawai.jurusan ?? "",
    namaUniversitas: pegawai.namaUniversitas ?? "",
    status: pegawai.status,
  });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const pilihanStatus = (STATUS_PEGAWAI_BAKU as readonly string[]).includes(pegawai.status) ? STATUS_PEGAWAI_BAKU : [...STATUS_PEGAWAI_BAKU, pegawai.status];
  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const n = (v: string) => v.trim() || null;
    const res = await kirimJson<PegawaiRecord>(`/api/pegawai/${encodeURIComponent(pegawai.id)}`, "PATCH", {
      nama: f.nama.trim(),
      nip: n(f.nip),
      jenisKelamin: n(f.jenisKelamin),
      jenisKepegawaian: n(f.jenisKepegawaian),
      pangkat: n(f.pangkat),
      golRuang: n(f.golRuang),
      jabatan: n(f.jabatan),
      jenisJabatan: n(f.jenisJabatan),
      tingkatPendidikan: n(f.tingkatPendidikan),
      jurusan: n(f.jurusan),
      namaUniversitas: n(f.namaUniversitas),
      status: f.status,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    onSelesai(res.data);
  }
  return (
    <form onSubmit={simpan} noValidate className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3">
      <Input label="Nama" value={f.nama} onChange={set("nama")} maxLength={150} />
      <Input label="NIP" value={f.nip} onChange={set("nip")} maxLength={30} inputMode="numeric" />
      <Select
        label="Jenis kelamin"
        value={f.jenisKelamin || KOSONG}
        onValueChange={(v) => set("jenisKelamin")(v === KOSONG ? "" : v)}
        options={[
          { value: KOSONG, label: "—" },
          { value: "Laki-laki", label: "Laki-laki" },
          { value: "Perempuan", label: "Perempuan" },
        ]}
      />
      <Input label="Jenis kepegawaian" value={f.jenisKepegawaian} onChange={set("jenisKepegawaian")} maxLength={60} />
      <Input label="Pangkat" value={f.pangkat} onChange={set("pangkat")} maxLength={60} />
      <Input label="Gol/ruang" value={f.golRuang} onChange={set("golRuang")} maxLength={10} />
      <Input label="Jabatan" value={f.jabatan} onChange={set("jabatan")} maxLength={200} />
      <Input label="Jenis jabatan" value={f.jenisJabatan} onChange={set("jenisJabatan")} maxLength={60} />
      <Input label="Tingkat pendidikan" value={f.tingkatPendidikan} onChange={set("tingkatPendidikan")} maxLength={30} />
      <Input label="Jurusan" value={f.jurusan} onChange={set("jurusan")} maxLength={150} />
      <Input label="Universitas" value={f.namaUniversitas} onChange={set("namaUniversitas")} maxLength={150} />
      <Select label="Status" value={f.status} onValueChange={set("status")} options={pilihanStatus.map((s) => ({ value: s, label: s }))} />
      {statusMenutupAkun(f.status) && !statusMenutupAkun(pegawai.status) ? (
        <Alert tone="warning" title={`Status ${f.status}: akun login pegawai ini dinonaktifkan dan Plt/Plh-nya dicabut saat disimpan.`} className="sm:col-span-2 lg:col-span-3" />
      ) : null}
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2 lg:col-span-3" /> : null}
      <div className={cn("sm:col-span-2 lg:col-span-3")}>
        <Button type="submit" size="sm" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
