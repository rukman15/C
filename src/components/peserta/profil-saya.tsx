"use client";

import { useState, type FormEvent } from "react";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WILAYAH } from "@/lib/wilayah-data";
import { GOLONGAN, periksaProfil, type IsianProfil, type KolomProfil } from "@/lib/registrasi";
import { kirimJson } from "@/lib/api-klien";
import type { ProfilSayaRecord } from "@/lib/server/repositories/registrasi";

/**
 * Profil Saya (peserta hasil registrasi mandiri), sama dengan aplikasi lama: data kepegawaian, kontak, dan biodata
 * untuk pendaftaran diklat berikutnya. NIP, nama, dan nama pengguna diubah lewat penyelenggara.
 */
export function ProfilSaya({ awal }: { awal: ProfilSayaRecord }) {
  const [data, setData] = useState(awal);
  const [f, setF] = useState<IsianProfil>({ ...awal.isian });
  const [dicoba, setDicoba] = useState(false);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState(false);
  const salah = (dicoba ? periksaProfil(f) : {}) as Partial<Record<KolomProfil, string>>;
  const kabKota = WILAYAH.find((w) => w.kode === f.kodeProvinsi)?.kab ?? [];
  const atur = (k: KolomProfil) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const isian = (k: KolomProfil, label: string, tipe = "text", maks = 200) => (
    <Input key={k} label={label} type={tipe} maxLength={maks} value={f[k]} onChange={atur(k)} error={salah[k]} />
  );

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setDicoba(true);
    if (Object.keys(periksaProfil(f)).length) return;
    setSibuk(true);
    const res = await kirimJson<ProfilSayaRecord>("/api/profil-saya", "PUT", f);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setGalat("");
    setData(res.data);
    setF({ ...res.data.isian });
    setToast(true);
  }

  const Bagian = ({ judul, children }: { judul: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-border p-5">
      <h2 className="mb-4 text-sm font-medium">{judul}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["Nama", data.nama, false],
            ["NIP", data.nip, true],
            ["Nama pengguna", data.username ?? "-", true],
            ["Surel", data.email, true],
          ].map(([l, v, mono]) => (
            <div key={String(l)}>
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className={mono ? "font-mono" : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Nama, NIP, dan nama pengguna hanya bisa diubah oleh penyelenggara.</p>
      </section>
      <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
        {Bagian({
          judul: "Kepegawaian",
          children: (
            <>
              <div>
                <Select
                  label="Provinsi"
                  placeholder="Pilih provinsi"
                  value={f.kodeProvinsi || undefined}
                  onValueChange={(v) => setF((x) => ({ ...x, kodeProvinsi: v, kodeKabKota: "" }))}
                  options={WILAYAH.map((w) => ({ value: w.kode, label: w.nama }))}
                />
                {salah.kodeProvinsi ? <p className="mt-1 text-xs text-destructive">{salah.kodeProvinsi}</p> : null}
              </div>
              <div>
                <Select
                  key={f.kodeProvinsi}
                  label="Kabupaten/Kota"
                  placeholder={f.kodeProvinsi ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
                  value={f.kodeKabKota || undefined}
                  onValueChange={atur("kodeKabKota")}
                  options={kabKota.map(([kode, nama]) => ({ value: kode, label: nama }))}
                  disabled={!f.kodeProvinsi}
                />
                {salah.kodeKabKota ? <p className="mt-1 text-xs text-destructive">{salah.kodeKabKota}</p> : null}
              </div>
              {isian("instansi", "Instansi")}
              {isian("unitOrganisasi", "OPD / Unit Organisasi")}
              {isian("unitKerja", "Unit Kerja (opsional)")}
              {isian("jabatan", "Jabatan")}
              <div>
                <Select
                  label="Pangkat/Golongan ruang"
                  placeholder="Pilih golongan"
                  value={f.golongan || undefined}
                  onValueChange={atur("golongan")}
                  options={GOLONGAN.map((g) => ({ value: g.kode, label: `${g.pangkat} (${g.kode})` }))}
                />
                {salah.golongan ? <p className="mt-1 text-xs text-destructive">{salah.golongan}</p> : null}
              </div>
              {isian("eselon", "Eselon (opsional)", "text", 20)}
              {isian("tmtPangkat", "TMT pangkat", "date")}
              {isian("tmtJabatan", "TMT jabatan", "date")}
            </>
          ),
        })}
        {Bagian({
          judul: "Kontak",
          children: (
            <>
              {isian("ponsel", "Nomor ponsel", "tel", 30)}
              {isian("telepon", "Telepon kantor (opsional)", "tel", 30)}
              <div className="sm:col-span-2">{isian("alamat", "Alamat tempat tinggal", "text", 500)}</div>
              <div className="sm:col-span-2">{isian("alamatKantor", "Alamat kantor (opsional)", "text", 500)}</div>
            </>
          ),
        })}
        {Bagian({
          judul: "Biodata",
          children: (
            <>
              {isian("tempatLahir", "Tempat lahir", "text", 100)}
              {isian("tanggalLahir", "Tanggal lahir", "date")}
              <Select
                label="Jenis kelamin"
                placeholder="Pilih"
                value={f.jenisKelamin || undefined}
                onValueChange={atur("jenisKelamin")}
                options={[
                  { value: "L", label: "Laki-laki" },
                  { value: "P", label: "Perempuan" },
                ]}
              />
              {isian("pendidikanTerakhir", "Pendidikan terakhir", "text", 100)}
            </>
          ),
        })}
        {galat ? (
          <p role="alert" className="text-sm text-destructive">
            {galat}
          </p>
        ) : null}
        {dicoba && Object.keys(salah).length ? <p className="text-sm text-destructive">Periksa kembali isian yang ditandai.</p> : null}
        <Button type="submit" className="self-start" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </form>
      <Toast title="Profil tersimpan" open={toast} onOpenChange={setToast} />
    </div>
  );
}
