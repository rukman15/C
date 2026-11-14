"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { roleProfiles, type UserRole } from "@/lib/roles";
import { normalJabatan } from "@/lib/jabatanProfiles";
import { JENIS_SEMENTARA, LABEL_STATUS_SEMENTARA, PERAN_SEMENTARA, PERAN_SEMENTARA_KHUSUS_ADMIN, type StatusSementara } from "@/lib/plt";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import type { PenugasanSementaraRecord } from "@/lib/server/repositories/plt";

type Pegawai = { id: string; nama: string; nip: string | null; jabatan: string | null };

const khususAdmin = (r: string) => PERAN_SEMENTARA_KHUSUS_ADMIN.includes(r as UserRole);
const labelPeran = (r: string) => roleProfiles.find((p) => p.id === r)?.label ?? r;
const NADA: Record<StatusSementara, BadgeTone> = { BERLAKU: "success", AKAN_DATANG: "info", SELESAI: "neutral", DICABUT: "danger" };
const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Jabatan struktural resmi (Permendagri 11/2025) dengan peran aplikasi yang lazim. */
const JABATAN_STRUKTURAL: { jabatan: string; role: string }[] = [
  { jabatan: "Kepala Balai Besar Pengembangan Kompetensi Aparatur Pemerintahan Dalam Negeri II", role: "kepala-balai" },
  { jabatan: "Kepala Bagian Tata Usaha", role: "kabag-tu" },
  { jabatan: "Kepala Subbagian Sumber Daya Manusia dan Umum", role: "kepegawaian" },
  { jabatan: "Kepala Subbagian Program, Data, Pelaporan dan Keuangan", role: "keuangan" },
];

/**
 * Plt / Plh (admin dan kepegawaian), sama dengan aplikasi lama. Pemegangnya memilih sendiri kapan "bertindak sebagai" Plt/Plh;
 * haknya berakhir otomatis pada tanggal selesai. Peran pimpinan dan keuangan hanya bisa ditetapkan Administrator.
 */
