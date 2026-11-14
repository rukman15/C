"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert } from "@/components/arc/alert/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PANJANG_SANDI_MIN } from "@/lib/akun";
import { WILAYAH } from "@/lib/wilayah-data";
import { GOLONGAN, periksaRegistrasi, type IsianRegistrasi, type KolomRegistrasi } from "@/lib/registrasi";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";

const KOSONG: IsianRegistrasi = {
  username: "",
  password: "",
  email: "",
  email2: "",
  namaDepan: "",
  namaBelakang: "",
  kodeProvinsi: "",
  kodeKabKota: "",
  nip: "",
  instansi: "",
  unitOrganisasi: "",
  unitKerja: "",
  golongan: "",
  jabatan: "",
  telepon: "",
  ponsel: "",
  alamat: "",
  setuju: false,
};
const ISIAN = "h-11 w-full rounded-full border bg-transparent px-4 text-sm font-normal outline-none focus:border-border-strong disabled:opacity-60";

/**
 * Registrasi mandiri peserta diklat (publik), sama dengan aplikasi lama. Akun dibuat nonaktif dan baru bisa dipakai setelah
 * disetujui admin/Ketua Diklat. Aturan isian: src/lib/registrasi.ts (server memeriksa ulang).
 */
export function FormRegistrasi() {
  const [f, setF] = useState<IsianRegistrasi>(KOSONG);
  const [dicoba, setDicoba] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [terkirim, setTerkirim] = useState(false);
  const salah = periksaRegistrasi(f);
  const tampil = (k: KolomRegistrasi) => (dicoba ? salah[k] : undefined);
  const kabKota = WILAYAH.find((w) => w.kode === f.kodeProvinsi)?.kab ?? [];
  const set = <K extends KolomRegistrasi>(k: K, v: IsianRegistrasi[K]) => setF((x) => ({ ...x, [k]: v }));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setDicoba(true);
    setGalat("");
    const kunci = Object.keys(salah);
    if (kunci.length) {
      setGalat("Periksa kembali kolom yang ditandai.");
      document.querySelector<HTMLElement>(`[name="${kunci[0]}"]`)?.focus();
      return;
    }
    setSibuk(true);
    const r = await kirimJson<{ status: string }>("/api/auth/daftar", "POST", f);
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setTerkirim(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (terkirim)
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-medium">Pendaftaran terkirim</h2>
        <p className="text-sm text-muted-foreground">
          Terima kasih, {f.namaDepan}. Data Anda sedang diperiksa penyelenggara. Setelah disetujui, masuk dengan nama pengguna{" "}
          <span className="font-mono text-foreground">{f.username.trim().toLowerCase()}</span> atau NIP Anda, beserta kata sandi yang baru Anda buat.
        </p>
        <p className="text-sm text-muted-foreground">Bila sampai jadwal diklat akun belum aktif, hubungi panitia penyelenggara.</p>
        <div>
          <ButtonLink href="/login">Ke halaman masuk</ButtonLink>
        </div>
      </div>
    );

  const kelas = (k: KolomRegistrasi) => cn(ISIAN, tampil(k) ? "border-destructive" : "border-border");
  const teks = (k: Exclude<KolomRegistrasi, "setuju">, o: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input name={k} value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!tampil(k)} className={kelas(k)} {...o} />
  );

  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-8">
      <p className="text-xs text-muted-foreground">
        Kolom bertanda <span className="text-destructive">*</span> wajib diisi.
      </p>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-base font-medium">Akun</legend>
        <Kolom pesan={tampil} k="username" label="Nama pengguna" wajib bantuan="Huruf kecil/angka, diawali huruf. Mis. budi.santoso">
          {teks("username", { autoComplete: "username", autoCapitalize: "none", spellCheck: false, maxLength: 30 })}
        </Kolom>
        <Kolom pesan={tampil} k="password" label="Kata sandi" wajib bantuan={`Minimal ${PANJANG_SANDI_MIN} karakter, bukan NIP.`}>
          {teks("password", { type: "password", autoComplete: "new-password" })}
        </Kolom>
        <Kolom pesan={tampil} k="email" label="Alamat surel" wajib>
          {teks("email", { type: "email", autoComplete: "email" })}
        </Kolom>
        <Kolom pesan={tampil} k="email2" label="Surel (lagi)" wajib>
          {teks("email2", { type: "email", autoComplete: "email" })}
        </Kolom>
        <Kolom pesan={tampil} k="namaDepan" label="Nama depan" wajib>
          {teks("namaDepan", { autoComplete: "given-name" })}
        </Kolom>
        <Kolom pesan={tampil} k="namaBelakang" label="Nama akhir" bantuan="Kosongkan bila nama Anda satu kata. Tanpa gelar.">
          {teks("namaBelakang", { autoComplete: "family-name" })}
        </Kolom>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-base font-medium">Data wilayah</legend>
        <Kolom pesan={tampil} k="kodeProvinsi" label="Provinsi" wajib>
          <select
            name="kodeProvinsi"
            value={f.kodeProvinsi}
            onChange={(e) => setF((x) => ({ ...x, kodeProvinsi: e.target.value, kodeKabKota: "" }))}
            className={kelas("kodeProvinsi")}
          >
            <option value="">Pilih Provinsi</option>
            {WILAYAH.map((w) => (
              <option key={w.kode} value={w.kode}>
                {w.nama}
              </option>
            ))}
          </select>
        </Kolom>
        <Kolom pesan={tampil} k="kodeKabKota" label="Kabupaten/Kota" wajib>
          <select name="kodeKabKota" value={f.kodeKabKota} disabled={!f.kodeProvinsi} onChange={(e) => set("kodeKabKota", e.target.value)} className={kelas("kodeKabKota")}>
            <option value="">{f.kodeProvinsi ? "Pilih Kabupaten/Kota" : "Pilih Provinsi dahulu"}</option>
            {kabKota.map(([kode, nama]) => (
              <option key={kode} value={kode}>
                {nama}
              </option>
            ))}
          </select>
        </Kolom>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-base font-medium">Data kepegawaian</legend>
        <Kolom pesan={tampil} k="nip" label="NIP" wajib>
          {teks("nip", { inputMode: "numeric", maxLength: 21, placeholder: "18 angka", className: cn(kelas("nip"), "font-mono") })}
        </Kolom>
        <Kolom pesan={tampil} k="golongan" label="Pangkat/Golongan Ruang" wajib>
          <select name="golongan" value={f.golongan} onChange={(e) => set("golongan", e.target.value)} className={kelas("golongan")}>
            <option value="">Pilih Pangkat/Golongan</option>
            {GOLONGAN.map((g) => (
              <option key={g.kode} value={g.kode}>
                {g.pangkat} ({g.kode})
              </option>
            ))}
          </select>
        </Kolom>
        <Kolom pesan={tampil} k="instansi" label="Instansi" wajib lebar>
          {teks("instansi", { placeholder: "Mis. Pemerintah Kabupaten Sumedang", autoComplete: "organization" })}
        </Kolom>
        <Kolom pesan={tampil} k="unitOrganisasi" label="OPD / Unit Organisasi" wajib>
          {teks("unitOrganisasi", { placeholder: "Mis. Badan Kepegawaian dan PSDM" })}
        </Kolom>
        <Kolom pesan={tampil} k="unitKerja" label="Unit Kerja">
          {teks("unitKerja", { placeholder: "Mis. Bidang Pengembangan Kompetensi" })}
        </Kolom>
        <Kolom pesan={tampil} k="jabatan" label="Jabatan" wajib lebar>
          {teks("jabatan", { autoComplete: "organization-title" })}
        </Kolom>
        <Kolom pesan={tampil} k="telepon" label="Telepon">
          {teks("telepon", { type: "tel", placeholder: "Telepon kantor" })}
        </Kolom>
        <Kolom pesan={tampil} k="ponsel" label="Ponsel" wajib>
          {teks("ponsel", { type: "tel", placeholder: "08xxxxxxxxxx", autoComplete: "tel" })}
        </Kolom>
        <Kolom pesan={tampil} k="alamat" label="Alamat" wajib lebar>
          <textarea
            name="alamat"
            rows={3}
            value={f.alamat}
            onChange={(e) => set("alamat", e.target.value)}
            placeholder="Alamat kantor"
            className={cn("w-full rounded-2xl border bg-transparent p-3 text-sm font-normal outline-none", tampil("alamat") ? "border-destructive" : "border-border")}
          />
        </Kolom>
      </fieldset>
      <label className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", tampil("setuju") ? "border-destructive" : "border-border")}>
        <input name="setuju" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={f.setuju} onChange={(e) => set("setuju", e.target.checked)} />
        <span>
          Saya menyatakan data di atas benar dan menyetujui pemrosesan data pribadi saya oleh BBPKA-PDN II Jatinangor untuk keperluan penyelenggaraan pelatihan, sesuai UU No. 27
          Tahun 2022 tentang Pelindungan Data Pribadi (
          <Link href="/kebijakan-privasi" className="text-primary hover:underline">
            Kebijakan Privasi
          </Link>
          ).
          {tampil("setuju") ? <span className="mt-1 block text-xs text-destructive">{tampil("setuju")}</span> : null}
        </span>
      </label>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <Button type="submit" disabled={sibuk} className="w-full">
        {sibuk ? "Mengirim…" : "Daftar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}

function Kolom({
  k,
  pesan,
  label,
  wajib,
  lebar,
  bantuan,
  children,
}: {
  k: KolomRegistrasi;
  pesan: (k: KolomRegistrasi) => string | undefined;
  label: string;
  wajib?: boolean;
  lebar?: boolean;
  bantuan?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm font-medium", lebar && "sm:col-span-2")}>
      <span>
        {label}
        {wajib ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
      {bantuan ? <span className="text-xs font-normal text-muted-foreground">{bantuan}</span> : null}
      {pesan(k) ? <span className="text-xs font-normal text-destructive">{pesan(k)}</span> : null}
    </label>
  );
}
