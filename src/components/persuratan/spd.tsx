"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { tanggalPanjang } from "@/lib/dokumen";
import { ALAT_ANGKUT, TINGKAT_BIAYA, periksaSpd, type IsianSpd } from "@/lib/persuratan";
import type { PilihanKlien } from "@/lib/persuratan-klien";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { SetSpdRecord, SpdRecord, SuratUntukSpd } from "@/lib/server/repositories/spd";
import { AREA, ISIAN, LABEL } from "./isian";

type Sumber = { sumber: "naskah" | "surat-tugas"; sumberId: string };
type Isian = IsianSpd & { nomor: string; tanggal: string };

/**
 * SPD (sama dengan aplikasi lama): dibuat dari surat tugas yang SUDAH bernomor (umum atau mengajar), satu SPD per pegawai. Isian
 * awal dari surat tugas; Keuangan/TU melengkapi tingkat biaya, alat angkut, tujuan, akun. Ditandatangani PPK di luar aplikasi.
 */
export function Spd({ hariIni }: { hariIni: string }) {
  const params = useSearchParams();
  const [pilihan, setPilihan] = useState<PilihanKlien | null>(null);
  const [tahun, setTahun] = useState(Number(hariIni.slice(0, 4)));
  const [daftar, setDaftar] = useState<SuratUntukSpd[] | null>(null);
  const [dipilih, setDipilih] = useState<Sumber | null>(() => {
    const s = params.get("sumber");
    const id = params.get("sumberId");
    return (s === "naskah" || s === "surat-tugas") && id ? { sumber: s, sumberId: id } : null;
  });
  const [set, setSet] = useState<SetSpdRecord | null>(null);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; nama: string; isi: Isian } | null>(null);

  useEffect(() => {
    ambilJson<PilihanKlien>("/api/persuratan/pilihan").then((r) => (r.ok ? setPilihan(r.data) : setGalat(r.error)));
  }, []);
  const muatDaftar = useCallback(async () => {
    const r = await ambilJson<SuratUntukSpd[]>(`/api/persuratan/spd/daftar?tahun=${tahun}`);
    if (r.ok) setDaftar(r.data);
    else setGalat(r.error);
  }, [tahun]);
  useEffect(() => {
    if (!pilihan?.hak.spd) return;
    setDaftar(null);
    muatDaftar();
  }, [pilihan, muatDaftar]);
  const muatSet = useCallback(async () => {
    if (!dipilih) return;
    const r = await ambilJson<SetSpdRecord>(`/api/persuratan/spd?sumber=${dipilih.sumber}&sumberId=${encodeURIComponent(dipilih.sumberId)}`);
    if (r.ok) setSet(r.data);
    else setGalat(r.error);
  }, [dipilih]);
  useEffect(() => {
    setSet(null);
    setEdit(null);
    if (pilihan?.hak.spd && dipilih) muatSet();
  }, [pilihan, dipilih, muatSet]);

  async function buatSemua() {
    if (!dipilih) return;
    setGalat("");
    const r = await kirimJson<SetSpdRecord>("/api/persuratan/spd", "POST", dipilih);
    if (!r.ok) return setGalat(r.error);
    setSet(r.data);
    setToast(`${r.data.spd.length} SPD siap. Lengkapi tingkat biaya, alat angkut, dan tujuan bila perlu.`);
    muatDaftar();
  }
  function bukaEdit(d: SpdRecord) {
    setEdit({
      id: d.id,
      nama: d.pegawai.nama,
      isi: {
        nomor: d.nomor ?? "",
        tanggal: d.tanggal,
        tingkatBiaya: d.tingkatBiaya,
        maksud: d.maksud,
        alatAngkut: d.alatAngkut,
        tempatBerangkat: d.tempatBerangkat,
        tempatTujuan: d.tempatTujuan,
        tanggalBerangkat: d.tanggalBerangkat,
        tanggalKembali: d.tanggalKembali,
        lamaHari: d.lamaHari,
        akun: d.akun,
        keterangan: d.keterangan,
      },
    });
  }
  async function hapus(d: SpdRecord) {
    if (!confirm(`Hapus SPD ${d.pegawai.nama}?`)) return;
    const r = await kirimJson(`/api/persuratan/spd/${encodeURIComponent(d.id)}`, "DELETE");
    if (!r.ok) setGalat(r.error);
    else setToast("SPD dihapus.");
    muatSet();
    muatDaftar();
  }

  if (galat && !pilihan) return <Alert tone="danger" title={galat} />;
  if (!pilihan) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (!pilihan.hak.spd) return <EmptyState title="Tidak berwenang" description="SPD disusun oleh Keuangan, TU, dan Kepegawaian." />;

  const qs = dipilih ? `sumber=${dipilih.sumber}&sumberId=${encodeURIComponent(dipilih.sumberId)}` : "";
  const belumAdaSpd = !!set && set.surat.penerima.some((p) => !set.spd.some((s) => s.pegawaiId === p.pegawaiId));

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Surat tugas bernomor {tahun}</h2>
          <label className={cn(LABEL, "w-24")}>
            Tahun
            <input type="number" min={2020} max={2100} value={tahun} onChange={(e) => setTahun(Number(e.target.value) || tahun)} className={cn(ISIAN, "font-mono font-normal")} />
          </label>
        </div>
        {!daftar ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !daftar.length ? (
          <EmptyState title="Belum ada surat tugas bernomor pada tahun ini" description="SPD dibuat dari surat tugas yang sudah bernomor." />
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Nomor</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Untuk</th>
                  <th className="px-3 py-2 font-medium">SPD</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((s) => {
                  const aktif = dipilih?.sumberId === s.sumberId;
                  return (
                    <tr key={s.sumber + s.sumberId} className={cn("border-b border-border", aktif && "bg-muted/60")}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{s.nomor}</td>
                      <td className="whitespace-nowrap px-3 py-2">{tanggalPanjang(s.tanggal)}</td>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {s.jumlahSpd}/{s.jumlahPenerima}
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant={aktif ? "secondary" : "ghost"} aria-pressed={aktif} onClick={() => setDipilih({ sumber: s.sumber, sumberId: s.sumberId })}>
                          Pilih
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dipilih ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          {!set ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-medium">
                    {set.surat.label} <span className="font-mono">{set.surat.nomor ?? "(belum bernomor)"}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    PPK: {set.ppk.nama || "belum diatur (Pengaturan Dokumen)"} · <span className="font-mono">{set.surat.penerima.length}</span> pegawai
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {belumAdaSpd ? <Button onClick={buatSemua}>Buat SPD {set.spd.length ? "yang belum ada" : "semua pegawai"}</Button> : null}
                  {set.spd.length ? (
                    <>
                      <ButtonLink variant="secondary" href={`/api/persuratan/spd/docx?${qs}`} download>
                        Word
                      </ButtonLink>
                      <ButtonLink variant="secondary" href={`/cetak/spd?${qs}`} target="_blank" rel="noopener">
                        PDF
                      </ButtonLink>
                    </>
                  ) : null}
                </div>
              </div>
              {set.spd.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 font-medium">Pegawai</th>
                        <th className="px-3 py-2 font-medium">Tujuan</th>
                        <th className="px-3 py-2 font-medium">Tanggal</th>
                        <th className="px-3 py-2 font-medium">Tingkat</th>
                        <th className="px-3 py-2 font-medium">Angkutan</th>
                        <th className="px-3 py-2">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {set.spd.map((d) => (
                        <tr key={d.id} className="border-b border-border align-top">
                          <td className="px-3 py-2">
                            {d.pegawai.nama}
                            <div className={cn("text-xs text-muted-foreground", d.nomor && "font-mono")}>{d.nomor ?? "nomor SPD belum diisi"}</div>
                          </td>
                          <td className="px-3 py-2">{d.tempatTujuan || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {tanggalPanjang(d.tanggalBerangkat)} s.d. {tanggalPanjang(d.tanggalKembali)} (<span className="font-mono">{d.lamaHari}</span> hari)
                          </td>
                          <td className="px-3 py-2 font-mono">{d.tingkatBiaya}</td>
                          <td className="px-3 py-2">{d.alatAngkut}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <Button size="sm" variant="secondary" onClick={() => bukaEdit(d)}>
                              Ubah
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => hapus(d)}>
                              Hapus
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !set.surat.nomor ? (
                <p className="text-sm text-muted-foreground">Beri nomor surat tugas dulu.</p>
              ) : null}
              {edit ? (
                <FormSpd
                  key={edit.id}
                  nama={edit.nama}
                  awal={edit.isi}
                  onBatal={() => setEdit(null)}
                  onKirim={async (isi) => {
                    const r = await kirimJson<SetSpdRecord>(`/api/persuratan/spd/${encodeURIComponent(edit.id)}`, "PUT", isi);
                    if (!r.ok) return r.error;
                    setSet(r.data);
                    setToast(`SPD ${edit.nama} disimpan.`);
                    setEdit(null);
                    return null;
                  }}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
      <Toast title="SPD" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormSpd({ nama, awal, onKirim, onBatal }: { nama: string; awal: Isian; onKirim: (isi: Record<string, unknown>) => Promise<string | null>; onBatal: () => void }) {
  const [f, setF] = useState(awal);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (k: keyof Isian) => (v: string) => setF((x) => ({ ...x, [k]: k === "lamaHari" ? Number(v) : v }));
  async function kirim(e: FormEvent) {
    e.preventDefault();
    const g = periksaSpd(f);
    if (g.length) return setGalat(g.join("; "));
    setSibuk(true);
    setGalat("");
    const hasil = await onKirim({ ...f, nomor: f.nomor.trim() || null, lamaHari: Number(f.lamaHari) });
    setSibuk(false);
    if (hasil) setGalat(hasil);
  }
  return (
    <form onSubmit={kirim} noValidate className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
      <h3 className="text-sm font-medium sm:col-span-3">SPD {nama}</h3>
      <Input label="Nomor SPD" value={f.nomor} onChange={set("nomor")} maxLength={120} />
      <Input label="Tanggal dikeluarkan" type="date" value={f.tanggal} onChange={set("tanggal")} />
      <Select label="Tingkat biaya" value={f.tingkatBiaya} onValueChange={set("tingkatBiaya")} options={TINGKAT_BIAYA.map((t) => ({ value: t, label: t }))} />
      <label className={cn(LABEL, "sm:col-span-3")}>
        Maksud perjalanan dinas
        <textarea rows={2} value={f.maksud} onChange={(e) => set("maksud")(e.target.value)} className={cn(AREA, "font-normal")} />
      </label>
      <Input label="Alat angkutan" value={f.alatAngkut} onChange={set("alatAngkut")} list="alat-angkut" />
      <datalist id="alat-angkut">
        {ALAT_ANGKUT.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <Input label="Tempat berangkat" value={f.tempatBerangkat} onChange={set("tempatBerangkat")} />
      <Input label="Tempat tujuan" value={f.tempatTujuan} onChange={set("tempatTujuan")} />
      <Input label="Tanggal berangkat" type="date" value={f.tanggalBerangkat} onChange={set("tanggalBerangkat")} />
      <Input label="Tanggal kembali" type="date" value={f.tanggalKembali} onChange={set("tanggalKembali")} />
      <Input label="Lama (hari)" type="number" min={1} value={String(f.lamaHari)} onChange={set("lamaHari")} />
      <Input label="Akun (MAK)" value={f.akun} onChange={set("akun")} maxLength={60} />
      <div className="sm:col-span-2">
        <Input label="Keterangan lain-lain" value={f.keterangan} onChange={set("keterangan")} maxLength={300} />
      </div>
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-3" /> : null}
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
      </div>
    </form>
  );
}
