"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WEWENANG_DIKENAL } from "@/lib/tim-kerja";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import type { PegawaiRecord, TimKerjaRecord } from "@/lib/server/types";

type Peran = "ketua" | "anggota";
const PILIHAN_PERAN = [
  { value: "anggota", label: "Anggota" },
  { value: "ketua", label: "Ketua" },
];
const labelWewenang = (k: string) => WEWENANG_DIKENAL.find((w) => w.kode === k)?.label ?? k;

/**
 * Tim Kerja (admin), sama dengan aplikasi lama: buat tim, ubah nama/deskripsi/wewenang, hapus tim, kelola anggota (ketua /
 * anggota). Wewenang tetap daftar kode bebas; kode yang dikenali aplikasi ditampilkan sebagai kotak centang.
 */
export function TimKerja({ awal, pegawai }: { awal: TimKerjaRecord[]; pegawai: Pick<PegawaiRecord, "id" | "nama" | "jabatan">[] }) {
  const [list, setList] = useState(awal);
  const [buat, setBuat] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ganti = (t: TimKerjaRecord) => setList((l) => l.map((x) => (x.id === t.id ? t : x)));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Tim kerja pemegang diklat. Anggota tim dengan wewenang <span className="font-mono">{WEWENANG_DIKENAL[0]?.kode}</span> boleh mengelola jadwal diklat milik timnya dan
        mengajukan WI.
      </p>
      {buat ? (
        <FormTim
          judul="Tim baru"
          onBatal={() => setBuat(false)}
          onKirim={async (isi) => {
            const res = await kirimJson<TimKerjaRecord>("/api/tim-kerja", "POST", isi);
            if (!res.ok) return res.error;
            setList((l) => [...l, res.data]);
            setBuat(false);
            setToast(`Tim ${res.data.nama} dibuat.`);
            return null;
          }}
        />
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setBuat(true)}>
            <Plus size={16} /> Buat tim
          </Button>
        </div>
      )}
      {!list.length ? (
        <EmptyState title="Belum ada tim kerja" description="Buat tim pertama." />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((t) => (
            <KartuTim
              key={t.id}
              tim={t}
              pegawai={pegawai}
              onGanti={ganti}
              onHapus={() => {
                setList((l) => l.filter((x) => x.id !== t.id));
                setToast(`Tim ${t.nama} dihapus.`);
              }}
              onPesan={setToast}
            />
          ))}
        </ul>
      )}
      <Toast title="Tim Kerja" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

type IsiTim = { nama: string; deskripsi?: string; wewenang: string[] };

function FormTim({ judul, awal, onKirim, onBatal }: { judul: string; awal?: TimKerjaRecord; onKirim: (isi: IsiTim) => Promise<string | null>; onBatal: () => void }) {
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [deskripsi, setDeskripsi] = useState(awal?.deskripsi ?? "");
  const [wewenang, setWewenang] = useState<string[]>(awal?.wewenang ?? []);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const lain = wewenang.filter((w) => !WEWENANG_DIKENAL.some((d) => d.kode === w));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return setGalat("Nama tim wajib diisi");
    setSibuk(true);
    setGalat("");
    const g = await onKirim({ nama: nama.trim(), deskripsi: deskripsi.trim() || undefined, wewenang });
    setSibuk(false);
    if (g) setGalat(g);
  }
  return (
    <form onSubmit={kirim} noValidate className="grid gap-3 rounded-2xl border border-primary/40 p-4 sm:grid-cols-2">
      <h2 className="font-display text-base font-medium sm:col-span-2">{judul}</h2>
      <Input label="Nama tim" value={nama} onChange={setNama} maxLength={120} />
      <Input label="Deskripsi (opsional)" value={deskripsi} onChange={setDeskripsi} maxLength={300} />
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Wewenang</legend>
        {WEWENANG_DIKENAL.map((w) => (
          <label key={w.kode} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={wewenang.includes(w.kode)}
              onChange={(e) => setWewenang((l) => (e.target.checked ? [...l, w.kode] : l.filter((x) => x !== w.kode)))}
            />
            <span>
              {w.label} <span className="font-mono text-xs text-muted-foreground">({w.kode})</span>
              <span className="block text-xs text-muted-foreground">{w.keterangan}</span>
            </span>
          </label>
        ))}
        {lain.length ? (
          <p className="text-xs text-muted-foreground">
            Kode lain yang tersimpan (tidak dipakai aplikasi): <span className="font-mono">{lain.join(", ")}</span>
          </p>
        ) : null}
      </fieldset>
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2" /> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
      </div>
    </form>
  );
}

