"use client";

import { Fragment, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { DEFINISI_FORMULIR, FORMULIR_EVALUASI, type FormulirEvaluasi } from "@/lib/evaluasi";
import { LABEL_KUALIFIKASI_23B } from "@/lib/evaluasi-penyelenggaraan";
import { formatTanggalId } from "@/lib/sesi";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { RekapEvaluasiRecord } from "@/lib/server/repositories/evaluasi";

const WARNA_KUAL: Record<string, string> = {
  SANGAT_MEMUASKAN: "text-success",
  MEMUASKAN: "text-success",
  BAIK: "text-primary",
  KURANG_BAIK: "text-warning",
  TIDAK_MEMENUHI: "text-destructive",
  SANGAT_BAIK: "text-success",
  CUKUP: "text-primary",
  KURANG: "text-warning",
  BURUK: "text-destructive",
};
const angka = (x: number | null | undefined) => (x == null ? "—" : x.toLocaleString("id-ID", { maximumFractionDigits: 2 }));
const LUAR = "__luar";
const FORMULIR_LAIN = FORMULIR_EVALUASI.filter((f) => f !== "PENGAMPU");

function Batang({ nama, rata, n }: { nama: string; rata: number | null; n?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span className="flex-1 text-muted-foreground">
        {nama}
        {n ? <span className="opacity-70"> ({n})</span> : null}
      </span>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${rata ?? 0}%` }} />
      </div>
      <span className="w-12 text-right font-mono">{angka(rata)}</span>
    </div>
  );
}

/**
 * Tab Evaluasi (sama dengan aplikasi lama): rekap Formulir 22 (rata-rata isian peserta per pengampu/penceramah/coach/
 * penguji/mentor, anonim) dan Formulir 23B evaluasi penyelenggaraan (PKA/PKP). Pengampu otomatis dari penugasan WI yang
 * disetujui; sasaran lain ditambah di sini. Tutup/buka berlaku untuk keduanya.
 */
export function TabEvaluasi({ awal }: { awal: RekapEvaluasiRecord }) {
  const [data, setData] = useState(awal);
  const [rinci, setRinci] = useState<string | null>(null);
  const [rinci23, setRinci23] = useState<number | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState<{ formulir: FormulirEvaluasi; nama: string; ket: string; pegawai: string }>({ formulir: "COACH", nama: "", ket: "", pegawai: LUAR });
  const url = `/api/training/${encodeURIComponent(data.training.id)}/evaluasi`;
  const wiDiJadwal = [...new Map(data.sasaran.filter((s) => s.formulir === "PENGAMPU" && s.pegawaiId).map((s) => [s.pegawaiId!, s.nama])).entries()];

  async function aksi(body: Record<string, unknown>, tanya?: string): Promise<boolean> {
    if (tanya && !window.confirm(tanya)) return false;
    setSibuk(true);
    setGalat("");
    const res = await kirimJson(url, "POST", body);
    setSibuk(false);
    if (!res.ok) {
      setGalat(res.error);
      return false;
    }
    const r = await ambilJson<RekapEvaluasiRecord>(url);
    if (r.ok) setData(r.data);
    return true;
  }
  async function tambah(e: FormEvent) {
    e.preventDefault();
    if (!f.nama.trim()) return setGalat("Isi nama");
    if (await aksi({ aksi: "tambah", formulir: f.formulir, nama: f.nama.trim(), keterangan: f.ket.trim() || null, pegawaiId: f.pegawai === LUAR ? null : f.pegawai }))
      setF((x) => ({ ...x, nama: "", ket: "", pegawai: LUAR }));
  }

  const p = data.penyelenggaraan;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          Evaluasi tenaga pelatihan oleh peserta (Formulir 16–21, rekap Formulir 22). <span className="font-mono">{data.pesertaBerakun}</span> dari{" "}
          <span className="font-mono">{data.pesertaAktif}</span> peserta aktif punya akun untuk mengisi.{" "}
          <Badge size="sm" tone={data.ditutup ? "warning" : "success"}>
            {data.ditutup ? "Ditutup" : "Dibuka"}
          </Badge>
        </p>
        <ButtonLink size="sm" variant="secondary" href={`${url}?format=csv`}>
          <Download size={14} /> Rekap pengajar (CSV)
        </ButtonLink>
        {data.bolehKelola ? (
          data.ditutup ? (
            <Button size="sm" variant="secondary" disabled={sibuk} onClick={() => aksi({ aksi: "buka" })}>
              Buka lagi
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={sibuk}
              onClick={() => aksi({ aksi: "tutup" }, "Tutup evaluasi? Peserta tidak bisa mengisi atau mengubah isian sampai dibuka lagi.")}
            >
              Tutup evaluasi
            </Button>
          )
        ) : null}
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}

      {data.bolehKelola ? (
        <section className="rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-medium">Tambah penceramah, coach, penguji, atau mentor</h2>
          <p className="text-sm text-muted-foreground">
            Pengampu materi otomatis dari penugasan WI yang disetujui.
            {data.training.jenisPelatihan ? " Coach di tab Kelompok juga otomatis dan dievaluasi anggota kelompoknya." : ""}
          </p>
          <form onSubmit={tambah} noValidate className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Select
              label="Unsur"
              value={f.formulir}
              onValueChange={(v) => setF((x) => ({ ...x, formulir: v as FormulirEvaluasi }))}
              options={FORMULIR_LAIN.map((k) => ({ value: k, label: DEFINISI_FORMULIR[k].label }))}
            />
            <Input label="Nama" value={f.nama} onChange={(v) => setF((x) => ({ ...x, nama: v }))} maxLength={150} />
            <Input
              label={f.formulir === "PENCERAMAH" ? "Materi ceramah" : "Kelompok / keterangan"}
              value={f.ket}
              onChange={(v) => setF((x) => ({ ...x, ket: v }))}
              maxLength={200}
            />
            <Select
              label="Pegawai balai"
              value={f.pegawai}
              onValueChange={(v) => setF((x) => ({ ...x, pegawai: v }))}
              options={[{ value: LUAR, label: "Bukan WI balai" }, ...wiDiJadwal.map(([id, nama]) => ({ value: id, label: nama }))]}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" disabled={sibuk || !f.nama.trim()}>
                Tambah
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-lg font-medium">Rekapitulasi</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-normal">Unsur</th>
                <th className="py-2 pr-2 font-normal">Nama</th>
                <th className="py-2 pr-2 text-right font-normal">Responden</th>
                <th className="py-2 pr-2 text-right font-normal">Rata-rata</th>
                <th className="py-2 pr-2 font-normal">Kualifikasi</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.sasaran.map((s) => (
                <Fragment key={s.kunci}>
                  <tr className="border-t border-border">
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{s.label}</td>
                    <td className="py-2 pr-2">
                      {s.nama}
                      {s.keterangan ? <span className="block text-xs text-muted-foreground">{s.keterangan}</span> : null}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {s.responden}
                      <span className="text-xs text-muted-foreground">/{data.pesertaAktif}</span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">{angka(s.rata)}</td>
                    <td className={cn("py-2 pr-2 text-xs", s.kualifikasi && WARNA_KUAL[s.kualifikasi])}>{s.labelKualifikasi ?? "—"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {s.responden > 0 ? (
                        <button type="button" className="text-xs text-primary underline" onClick={() => setRinci(rinci === s.kunci ? null : s.kunci)}>
                          {rinci === s.kunci ? "tutup" : "rinci"}
                        </button>
                      ) : null}
                      {data.bolehKelola && s.sasaranId && s.responden === 0 ? (
                        <button
                          type="button"
                          className="ml-2 text-xs text-destructive underline"
                          disabled={sibuk}
                          onClick={() => aksi({ aksi: "hapus", id: s.sasaranId }, `Hapus ${s.nama} dari evaluasi?`)}
                        >
                          hapus
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {rinci === s.kunci ? (
                    <tr>
                      <td colSpan={6} className="pb-3">
                        <div className="rounded-xl bg-muted/50 p-3">
                          {s.perAspek.map((a) => (
                            <Batang key={a.kode} nama={a.nama} rata={a.rata} />
                          ))}
                          {s.catatan.length ? (
                            <>
                              <p className="mt-2 text-xs text-muted-foreground">Catatan / saran peserta (anonim)</p>
                              <ul className="mt-1 list-disc pl-5 text-xs">
                                {s.catatan.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!data.sasaran.length ? (
            <p className="mt-2 text-sm text-muted-foreground">Belum ada pengajar: setujui penugasan WI (dengan mata pelatihan) atau tambah sasaran di atas.</p>
          ) : null}
        </div>
      </section>

      {p ? (
        <section className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h2 className="font-display text-lg font-medium">
                Evaluasi penyelenggaraan <span className="text-sm text-muted-foreground">(Formulir 23B)</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Diisi peserta mulai <span className="font-mono">{formatTanggalId(p.tersediaMulai)}</span>. Responden <span className="font-mono">{p.responden}</span>/
                <span className="font-mono">{data.pesertaAktif}</span> · rata-rata <span className="font-mono">{angka(p.rata)}</span>
                {p.kualifikasi ? <span className={cn("ml-1", WARNA_KUAL[p.kualifikasi])}>({p.labelKualifikasi})</span> : null}
              </p>
            </div>
            <ButtonLink size="sm" variant="secondary" href={`${url}?format=csv&formulir=23b`}>
              <Download size={14} /> Rekap penyelenggaraan (CSV)
            </ButtonLink>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-normal">Aspek</th>
                  <th className="py-2 pr-2 text-right font-normal">Rata-rata</th>
                  <th className="py-2 pr-2 font-normal">Kualifikasi</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {p.kelompok.map((k) => (
                  <Fragment key={k.no}>
                    <tr className="border-t border-border">
                      <td className="py-2 pr-2">
                        <span className="font-mono text-xs text-muted-foreground">{k.no}.</span> {k.nama}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">{angka(k.rata)}</td>
                      <td className={cn("py-2 pr-2 text-xs", k.kualifikasi && WARNA_KUAL[k.kualifikasi])}>{k.kualifikasi ? LABEL_KUALIFIKASI_23B[k.kualifikasi] : "—"}</td>
                      <td className="py-2 text-right">
                        {k.perAspek.length > 1 && p.responden > 0 ? (
                          <button type="button" className="text-xs text-primary underline" onClick={() => setRinci23(rinci23 === k.no ? null : k.no)}>
                            {rinci23 === k.no ? "tutup" : "rinci"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {rinci23 === k.no ? (
                      <tr>
                        <td colSpan={4} className="pb-3">
                          <div className="rounded-xl bg-muted/50 p-3">
                            {k.perAspek.map((a, i) => (
                              <Fragment key={a.kode}>
                                {a.induk && a.induk !== k.perAspek[i - 1]?.induk ? <p className="mt-1 text-xs text-muted-foreground">{a.induk}</p> : null}
                                <Batang nama={a.nama} rata={a.rata} n={a.n < p.responden ? `${a.n} responden` : undefined} />
                              </Fragment>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {p.catatan.length ? (
            <>
              <p className="mt-3 text-xs text-muted-foreground">Catatan / saran peserta (anonim)</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {p.catatan.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
