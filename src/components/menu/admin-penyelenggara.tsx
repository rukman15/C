"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WEWENANG_PENYELENGGARA, labelWewenang } from "@/lib/wewenang-penyelenggara";
import { kirimJson } from "@/lib/api-klien";
import type { PilihanPegawaiRecord, WewenangRecord } from "@/lib/server/repositories/wewenang-penyelenggara";

type Data = { daftar: WewenangRecord[]; pilihanPegawai: PilihanPegawaiRecord[] };

/** Admin Penyelenggara (EB-034), sama dengan aplikasi lama: Super Admin menunjuk pegawai dan memilih wewenangnya; tercatat di Log Audit. */
export function AdminPenyelenggara({ awal }: { awal: Data }) {
  const [data, setData] = useState(awal);
  const [cari, setCari] = useState("");
  const [pegawaiId, setPegawaiId] = useState("");
  const [wewenang, setWewenang] = useState<string[]>([]);
  const [dasar, setDasar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const q = cari.trim().toLowerCase();
  const pilihan = (q ? data.pilihanPegawai.filter((p) => `${p.nama} ${p.nip ?? ""} ${p.jabatan ?? ""}`.toLowerCase().includes(q)) : data.pilihanPegawai).slice(0, 200);
  const terpilih = data.pilihanPegawai.find((p) => p.id === pegawaiId) ?? null;
  const sudah = data.daftar.find((d) => d.pegawaiId === pegawaiId) ?? null;

  function pilihPegawai(id: string) {
    setPegawaiId(id);
    const d = data.daftar.find((x) => x.pegawaiId === id);
    setWewenang(d ? [...d.wewenang] : []);
    setDasar(d?.dasar ?? "");
  }
  const kosongkan = () => {
    setPegawaiId("");
    setWewenang([]);
    setDasar("");
  };
  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!pegawaiId) return;
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<Data>("/api/admin/wewenang", "PUT", { pegawaiId, wewenang, dasar: dasar.trim() || null });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setData(r.data);
    setToast(`Wewenang ${terpilih?.nama ?? ""} disimpan.`);
    kosongkan();
  }
  async function cabut(d: WewenangRecord) {
    if (!window.confirm(`Cabut semua wewenang Admin Penyelenggara ${d.nama}? Riwayatnya tetap di Log Audit.`)) return;
    const r = await kirimJson<Data>(`/api/admin/wewenang?pegawaiId=${encodeURIComponent(d.pegawaiId)}`, "DELETE");
    if (!r.ok) return setGalat(r.error);
    setData(r.data);
    setToast(`Wewenang ${d.nama} dicabut.`);
  }

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <form id="form-wewenang" onSubmit={simpan} noValidate className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="font-display text-lg font-medium">{sudah ? "Ubah wewenang" : "Tunjuk Admin Penyelenggara"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <Input label="Cari pegawai" value={cari} onChange={setCari} placeholder="Nama, NIP, atau jabatan…" leftIcon={<Search size={16} />} />
          <Select
            label="Pegawai"
            placeholder="Pilih pegawai"
            value={pegawaiId || undefined}
            onValueChange={pilihPegawai}
            options={pilihan.map((p) => ({ value: p.id, label: p.jabatan ? `${p.nama} — ${p.jabatan}` : p.nama }))}
          />
        </div>
        {terpilih && !terpilih.punyaAkun ? (
          <Alert tone="warning" title={`${terpilih.nama} belum punya akun aktif. Wewenang tetap bisa disimpan, tetapi baru terpakai setelah akunnya dibuat di Kelola Akun.`} />
        ) : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted-foreground">Wewenang</legend>
          {WEWENANG_PENYELENGGARA.map((w) => (
            <label key={w.kode} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={wewenang.includes(w.kode)}
                onChange={(e) => setWewenang((x) => (e.target.checked ? [...x, w.kode] : x.filter((k) => k !== w.kode)))}
              />
              <span>
                <span className="block text-sm font-medium">{w.label}</span>
                <span className="block text-xs text-muted-foreground">{w.keterangan}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Input label="Dasar penunjukan (nomor SK atau nota dinas, boleh kosong)" value={dasar} onChange={setDasar} maxLength={200} />
        <p className="text-xs text-muted-foreground">
          Untuk mengelola jadwal diklat tertentu seperti Ketua Diklat, masukkan orangnya ke{" "}
          <Link href="/dashboard/tim-kerja" className="text-primary hover:underline">
            Tim Kerja
          </Link>{" "}
          berwenang &quot;Kelola diklat &amp; ajukan WI&quot;.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={sibuk || !pegawaiId || !wewenang.length}>
            {sibuk ? "Menyimpan…" : "Simpan wewenang"}
          </Button>
          {pegawaiId ? (
            <Button type="button" variant="ghost" onClick={kosongkan}>
              Batal
            </Button>
          ) : null}
        </div>
      </form>
      <section className="rounded-2xl border border-border p-4">
        <h2 className="mb-3 font-display text-lg font-medium">
          Yang sudah ditunjuk <span className="font-mono text-sm text-muted-foreground">({data.daftar.length})</span>
        </h2>
        {!data.daftar.length ? (
          <EmptyState title="Belum ada Admin Penyelenggara" description="Tunjuk pegawai di formulir di atas." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.daftar.map((d) => (
              <li key={d.pegawaiId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{d.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.jabatan ?? "—"}
                    {d.dasar ? ` · Dasar: ${d.dasar}` : ""}
                    {d.punyaAkun ? "" : " · belum punya akun"}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.wewenang.map((k) => (
                      <Badge key={k} size="sm" tone="info">
                        {labelWewenang(k)}
                      </Badge>
                    ))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      pilihPegawai(d.pegawaiId);
                      document.getElementById("form-wewenang")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Ubah
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cabut(d)}>
                    Cabut
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toast title="Admin Penyelenggara" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
