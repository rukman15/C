"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JENJANG_WI, geserBulan, labelBulan, type JenjangWi } from "@/lib/dokumen";
import { batasEfektif, type BatasJenjang } from "@/lib/kapasitas";
import { statusBeban, type StatusBeban } from "@/lib/beban-wi";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { BatasJpWiRecord } from "@/lib/server/repositories/batas-jp-wi";

type KoordinatorWi = { id: string; no: number | null; nama: string; jabatan: string; koordinator: boolean };
type PengaturanJp = { batasHijauHarian: number; batasKuningHarian: number; batasRekapBulanan: number; updatedAt: string; diubahOleh?: string };

const NADA: Record<StatusBeban, { tone: BadgeTone; label: string }> = {
  lewat: { tone: "danger", label: "Lewat" },
  dekat: { tone: "warning", label: "≥ 80%" },
  aman: { tone: "success", label: "Aman" },
  "tanpa-batas": { tone: "neutral", label: "–" },
};
const SEMUA = "__semua";
const ANGKA = "h-10 w-full rounded-full border bg-transparent px-4 font-mono text-sm outline-none placeholder:font-sans focus:border-border-strong";
const keTeks = (v: number | null) => (v === null ? "" : String(v));
const keAngka = (t: string | undefined): number | null => (String(t ?? "").trim() === "" ? null : Number(String(t).trim()));
const sah = (t: string | undefined) => {
  const v = keAngka(t);
  return v === null || (Number.isInteger(v) && v >= 1);
};
const labelJenjang = (j: JenjangWi | null) => JENJANG_WI.find((x) => x.kode === j)?.label ?? "Lainnya";

/**
 * Aturan JP (sama dengan aplikasi lama). Admin: Koordinator WI, batas JP WI per bulan, batas harian lama. Koordinator WI:
 * melihat daftar koordinator dan mengatur batas JP WI.
 */
export function AturanJp({ isAdmin, hariIni }: { isAdmin: boolean; hariIni: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Koordinator isAdmin={isAdmin} />
      <BatasWi hariIni={hariIni} />
      {isAdmin ? <BatasHarian /> : null}
    </div>
  );
}