function KartuTim({
  tim,
  pegawai,
  onGanti,
  onHapus,
  onPesan,
}: {
  tim: TimKerjaRecord;
  pegawai: Pick<PegawaiRecord, "id" | "nama" | "jabatan">[];
  onGanti: (t: TimKerjaRecord) => void;
  onHapus: () => void;
  onPesan: (s: string) => void;
}) {
  const [ubah, setUbah] = useState(false);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pilih, setPilih] = useState("");
  const [peranBaru, setPeranBaru] = useState<Peran>("anggota");
  const url = `/api/tim-kerja/${encodeURIComponent(tim.id)}`;
  const calon = pegawai.filter((p) => !tim.anggota.some((a) => a.pegawaiId === p.id));

  async function jalankan(fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, setelah: (d: unknown) => void) {
    setSibuk(true);
    setGalat("");
    const res = await fn();
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setelah(res.data);
  }
  const muatUlang = () =>
    jalankan(
      () => ambilJson<TimKerjaRecord[]>("/api/tim-kerja"),
      (d) => {
        const t = (d as TimKerjaRecord[]).find((x) => x.id === tim.id);
        if (t) onGanti(t);
      },
    );

  if (ubah)
    return (
      <li>
        <FormTim
          judul={`Ubah ${tim.nama}`}
          awal={tim}
          onBatal={() => setUbah(false)}
          onKirim={async (isi) => {
            const res = await kirimJson<TimKerjaRecord>(url, "PATCH", { ...isi, deskripsi: isi.deskripsi ?? "" });
            if (!res.ok) return res.error;
            onGanti(res.data);
            setUbah(false);
            onPesan(`Tim ${res.data.nama} disimpan.`);
            return null;
          }}
        />
      </li>
    );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-medium">{tim.nama}</h2>
          {tim.deskripsi ? <p className="text-sm text-muted-foreground">{tim.deskripsi}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {tim.wewenang.length ? (
              tim.wewenang.map((w) => (
                <Badge key={w} size="sm" tone="info">
                  {labelWewenang(w)}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Tanpa wewenang</span>
            )}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setUbah(true)}>
          <Pencil size={14} /> Ubah
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={sibuk}
          onClick={() => {
            if (!confirm(`Hapus tim ${tim.nama}? Diklat milik tim ini kehilangan pemegangnya.`)) return;
            jalankan(() => kirimJson(url, "DELETE"), onHapus);
          }}
        >
          <Trash2 size={14} /> Hapus
        </Button>
      </div>
      {tim.anggota.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {tim.anggota.map((a) => (
            <li key={a.pegawaiId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.pegawaiNama}</p>
                {a.pegawaiJabatan ? <p className="text-xs text-muted-foreground">{a.pegawaiJabatan}</p> : null}
              </div>
              <select
                aria-label={`Peran ${a.pegawaiNama}`}
                value={a.peran}
                disabled={sibuk}
                onChange={(e) => jalankan(() => kirimJson(`${url}/anggota/${encodeURIComponent(a.pegawaiId)}`, "PATCH", { peran: e.target.value }), muatUlang)}
                className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
              >
                {PILIHAN_PERAN.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                disabled={sibuk}
                aria-label={`Keluarkan ${a.pegawaiNama}`}
                onClick={() => {
                  if (!confirm(`Keluarkan ${a.pegawaiNama} dari ${tim.nama}?`)) return;
                  jalankan(() => kirimJson(`${url}/anggota/${encodeURIComponent(a.pegawaiId)}`, "DELETE"), muatUlang);
                }}
              >
                <UserMinus size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada anggota.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <Select
            label="Tambah anggota"
            value={pilih}
            onValueChange={setPilih}
            placeholder="Pilih pegawai…"
            options={calon.map((p) => ({ value: p.id, label: p.jabatan ? `${p.nama} · ${p.jabatan}` : p.nama }))}
          />
        </div>
        <div className="w-36">
          <Select label="Peran" value={peranBaru} onValueChange={(v) => setPeranBaru(v as Peran)} options={PILIHAN_PERAN} />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={sibuk || !pilih}
          onClick={() =>
            jalankan(
              () => kirimJson(`${url}/anggota`, "POST", { pegawaiId: pilih, peran: peranBaru }),
              () => {
                setPilih("");
                muatUlang();
              },
            )
          }
        >
          Tambah
        </Button>
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
    </li>
  );
}
