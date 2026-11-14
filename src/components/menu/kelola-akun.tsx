"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Search, UsersRound, AlertCircle, Plus, X } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { roleProfiles } from "@/lib/roles";
import { statusMenutupAkun } from "@/lib/plt";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";

type Akun = {
  id: string;
  email: string;
  name: string;
  role: string;
  aktif: boolean;
  wajibGantiSandi: boolean;
  pegawaiId: string | null;
  nip: string | null;
  jabatan: string | null;
  statusPegawai: string | null;
  menungguRegistrasi: boolean;
  updatedAt: string;
};
type PegawaiTanpaAkun = { id: string; nama: string; nip: string | null; jabatan: string | null };
type Data = { akun: Akun[]; pegawaiTanpaAkun: PegawaiTanpaAkun[] };
type Catatan = {
  id: string;
  nama: string;
  login: string;
  role: string;
  aktif: boolean;
  sandi: string | null;
  keadaan: "ADA" | "TIDAK_TERBACA" | "BELUM_TERCATAT";
  sejak: string | null;
};
type HasilNip = { diperiksa: number; cocok: number; berikutnya: string | null };
type Saring = "semua" | "aktif" | "nonaktif" | "sementara" | "periksa";

// Akun "peserta" juga dipakai pegawai biasa (tanpa peran khusus), bukan hanya peserta diklat.
const PERAN = roleProfiles.map((p) => ({ value: p.id, label: p.id === "peserta" ? "Pegawai umum / peserta" : p.label }));
const labelPeran = (r: string) => PERAN.find((p) => p.value === r)?.label ?? r;
const perluPeriksa = (a: Akun) => a.aktif && statusMenutupAkun(a.statusPegawai);
const tanggalPendek = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const selCsv = (t: string) => (/[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);

/**
 * Kelola Akun (admin), sama dengan aplikasi lama: buat akun, aktif/nonaktif, reset kata sandi sementara, ubah peran, catatan
 * sandi awal (EB-040), dan penggantian sandi yang masih = NIP. Semua tindakan tercatat di Log Audit (server).
 */
export function KelolaAkun({ emailSaya }: { emailSaya: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [pesan, setPesan] = useState("");
  const [sandi, setSandi] = useState<{ untuk: string; sandi: string } | null>(null);
  const [bukaBuat, setBukaBuat] = useState(false);
  const [bukaCatatan, setBukaCatatan] = useState(false);

  const muat = useCallback(async () => {
    const r = await ambilJson<Data>("/api/admin/akun");
    if (r.ok) {
      setData(r.data);
      setGalatMuat("");
    } else setGalatMuat(r.error);
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  const tampil = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    return data.akun.filter((a) => {
      if (saring === "aktif" && !a.aktif) return false;
      if (saring === "nonaktif" && a.aktif) return false;
      if (saring === "sementara" && !a.wajibGantiSandi) return false;
      if (saring === "periksa" && !perluPeriksa(a)) return false;
      return !q || [a.name, a.email, a.nip ?? "", a.jabatan ?? "", labelPeran(a.role)].some((v) => v.toLowerCase().includes(q));
    });
  }, [data, cari, saring]);
  const jumlahPeriksa = data ? data.akun.filter(perluPeriksa).length : 0;
  const jumlahAktif = data ? data.akun.filter((a) => a.aktif).length : 0;

  async function aksi(a: Akun, body: Record<string, unknown>, tanya?: string) {
    if (tanya && !confirm(tanya)) return;
    setSibuk(a.id);
    setPesan("");
    const r = await kirimJson<{ sandiSementara?: string }>(`/api/admin/akun/${encodeURIComponent(a.id)}`, "PATCH", body);
    setSibuk(null);
    if (!r.ok) setPesan(r.error);
    else if (r.data.sandiSementara) setSandi({ untuk: a.name, sandi: r.data.sandiSementara });
    await muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-expanded={bukaCatatan} onClick={() => setBukaCatatan(!bukaCatatan)}>
          {bukaCatatan ? "Tutup catatan sandi" : "Catatan sandi awal"}
        </Button>
        <Button variant={bukaBuat ? "secondary" : "primary"} aria-expanded={bukaBuat} onClick={() => setBukaBuat(!bukaBuat)}>
          {bukaBuat ? <X size={16} /> : <Plus size={16} />} {bukaBuat ? "Tutup form" : "Buat akun"}
        </Button>
      </div>

      {sandi ? <KotakSandi sandi={sandi} onTutup={() => setSandi(null)} /> : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Ringkasan akun">
        <Angka ikon={<UsersRound size={22} />} nilai={data?.akun.length} label="Total akun" />
        <Angka ikon={<CheckCircle2 size={22} />} nilai={data ? jumlahAktif : undefined} label="Aktif" />
        <button type="button" className="text-left" onClick={() => setSaring("periksa")}>
          <Angka ikon={<AlertCircle size={22} />} nilai={data ? jumlahPeriksa : undefined} label="Perlu ditinjau" peringatan={jumlahPeriksa > 0} />
        </button>
      </section>

      {bukaBuat && data ? (
        <FormBuat
          pegawai={data.pegawaiTanpaAkun}
          onDibuat={async (untuk, s) => {
            setSandi({ untuk, sandi: s });
            setBukaBuat(false);
            await muat();
          }}
        />
      ) : null}

      {bukaCatatan ? <PanelCatatan onBerubah={muat} /> : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
          <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama, NIP, email, jabatan, peran…" leftIcon={<Search size={16} />} />
          <Select
            label="Saring"
            value={saring}
            onValueChange={(v) => setSaring(v as Saring)}
            options={[
              { value: "semua", label: `Semua (${data?.akun.length ?? 0})` },
              { value: "aktif", label: "Aktif" },
              { value: "nonaktif", label: "Nonaktif" },
              { value: "sementara", label: "Kata sandi sementara" },
              { value: "periksa", label: `Perlu diperiksa (${jumlahPeriksa})` },
            ]}
          />
        </div>
        {jumlahPeriksa > 0 ? (
          <p className="text-xs text-warning">
            <span className="font-mono">{jumlahPeriksa}</span> akun masih aktif padahal status pegawainya pindah/pensiun/berhenti/nonaktif. Nonaktifkan bila sudah tidak bekerja di
            balai.
          </p>
        ) : null}
        {pesan ? <Alert tone="danger" title={pesan} /> : null}
        {galatMuat ? (
          <Alert tone="danger" title={galatMuat} />
        ) : !data ? (
          <p className="text-sm text-muted-foreground" role="status">
            Memuat…
          </p>
        ) : !tampil.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada akun yang cocok.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tampil.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5",
                  perluPeriksa(a) ? "border-warning" : "border-border",
                  !a.aktif && "opacity-65",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{a.name}</span>
                    {a.menungguRegistrasi ? (
                      <Badge size="sm" tone="warning">
                        Menunggu registrasi
                      </Badge>
                    ) : !a.aktif ? (
                      <Badge size="sm" tone="danger">
                        Nonaktif
                      </Badge>
                    ) : null}
                    {a.wajibGantiSandi ? (
                      <Badge size="sm" tone="warning">
                        Sandi sementara
                      </Badge>
                    ) : null}
                    {a.email === emailSaya ? <span className="text-[11px] text-muted-foreground">(Anda)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.nip ? (
                      <>
                        NIP <span className="font-mono">{a.nip}</span>
                      </>
                    ) : (
                      a.email
                    )}
                    {a.jabatan ? ` · ${a.jabatan}` : ""}
                    {a.statusPegawai && a.statusPegawai !== "AKTIF" ? (
                      <span className={statusMenutupAkun(a.statusPegawai) ? "text-destructive" : "text-warning"}> · {a.statusPegawai}</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Peran ${a.name}`}
                    value={a.role}
                    disabled={sibuk === a.id || !a.aktif}
                    onChange={(e) => {
                      const role = e.target.value;
                      aksi(a, { aksi: "peran", role }, `Ubah peran ${a.name} menjadi ${labelPeran(role)}? Sesi lamanya langsung berakhir.`);
                    }}
                    className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
                  >
                    {PERAN.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {a.aktif ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={sibuk === a.id}
                        onClick={() => aksi(a, { aksi: "reset-sandi" }, `Reset kata sandi ${a.name}? Kata sandi lamanya langsung tidak berlaku.`)}
                      >
                        Reset sandi
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={sibuk === a.id || a.email === emailSaya}
                        onClick={() => aksi(a, { aksi: "nonaktifkan" }, `Nonaktifkan akun ${a.name}? Ia langsung keluar dan tidak bisa masuk lagi.`)}
                      >
                        Nonaktifkan
                      </Button>
                    </>
                  ) : a.menungguRegistrasi ? (
                    <ButtonLink size="sm" variant="ghost" href="/dashboard/registrasi">
                      Periksa registrasi
                    </ButtonLink>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={sibuk === a.id} onClick={() => aksi(a, { aksi: "aktifkan" })}>
                      Aktifkan
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Angka({ ikon, nilai, label, peringatan }: { ikon: React.ReactNode; nilai: number | undefined; label: string; peringatan?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
      <span className="text-primary" aria-hidden>
        {ikon}
      </span>
      <span>
        <span className={cn("block font-display text-2xl font-medium leading-tight", peringatan && "text-warning")}>{nilai ?? "…"}</span>
        <span className="block text-sm text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function KotakSandi({ sandi, onTutup }: { sandi: { untuk: string; sandi: string }; onTutup: () => void }) {
  const [tersalin, setTersalin] = useState(false);
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-warning p-4">
      <p className="text-sm">
        Kata sandi sementara untuk <span className="font-medium">{sandi.untuk}</span>:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="select-all rounded-lg bg-muted px-3 py-1.5 font-mono text-base tracking-wider">{sandi.sandi}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(sandi.sandi);
              setTersalin(true);
            } catch {
              setTersalin(false);
            }
          }}
        >
          {tersalin ? "Tersalin" : "Salin"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onTutup}>
          Tutup
        </Button>
      </div>
      <p className="text-xs text-warning">
        Serahkan langsung ke pemiliknya (jangan lewat grup obrolan). Sampai diganti, kata sandi ini juga ada di Catatan sandi awal. Login memakai NIP (atau email untuk akun
        non-pegawai); pemiliknya wajib mengganti kata sandi saat pertama masuk.
      </p>
    </section>
  );
}

function FormBuat({ pegawai, onDibuat }: { pegawai: PegawaiTanpaAkun[]; onDibuat: (untuk: string, sandi: string) => void }) {
  const [mode, setMode] = useState<"pegawai" | "lain">("pegawai");
  const [cari, setCari] = useState("");
  const [pegawaiId, setPegawaiId] = useState("");
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [role, setRole] = useState("peserta");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const kandidat = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const l = (q ? pegawai.filter((p) => [p.nama, p.nip ?? "", p.jabatan ?? ""].some((v) => v.toLowerCase().includes(q))) : pegawai).slice(0, 50);
    const dipilih = pegawai.find((p) => p.id === pegawaiId);
    return dipilih && !l.includes(dipilih) ? [dipilih, ...l] : l;
  }, [cari, pegawai, pegawaiId]);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat("");
    if (mode === "pegawai" && !pegawaiId) return setGalat("Pilih pegawai dulu.");
    if (mode === "lain" && (!nama.trim() || !email.trim())) return setGalat("Nama dan email wajib diisi.");
    setSibuk(true);
    const body = mode === "pegawai" ? { pegawaiId, role, email: email.trim() || null } : { pegawaiId: null, role, email: email.trim(), nama: nama.trim() };
    const r = await kirimJson<{ id: string; sandiSementara: string }>("/api/admin/akun", "POST", body);
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    onDibuat(mode === "pegawai" ? (pegawai.find((p) => p.id === pegawaiId)?.nama ?? "akun baru") : nama.trim(), r.data.sandiSementara);
  }

  return (
    <form onSubmit={kirim} noValidate className="grid gap-3 rounded-2xl border border-primary/40 p-4 sm:grid-cols-2">
      <h2 className="font-display text-lg font-medium sm:col-span-2">Buat akun</h2>
      <div className="sm:col-span-2">
        <SegmentedControl
          label="Jenis akun"
          value={mode}
          onValueChange={(v) => setMode(v as "pegawai" | "lain")}
          options={[
            { value: "pegawai", label: `Pegawai balai (${pegawai.length} belum punya akun)` },
            { value: "lain", label: "Non-pegawai (login email)" },
          ]}
        />
      </div>
      {mode === "pegawai" ? (
        <>
          <Input label="Cari pegawai" value={cari} onChange={setCari} placeholder="Nama, NIP, atau jabatan…" leftIcon={<Search size={16} />} />
          <Select
            label="Pegawai"
            value={pegawaiId}
            onValueChange={setPegawaiId}
            placeholder={`Pilih pegawai (${kandidat.length}${kandidat.length >= 50 ? "+" : ""})…`}
            options={kandidat.map((p) => ({ value: p.id, label: `${p.nama} · ${p.nip ?? "tanpa NIP"}${p.jabatan ? ` · ${p.jabatan}` : ""}` }))}
          />
          <Input label="Email (opsional)" type="email" value={email} onChange={setEmail} />
        </>
      ) : (
        <>
          <Input label="Nama lengkap" value={nama} onChange={setNama} maxLength={150} />
          <Input label="Email untuk login" type="email" value={email} onChange={setEmail} />
        </>
      )}
      <Select label="Peran" value={role} onValueChange={setRole} options={PERAN} />
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-2" /> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Membuat…" : "Buat akun + kata sandi sementara"}
        </Button>
      </div>
    </form>
  );
}

function PanelCatatan({ onBerubah }: { onBerubah: () => Promise<void> }) {
  const [catatan, setCatatan] = useState<Catatan[] | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [nip, setNip] = useState<{ tahap: "periksa" | "ganti"; diperiksa: number; cocok: number; selesai: boolean } | null>(null);
  const [nipSibuk, setNipSibuk] = useState(false);
  const ringkas = useRef<HTMLParagraphElement>(null);
  const adaSandi = !!catatan?.some((c) => c.sandi);

  async function tampilkan() {
    if (!confirm("Tampilkan catatan sandi awal? Semua kata sandi sementara yang belum diganti akan tampil di layar. Pembukaan ini tercatat di Log Audit.")) return;
    setMemuat(true);
    setGalat("");
    const r = await ambilJson<Catatan[]>("/api/admin/akun/sandi-awal");
    setMemuat(false);
    if (r.ok) {
      setCatatan(r.data);
      requestAnimationFrame(() => ringkas.current?.focus());
    } else setGalat(r.error);
  }
  function unduh() {
    if (!catatan) return;
    const kepala = ["Nama", "Login", "Peran", "Kata sandi sementara", "Sejak"];
    const baris = catatan
      .filter((c) => c.sandi)
      // ="…" supaya Excel tidak mengubah NIP 18 angka menjadi angka ilmiah
      .map((c) => [c.nama, /^\d+$/.test(c.login) ? `="${c.login}"` : c.login, labelPeran(c.role), c.sandi ?? "", c.sejak ? tanggalPendek(c.sejak) : ""]);
    const csv = "﻿" + [kepala, ...baris].map((r) => r.map(selCsv).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Catatan sandi awal ${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function prosesNip(jalankan: boolean) {
    if (
      jalankan &&
      !confirm(
        `Ganti ${nip?.cocok ?? 0} kata sandi NIP ke sandi acak? Akun-akun ini langsung keluar dan tidak bisa lagi masuk dengan NIP. Kata sandi sementara barunya tampil di Catatan sandi awal.`,
      )
    )
      return;
    setNipSibuk(true);
    setGalat("");
    const tahap = jalankan ? "ganti" : "periksa";
    let setelah: string | null = null;
    let diperiksa = 0;
    let cocok = 0;
    setNip({ tahap, diperiksa, cocok, selesai: false });
    do {
      const r: Awaited<ReturnType<typeof kirimJson<HasilNip>>> = await kirimJson<HasilNip>("/api/admin/akun/sandi-nip", "POST", { setelah, jalankan });
      if (!r.ok) {
        setGalat(r.error);
        setNip(null);
        setNipSibuk(false);
        return;
      }
      diperiksa += r.data.diperiksa;
      cocok += r.data.cocok;
      setelah = r.data.berikutnya;
      setNip({ tahap, diperiksa, cocok, selesai: setelah === null });
    } while (setelah);
    setNipSibuk(false);
    if (jalankan) {
      setCatatan(null); // muat ulang lewat "Tampilkan catatan" supaya pembukaannya tercatat
      await onBerubah();
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4" aria-labelledby="judul-catatan-sandi" aria-busy={memuat || nipSibuk}>
      <h2 id="judul-catatan-sandi" className="font-display text-lg font-medium">
        Catatan sandi awal
      </h2>
      <p className="text-sm text-muted-foreground">
        Kata sandi sementara yang belum diganti pemiliknya, untuk diserahkan langsung (jangan lewat grup obrolan). Begitu pemiliknya mengganti kata sandi, catatannya terhapus
        otomatis. Kata sandi pilihan pemilik tidak pernah dicatat.
      </p>
      <div className="flex flex-wrap gap-2">
        {catatan ? (
          <>
            <Button size="sm" variant="secondary" disabled={!adaSandi} onClick={unduh}>
              Unduh CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCatatan(null)}>
              Sembunyikan catatan
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={memuat} onClick={tampilkan}>
            {memuat ? "Memuat…" : "Tampilkan catatan"}
          </Button>
        )}
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {catatan ? (
        <>
          <p ref={ringkas} tabIndex={-1} className="text-sm text-muted-foreground outline-none">
            {catatan.length === 0 ? "Tidak ada kata sandi sementara yang belum diganti." : `${catatan.length} akun belum mengganti kata sandi sementara.`}
          </p>
          {catatan.length ? (
            <ul className="flex flex-col gap-2">
              {catatan.map((c) => (
                <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-2", !c.aktif && "opacity-65")}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 break-words text-sm font-medium">
                      {c.nama}
                      {!c.aktif ? (
                        <Badge size="sm" tone="danger">
                          Nonaktif
                        </Badge>
                      ) : null}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      Login <span className="font-mono">{c.login}</span> · {labelPeran(c.role)}
                      {c.sejak ? (
                        <>
                          {" "}
                          · sejak <span className="font-mono">{tanggalPendek(c.sejak)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {c.sandi ? (
                    <code className="select-all rounded-lg bg-muted px-2 py-1 font-mono text-sm tracking-wider">{c.sandi}</code>
                  ) : (
                    <span className="text-xs text-warning">
                      {c.keadaan === "TIDAK_TERBACA" ? "Tidak terbaca (rahasia server berganti)" : "Dibuat sebelum ada catatan"}; reset sandinya untuk membuat yang baru
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Kata sandi yang masih sama dengan NIP</h3>
        <p className="text-xs text-muted-foreground">
          NIP tercantum di SK dan surat tugas, jadi mudah ditebak. Periksa dulu, lalu ganti ke kata sandi sementara acak. Akun yang diganti langsung keluar dan tidak bisa masuk
          dengan NIP; kata sandi barunya muncul di catatan di atas.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={nipSibuk} onClick={() => prosesNip(false)}>
            Periksa
          </Button>
          {nip?.tahap === "periksa" && nip.selesai && nip.cocok > 0 ? (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={nipSibuk} onClick={() => prosesNip(true)}>
              Ganti {nip.cocok} akun ke sandi acak
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground" role="status">
            {nip && !nip.selesai ? (
              <>
                {nip.tahap === "ganti" ? "Mengganti" : "Memeriksa"}… <span className="font-mono">{nip.diperiksa}</span> akun diperiksa
              </>
            ) : nip?.tahap === "periksa" ? (
              <>
                <span className="font-mono">{nip.diperiksa}</span> akun diperiksa: <span className="font-mono">{nip.cocok}</span> masih bersandi NIP.
              </>
            ) : nip ? (
              <>
                Selesai: <span className="font-mono">{nip.cocok}</span> akun diberi kata sandi sementara acak. Tampilkan catatan untuk menyerahkannya.
              </>
            ) : null}
          </span>
        </div>
      </div>
    </section>
  );
}