export function Plt({ awal, pegawai, isAdmin, hariIni }: { awal: PenugasanSementaraRecord[]; pegawai: Pegawai[]; isAdmin: boolean; hariIni: string }) {
  const [list, setList] = useState(awal);
  const [cari, setCari] = useState("");
  const [f, setF] = useState({ pegawaiId: "", jenis: "PLT", jabatan: "", role: "kabag-tu", nomorSk: "", mulai: hariIni, selesai: "" });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const kandidat = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const l = q ? pegawai.filter((p) => [p.nama, p.nip ?? "", p.jabatan ?? ""].some((v) => v.toLowerCase().includes(q))) : pegawai;
    const hasil = l.slice(0, 50);
    const terpilih = pegawai.find((p) => p.id === f.pegawaiId);
    return terpilih && !hasil.includes(terpilih) ? [terpilih, ...hasil] : hasil;
  }, [cari, pegawai, f.pegawaiId]);

  function ubahJabatan(v: string) {
    const cocok = JABATAN_STRUKTURAL.find((j) => normalJabatan(j.jabatan) === normalJabatan(v));
    setF((x) => ({ ...x, jabatan: v, role: cocok ? cocok.role : x.role }));
  }
  async function muat() {
    const r = await ambilJson<PenugasanSementaraRecord[]>("/api/penugasan-sementara");
    if (r.ok) setList(r.data);
  }
  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!f.pegawaiId || !f.jabatan.trim() || !f.nomorSk.trim() || !f.mulai || !f.selesai) return setGalat("Lengkapi pegawai, jabatan, nomor SK, dan tanggal.");
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<{ id: string }>("/api/penugasan-sementara", "POST", { ...f, jabatan: f.jabatan.trim(), nomorSk: f.nomorSk.trim() });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setToast('Penugasan disimpan. Pemegangnya akan melihat pilihan "Bertindak sebagai" saat masuk.');
    setF((x) => ({ ...x, pegawaiId: "", nomorSk: "", selesai: "" }));
    setCari("");
    await muat();
  }
  async function cabut(p: PenugasanSementaraRecord) {
    if (!confirm(`Cabut ${p.sebagai} dari ${p.nama}? Haknya langsung berakhir.`)) return;
    const res = await kirimJson(`/api/penugasan-sementara/${encodeURIComponent(p.id)}`, "DELETE");
    if (!res.ok) setToast(res.error);
    await muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Penugasan sementara berdasarkan SK: <strong className="font-medium">Plt</strong> bila jabatan kosong (pejabat pindah/promosi), <strong className="font-medium">Plh</strong>{" "}
        bila pejabat berhalangan sementara. Jabatan asli di Data Pegawai tidak berubah; hak aksesnya berakhir otomatis pada tanggal selesai.
      </p>
      <form onSubmit={simpan} noValidate className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <h2 className="font-display text-lg font-medium sm:col-span-2">Tetapkan Plt / Plh</h2>
        <Input label="Cari pegawai" value={cari} onChange={setCari} placeholder="Nama, NIP, atau jabatan…" leftIcon={<Search size={16} />} />
        <Select
          label="Pegawai"
          value={f.pegawaiId}
          onValueChange={set("pegawaiId")}
          placeholder="Pilih pegawai…"
          options={kandidat.map((p) => ({ value: p.id, label: `${p.nama} · ${p.jabatan ?? "-"}` }))}
        />
        <Select
          label="Jenis"
          value={f.jenis}
          onValueChange={set("jenis")}
          options={JENIS_SEMENTARA.map((j) => ({ value: j, label: j === "PLT" ? "Plt. (Pelaksana Tugas)" : "Plh. (Pelaksana Harian)" }))}
        />
        <Input label="Jabatan yang dirangkap" value={f.jabatan} onChange={ubahJabatan} list="jabatan-struktural" maxLength={200} />
        <datalist id="jabatan-struktural">
          {JABATAN_STRUKTURAL.map((j) => (
            <option key={j.jabatan} value={j.jabatan} />
          ))}
        </datalist>
        <div className="flex flex-col gap-1">
          <Select
            label="Peran di aplikasi selama penugasan"
            value={f.role}
            onValueChange={set("role")}
            options={PERAN_SEMENTARA.map((r) => ({
              value: r,
              label: `${labelPeran(r)}${!isAdmin && khususAdmin(r) ? " (oleh Admin)" : ""}`,
              disabled: !isAdmin && khususAdmin(r),
            }))}
          />
          {!isAdmin && khususAdmin(f.role) ? <span className="text-xs text-warning">Plt/Plh dengan peran ini ditetapkan Administrator.</span> : null}
        </div>
        <Input label="Nomor SK" value={f.nomorSk} onChange={set("nomorSk")} placeholder="mis. 800.1.3.3/123/BBPKA-II" maxLength={100} />
        <Input label="Mulai" type="date" value={f.mulai} onChange={set("mulai")} />
        <Input label="Selesai" type="date" value={f.selesai} onChange={set("selesai")} min={f.mulai} />
        {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2" /> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan penugasan"}
          </Button>
        </div>
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-medium">Daftar penugasan</h2>
        {!list.length ? (
          <EmptyState title="Belum ada Plt/Plh" description="Penugasan yang ditetapkan tampil di sini." />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((p) => {
              const aktif = p.status === "BERLAKU" || p.status === "AKAN_DATANG";
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {p.sebagai}
                      <Badge size="sm" tone={NADA[p.status]}>
                        {LABEL_STATUS_SEMENTARA[p.status]}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.nama}
                      {p.jabatanAsli ? ` (${p.jabatanAsli})` : ""} · {tgl(p.mulai)} s.d. {tgl(p.selesai)} · SK <span className="font-mono">{p.nomorSk}</span> · peran{" "}
                      {labelPeran(p.role)}
                    </p>
                    {!p.punyaAkunAktif && aktif ? <p className="text-xs text-warning">Pegawai ini tidak punya akun aktif.</p> : null}
                  </div>
                  {aktif && (isAdmin || !khususAdmin(p.role)) ? (
                    <Button size="sm" variant="ghost" onClick={() => cabut(p)}>
                      Cabut
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Toast title="Plt / Plh" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