function Koordinator({ isAdmin }: { isAdmin: boolean }) {
  const [daftar, setDaftar] = useState<KoordinatorWi[] | null>(null);
  const [pilih, setPilih] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    ambilJson<KoordinatorWi[]>("/api/admin/koordinator-wi").then((r) => (r.ok ? setDaftar(r.data) : setGalat(r.error)));
  }, []);
  async function atur(pegawaiId: string, jadi: boolean) {
    if (!pegawaiId) return;
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<KoordinatorWi[]>("/api/admin/koordinator-wi", "PUT", { pegawaiId, koordinator: jadi });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setDaftar(r.data);
    setPilih("");
  }
  const koordinator = (daftar ?? []).filter((w) => w.koordinator);
  const calon = (daftar ?? []).filter((w) => !w.koordinator);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 className="font-display text-lg font-medium">Koordinator WI</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Widyaiswara yang ditunjuk memantau semua penugasan WI, mencatat sesi mengajar, mengatur batas JP WI, dan mengunduh rekap JP. Perannya tetap Widyaiswara.
        {isAdmin ? "" : " Penunjukan diatur Administrator."}
      </p>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!daftar ? (
        galat ? null : (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {koordinator.length ? (
              koordinator.map((w) => (
                <li key={w.id} className="flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-sm">
                  {w.nama}
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={sibuk}
                      onClick={() => atur(w.id, false)}
                      aria-label={`Cabut ${w.nama} dari Koordinator WI`}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Belum ada Koordinator WI.</li>
            )}
          </ul>
          {isAdmin ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64">
                <Select label="Widyaiswara" value={pilih} onValueChange={setPilih} placeholder="Pilih Widyaiswara…" options={calon.map((w) => ({ value: w.id, label: w.nama }))} />
              </div>
              <Button size="sm" disabled={!pilih || sibuk} onClick={() => atur(pilih, true)}>
                Tunjuk sebagai Koordinator
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function BatasWi({ hariIni }: { hariIni: string }) {
  const [bulan, setBulan] = useState(hariIni.slice(0, 7));
  const [data, setData] = useState<BatasJpWiRecord | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [isiJenjang, setIsiJenjang] = useState<Record<JenjangWi, string>>({ pertama: "", muda: "", madya: "", utama: "" });
  const [isiWi, setIsiWi] = useState<Record<string, string>>({});
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<string>(SEMUA);
  const pernahMuat = useRef(false);

  function terapkan(d: BatasJpWiRecord) {
    setData(d);
    setIsiJenjang({ pertama: keTeks(d.jenjang.pertama), muda: keTeks(d.jenjang.muda), madya: keTeks(d.jenjang.madya), utama: keTeks(d.jenjang.utama) });
    setIsiWi(Object.fromEntries(d.wi.map((w) => [w.id, keTeks(w.batasSendiri)])));
  }
  useEffect(() => {
    let batal = false;
    ambilJson<BatasJpWiRecord>(`/api/admin/batas-jp-wi?bulan=${bulan}`).then((r) => {
      if (batal) return;
      if (!r.ok) return setGalat(r.error);
      setGalat("");
      // Ganti bulan: hanya kolom JP yang berubah; isian yang belum disimpan tidak hilang.
      if (pernahMuat.current) setData((d) => (d ? { ...d, bulan: r.data.bulan, wi: r.data.wi } : r.data));
      else terapkan(r.data);
      pernahMuat.current = true;
    });
    return () => {
      batal = true;
    };
  }, [bulan]);

  const draft: BatasJenjang = useMemo(
    () => ({
      pertama: sah(isiJenjang.pertama) ? keAngka(isiJenjang.pertama) : null,
      muda: sah(isiJenjang.muda) ? keAngka(isiJenjang.muda) : null,
      madya: sah(isiJenjang.madya) ? keAngka(isiJenjang.madya) : null,
      utama: sah(isiJenjang.utama) ? keAngka(isiJenjang.utama) : null,
    }),
    [isiJenjang],
  );
  const ubahJenjang = data ? JENJANG_WI.filter((j) => keAngka(isiJenjang[j.kode]) !== data.jenjang[j.kode]).map((j) => j.kode) : [];
  const ubahWi = data ? data.wi.filter((w) => keAngka(isiWi[w.id]) !== w.batasSendiri).map((w) => w.id) : [];
  const jumlahUbah = ubahJenjang.length + ubahWi.length;
  const adaSalah = Object.values(isiJenjang).some((t) => !sah(t)) || Object.values(isiWi).some((t) => !sah(t));

  const semua = useMemo(
    () =>
      (data?.wi ?? []).map((w) => {
        const sendiri = sah(isiWi[w.id]) ? keAngka(isiWi[w.id]) : null;
        const e = batasEfektif(sendiri, w.jenjang, draft);
        return { ...w, berlaku: e.batas, sumberBerlaku: e.sumber, status: statusBeban(w.jpBulan, e.batas) };
      }),
    [data, isiWi, draft],
  );
  const q = cari.trim().toLowerCase();
  const baris = semua.filter((w) => (saring === SEMUA || w.jenjang === saring) && (!q || w.nama.toLowerCase().includes(q)));
  const ringkas = {
    total: semua.length,
    tanpaBatas: semua.filter((x) => x.berlaku === null).length,
    khusus: semua.filter((x) => x.sumberBerlaku === "wi").length,
    lewat: semua.filter((x) => x.status === "lewat").length,
  };

  async function simpan() {
    if (!data || adaSalah || !jumlahUbah) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    const jenjang = Object.fromEntries(ubahJenjang.map((j) => [j, keAngka(isiJenjang[j])]));
    const wi = ubahWi.map((id) => ({ id, batas: keAngka(isiWi[id]) }));
    const r = await kirimJson<BatasJpWiRecord & { berubah: number }>("/api/admin/batas-jp-wi", "PATCH", {
      ...(ubahJenjang.length ? { jenjang } : {}),
      ...(wi.length ? { wi } : {}),
      bulan,
    });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    terapkan(r.data);
    setPesan(`Tersimpan (${r.data.berubah} perubahan).`);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 className="font-display text-lg font-medium">Batas JP Widyaiswara per bulan</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        JP yang dihitung adalah penugasan yang disetujui pada diklat yang mulai di bulan itu. Pengajuan yang membuat WI melewati batas tetap bisa dikirim, tetapi ditandai
        &quot;Melebihi batas JP bulanan&quot; untuk Kepala Balai. Batas khusus WI mengalahkan batas jenjang; keduanya kosong berarti belum diatur (tanpa batas).
      </p>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data ? (
        galat ? null : (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )
      ) : (
        <>
          <h3 className="text-sm font-medium">Batas bawaan per jenjang</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {JENJANG_WI.map((j) => (
              <label key={j.kode} className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{j.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{data.wi.filter((w) => w.jenjang === j.kode).length} WI</span>
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="belum diatur"
                    value={isiJenjang[j.kode]}
                    onChange={(e) => setIsiJenjang((x) => ({ ...x, [j.kode]: e.target.value }))}
                    aria-label={`Batas JP per bulan ${j.label}`}
                    className={cn(ANGKA, sah(isiJenjang[j.kode]) ? "border-border" : "border-destructive")}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">JP/bln</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{ringkas.total}</span> WI · <span className="font-mono">{ringkas.khusus}</span> memakai batas khusus ·{" "}
            <span className="font-mono">{ringkas.tanpaBatas}</span> belum punya batas ·{" "}
            <span className={ringkas.lewat ? "text-destructive" : undefined}>
              <span className="font-mono">{ringkas.lewat}</span> lewat batas {labelBulan(bulan)}
            </span>
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-sm font-medium">Batas khusus per WI</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-56">
                <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama WI…" leftIcon={<Search size={16} />} />
              </div>
              <div className="w-44">
                <Select
                  label="Jenjang"
                  value={saring}
                  onValueChange={setSaring}
                  options={[{ value: SEMUA, label: "Semua jenjang" }, ...JENJANG_WI.map((j) => ({ value: j.kode, label: j.label }))]}
                />
              </div>
              <div className="flex items-center gap-1 pb-1">
                <Button size="sm" variant="ghost" aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan, -1))}>
                  <ChevronLeft size={16} />
                </Button>
                <span className="min-w-28 text-center font-mono text-sm">{labelBulan(bulan)}</span>
                <Button size="sm" variant="ghost" aria-label="Bulan berikutnya" onClick={() => setBulan(geserBulan(bulan, 1))}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan kolom &quot;Batas khusus&quot; agar WI mengikuti batas jenjangnya. Bulan hanya mengubah kolom JP; batas berlaku untuk semua bulan.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">No</th>
                  <th className="px-3 py-2 font-medium">Widyaiswara</th>
                  <th className="px-3 py-2 font-medium">Batas khusus</th>
                  <th className="px-3 py-2 font-medium">Berlaku</th>
                  <th className="px-3 py-2 text-right font-medium">JP {labelBulan(bulan)}</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {baris.length ? (
                  baris.map((w) => (
                    <tr key={w.id} className={cn("border-t border-border", ubahWi.includes(w.id) && "bg-warning/10")}>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{w.no ?? "–"}</td>
                      <td className="px-3 py-2">
                        <span className="block">{w.nama}</span>
                        <span className="text-xs text-muted-foreground">
                          {labelJenjang(w.jenjang)}
                          {w.cuti ? <span className="text-warning"> · cuti</span> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          placeholder={w.jenjang && draft[w.jenjang] ? `ikut (${draft[w.jenjang]})` : "ikut jenjang"}
                          value={isiWi[w.id] ?? ""}
                          onChange={(e) => setIsiWi((x) => ({ ...x, [w.id]: e.target.value }))}
                          aria-label={`Batas JP khusus ${w.nama}`}
                          className={cn(ANGKA, "w-32", sah(isiWi[w.id]) ? "border-border" : "border-destructive")}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {w.berlaku ? (
                          <>
                            <span className="font-mono">{w.berlaku}</span> <span className="text-xs text-muted-foreground">{w.sumberBerlaku === "wi" ? "khusus" : "jenjang"}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">belum diatur</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{w.jpBulan}</td>
                      <td className="px-3 py-2">
                        <Badge size="sm" tone={NADA[w.status].tone}>
                          {NADA[w.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                      Tidak ada WI yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data.updatedAt && data.diubahOleh ? (
            <p className="text-[11px] text-muted-foreground">
              Terakhir diubah {new Date(data.updatedAt).toLocaleString("id-ID")} oleh {data.diubahOleh}. Rincian perubahan ada di Log Audit.
            </p>
          ) : null}
        </>
      )}
      {data && (jumlahUbah > 0 || pesan) ? (
        <div className="sticky bottom-4 z-30 rounded-2xl border border-border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {adaSalah ? (
                <span className="text-destructive">Ada isian yang salah: batas harus bilangan bulat ≥ 1 atau dikosongkan.</span>
              ) : jumlahUbah > 0 ? (
                <>
                  <span className="font-mono">{jumlahUbah}</span> perubahan belum disimpan
                </>
              ) : (
                <span className="text-success">{pesan}</span>
              )}
            </p>
            {jumlahUbah > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    terapkan(data);
                    setPesan("");
                  }}
                >
                  Batalkan
                </Button>
                <Button size="sm" disabled={sibuk || adaSalah} onClick={simpan}>
                  {sibuk ? "Menyimpan…" : "Simpan batas"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BatasHarian() {
  const [isi, setIsi] = useState<PengaturanJp | null>(null);
  const [galat, setGalat] = useState("");
  const [tersimpan, setTersimpan] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    ambilJson<PengaturanJp>("/api/admin/pengaturan-jp").then((r) => (r.ok ? setIsi(r.data) : setGalat(r.error)));
  }, []);
  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!isi) return;
    setSibuk(true);
    setGalat("");
    setTersimpan(false);
    const r = await kirimJson<PengaturanJp>("/api/admin/pengaturan-jp", "PATCH", {
      batasHijauHarian: isi.batasHijauHarian,
      batasKuningHarian: isi.batasKuningHarian,
      batasRekapBulanan: isi.batasRekapBulanan,
    });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setIsi(r.data);
    setTersimpan(true);
  }
  const angka = (k: "batasHijauHarian" | "batasKuningHarian" | "batasRekapBulanan") => (v: string) => setIsi((x) => (x ? { ...x, [k]: Number(v) } : x));

  return (
    <details className="rounded-2xl border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">Batas harian &amp; rekap (belum dipakai)</summary>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Angka di bawah ini hanya tersimpan; belum ada indikator beban harian otomatis (butuh data jadwal WI per tanggal).
      </p>
      {!isi ? (
        galat ? (
          <Alert tone="danger" title={galat} />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Memuat…</p>
        )
      ) : (
        <form onSubmit={kirim} className="mt-3 grid max-w-md gap-3">
          <Input label="Batas hijau (JP/hari, di bawah ini aman)" type="number" min={1} value={String(isi.batasHijauHarian)} onChange={angka("batasHijauHarian")} />
          <Input
            label="Batas kuning (JP/hari, di atas hijau sampai ini = waspada)"
            type="number"
            min={1}
            value={String(isi.batasKuningHarian)}
            onChange={angka("batasKuningHarian")}
          />
          <p className="text-xs text-muted-foreground">Di atas batas kuning = merah / terkunci (tidak bisa ditugaskan lagi hari itu).</p>
          <Input
            label="Batas rekap bulanan (JP/bulan, di bawah ini tidak perlu kartu kendali)"
            type="number"
            min={1}
            value={String(isi.batasRekapBulanan)}
            onChange={angka("batasRekapBulanan")}
          />
          {galat ? <Alert tone="danger" title={galat} /> : null}
          {tersimpan ? <Alert tone="success" title="Tersimpan." /> : null}
          <div>
            <Button type="submit" size="sm" variant="secondary" disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
          {isi.updatedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Terakhir diubah {new Date(isi.updatedAt).toLocaleString("id-ID")}
              {isi.diubahOleh ? ` oleh ${isi.diubahOleh}` : ""}
            </p>
          ) : null}
        </form>
      )}
    </details>
  );
}
