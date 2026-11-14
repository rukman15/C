"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Lock, Printer } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { DURASI_MAKS, DURASI_MIN, JUMLAH_SOAL_MAKS, KISI, LABEL_GAIN, LABEL_STATUS_TES, labelKisi, type JenisTes, type StatusTesBerlaku } from "@/lib/tes";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { KelolaTesRecord, TesKelolaRecord } from "@/lib/server/repositories/tes";

const NADA_STATUS: Record<StatusTesBerlaku, BadgeTone> = { DRAF: "neutral", TERJADWAL: "info", DIBUKA: "success", DITUTUP: "warning" };
const WARNA_GAIN: Record<string, string> = { TINGGI: "text-success", SEDANG: "text-primary", RENDAH: "text-warning", TURUN: "text-destructive" };
const JENIS: JenisTes[] = ["PRE", "POST"];
type Form = { buka: string; tutup: string; durasiMenit: string; soalIds: string[]; acakSoal: boolean; acakOpsi: boolean; tampilkanHasil: boolean };

/** ISO ↔ nilai input datetime-local (waktu perangkat; WIB di kantor). */
function keLokal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const keIso = (s: string) => (s ? new Date(s).toISOString() : null);
const tampilWaktu = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");
const angka = (x: number | null | undefined, d = 1) => (x == null ? "—" : x.toLocaleString("id-ID", { maximumFractionDigits: d }));
const dariTes = (t: TesKelolaRecord): Form => ({
  buka: keLokal(t.buka),
  tutup: keLokal(t.tutup),
  durasiMenit: String(t.durasiMenit),
  soalIds: [...t.soalIds],
  acakSoal: t.acakSoal,
  acakOpsi: t.acakOpsi,
  tampilkanHasil: t.tampilkanHasil,
});

/**
 * Tab Pre/Post Test (sama dengan aplikasi lama): Ketua Diklat & admin menyusun paket dari bank soal, mengatur waktu,
 * menerbitkan/menutup, memantau, dan mereset pengerjaan bermasalah; Kepala Balai/Kabag TU melihat hasil. Hasil = evaluasi
 * program (kenaikan pengetahuan), tidak masuk Formulir 14.
 */
export function TabTes({ awal }: { awal: KelolaTesRecord }) {
  const [data, setData] = useState(awal);
  const [form, setForm] = useState<Record<JenisTes, Form>>({ PRE: dariTes(awal.tes.PRE), POST: dariTes(awal.tes.POST) });
  const [jumlah, setJumlah] = useState<Record<JenisTes, string>>({ PRE: String(awal.tes.PRE.soalIds.length || 20), POST: String(awal.tes.POST.soalIds.length || 20) });
  const [manual, setManual] = useState<JenisTes | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const url = `/api/training/${encodeURIComponent(data.training.id)}/tes`;
  const kelola = data.bolehKelola;
  const tanpaAkun = data.peserta.filter((p) => p.status === "AKTIF" && !p.punyaAkun).length;
  const set = (j: JenisTes, patch: Partial<Form>) => setForm((f) => ({ ...f, [j]: { ...f[j], ...patch } }));

  async function muat() {
    const r = await ambilJson<KelolaTesRecord>(url);
    if (!r.ok) return setGalat(r.error);
    setData(r.data);
    setForm({ PRE: dariTes(r.data.tes.PRE), POST: dariTes(r.data.tes.POST) });
  }
  async function simpan(j: JenisTes): Promise<boolean> {
    const f = form[j];
    setSibuk(j + "simpan");
    setGalat("");
    const res = await kirimJson(url, "PUT", {
      jenis: j,
      buka: keIso(f.buka),
      tutup: keIso(f.tutup),
      durasiMenit: Number(f.durasiMenit),
      soalIds: f.soalIds,
      acakSoal: f.acakSoal,
      acakOpsi: f.acakOpsi,
      tampilkanHasil: f.tampilkanHasil,
    });
    setSibuk("");
    if (!res.ok) {
      setGalat(res.error);
      return false;
    }
    setManual(null);
    setToast(`Pengaturan ${j === "PRE" ? "pre-test" : "post-test"} disimpan.`);
    await muat();
    return true;
  }
  async function aksi(j: JenisTes, a: string, extra: Record<string, unknown> = {}, tanya?: string) {
    if (tanya && !window.confirm(tanya)) return;
    setSibuk(j + a);
    setGalat("");
    const res = await kirimJson(url, "POST", { jenis: j, aksi: a, ...extra });
    setSibuk("");
    if (!res.ok) setGalat(res.error);
    await muat();
  }
  async function terbitkan(j: JenisTes) {
    if (!window.confirm(`Terbitkan ${j === "PRE" ? "pre-test" : "post-test"}? Peserta bisa mulai mengerjakan sesuai waktu buka.`)) return;
    if (await simpan(j)) await aksi(j, "terbitkan");
  }
  const togel = (j: JenisTes, id: string) => set(j, { soalIds: form[j].soalIds.includes(id) ? form[j].soalIds.filter((x) => x !== id) : [...form[j].soalIds, id] });

  const kartu = (t: TesKelolaRecord) => {
    const j = t.jenis;
    const f = form[j];
    const terkunci = t.adaPengerjaan;
    return (
      <section key={j} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-medium">{t.label}</h2>
          <Badge size="sm" tone={NADA_STATUS[t.statusBerlaku]}>
            {LABEL_STATUS_TES[t.statusBerlaku]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Saran: {j === "PRE" ? data.saran.pre : data.saran.post}</p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Selesai", t.selesai, "bg-success/10 text-success"],
              ["Mengerjakan", t.berjalan, "bg-primary/10 text-primary"],
              ["Belum", t.belum, "bg-muted text-muted-foreground"],
            ] as const
          ).map(([l, n, c]) => (
            <div key={l} className={cn("rounded-xl py-2", c)}>
              <dt className="text-[11px]">{l}</dt>
              <dd className="font-display font-mono text-lg">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">
          Paket: <span className="font-mono">{t.soalIds.length}</span> soal
          {t.soalIds.length ? (
            <span className="text-xs text-muted-foreground">
              {" "}
              (
              {Object.entries(t.sebaran)
                .map(([k, n]) => `${k === "DASAR" ? "Dasar" : k === "UMUM" ? "Umum" : "Ag. " + k}: ${n}`)
                .join(" · ")}
              )
            </span>
          ) : null}
          {terkunci ? (
            <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock size={12} /> sudah dikerjakan, paket dikunci
            </span>
          ) : null}
        </p>
        {kelola ? (
          <>
            {!terkunci && t.status === "DRAF" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-24">
                  <Input label="Jumlah soal" type="number" inputMode="numeric" value={jumlah[j]} onChange={(v) => setJumlah((x) => ({ ...x, [j]: v }))} />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!sibuk}
                  onClick={() =>
                    aksi(
                      j,
                      "susun",
                      { jumlah: Math.min(JUMLAH_SOAL_MAKS, Number(jumlah[j]) || 0) },
                      t.soalIds.length ? "Paket sekarang diganti dengan susunan acak baru. Lanjutkan?" : undefined,
                    )
                  }
                >
                  Susun acak
                </Button>
                {j === "POST" ? (
                  <Button size="sm" variant="secondary" disabled={!!sibuk} onClick={() => aksi(j, "salin-pre")}>
                    Samakan dengan pre-test
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setManual(manual === j ? null : j)}>
                  {manual === j ? "Tutup pilihan" : "Pilih manual"}
                </Button>
              </div>
            ) : null}
            {manual === j ? (
              <div className="max-h-72 overflow-auto rounded-xl border border-border p-2 text-xs">
                <p className="mb-1 text-muted-foreground">
                  <span className="font-mono">{f.soalIds.length}</span> dipilih — klik Simpan pengaturan setelah memilih.
                </p>
                {KISI.map((k) => {
                  const grup = data.bankSiap.filter((s) => s.kisi === k);
                  return grup.length ? (
                    <div key={k} className="mt-2">
                      <p className="text-[11px] text-muted-foreground">{labelKisi(k, data.agenda)}</p>
                      {grup.map((s) => (
                        <label key={s.id} className="flex items-start gap-2 py-0.5">
                          <input type="checkbox" checked={f.soalIds.includes(s.id)} onChange={() => togel(j, s.id)} />
                          <span className="line-clamp-2">{s.pertanyaan}</span>
                        </label>
                      ))}
                    </div>
                  ) : null;
                })}
                {!data.bankSiap.length ? (
                  <p className="text-muted-foreground">
                    Bank soal {data.training.jenisPelatihan} belum punya soal siap.{" "}
                    <Link className="text-primary underline" href="/dashboard/bank-soal">
                      Buka Bank Soal
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Dibuka (kosong = saat diterbitkan)" type="datetime-local" value={f.buka} onChange={(v) => set(j, { buka: v })} />
              <Input label="Ditutup (kosong = ditutup manual)" type="datetime-local" value={f.tutup} onChange={(v) => set(j, { tutup: v })} />
              <Input label={`Durasi (${DURASI_MIN}–${DURASI_MAKS} menit)`} type="number" inputMode="numeric" value={f.durasiMenit} onChange={(v) => set(j, { durasiMenit: v })} />
              <div className="flex flex-col gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.acakSoal} onChange={(e) => set(j, { acakSoal: e.target.checked })} /> Acak urutan soal
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.acakOpsi} onChange={(e) => set(j, { acakOpsi: e.target.checked })} /> Acak urutan pilihan
                </label>
                {j === "POST" ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.tampilkanHasil} onChange={(e) => set(j, { tampilkanHasil: e.target.checked })} /> Peserta melihat skor pre & post
                  </label>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={!!sibuk} onClick={() => simpan(j)}>
                {sibuk === j + "simpan" ? "Menyimpan…" : "Simpan pengaturan"}
              </Button>
              {t.status === "DRAF" ? (
                <Button size="sm" disabled={!!sibuk || !f.soalIds.length} onClick={() => terbitkan(j)}>
                  Terbitkan
                </Button>
              ) : t.status === "TERBIT" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!!sibuk}
                    onClick={() => aksi(j, "tutup", {}, "Tutup tes sekarang? Peserta yang sedang mengerjakan langsung dinilai.")}
                  >
                    Tutup sekarang
                  </Button>
                  {!terkunci ? (
                    <Button size="sm" variant="ghost" disabled={!!sibuk} onClick={() => aksi(j, "kembali-draf")}>
                      Kembali ke draf
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button size="sm" variant="secondary" disabled={!!sibuk} onClick={() => aksi(j, "buka-lagi")}>
                  Buka lagi
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Dibuka {tampilWaktu(t.buka)} · ditutup {tampilWaktu(t.tutup)} · <span className="font-mono">{t.durasiMenit}</span> menit
          </p>
        )}
      </section>
    );
  };

  const r = data.ringkasan;
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" title="Kenaikan pengetahuan, bukan kelulusan">
        Pre-test & post-test mengukur kenaikan pengetahuan peserta (evaluasi program). Nilainya tidak masuk Formulir 14. Paket post-test sebaiknya sama dengan pre-test.
        {kelola ? ` Soal diambil dari Bank Soal ${data.training.jenisPelatihan}.` : ""}
      </Alert>
      {tanpaAkun ? <p className="text-xs text-warning">{tanpaAkun} peserta aktif belum punya akun, jadi belum bisa mengerjakan tes. Tautkan akun di tab Peserta.</p> : null}
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">{JENIS.map((j) => kartu(data.tes[j]))}</div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-medium">Hasil peserta</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <ButtonLink size="sm" variant="ghost" href={`/cetak/hasil-tes/${data.training.id}?jenis=pre`} target="_blank" rel="noopener">
              <Printer size={14} /> Lembar baca pembukaan
            </ButtonLink>
            <ButtonLink size="sm" variant="ghost" href={`/cetak/hasil-tes/${data.training.id}?jenis=post`} target="_blank" rel="noopener">
              <Printer size={14} /> Lembar baca penutupan
            </ButtonLink>
            <ButtonLink size="sm" variant="secondary" href={`${url}?format=csv`}>
              <Download size={14} /> CSV
            </ButtonLink>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Rata-rata pre", angka(r.rataPre)],
              ["Rata-rata post", angka(r.rataPost)],
              ["Rata-rata kenaikan", angka(r.rataKenaikan)],
              ["N-gain kelas", angka(r.nGainKelas, 2)],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{l}</dt>
              <dd className="font-display font-mono text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-normal">No</th>
                <th className="py-2 pr-2 font-normal">Nama</th>
                <th className="py-2 pr-2 text-right font-normal">Pre</th>
                <th className="py-2 pr-2 text-right font-normal">Post</th>
                <th className="py-2 pr-2 text-right font-normal">Naik</th>
                <th className="py-2 pr-2 text-right font-normal">N-gain</th>
                {kelola ? <th className="py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {data.peserta.map((p) => (
                <tr key={p.pesertaId} className={cn("border-t border-border", p.status !== "AKTIF" && "opacity-55")}>
                  <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">{p.nomor}</td>
                  <td className="py-2 pr-2">
                    {p.nama}
                    {!p.punyaAkun ? <span className="text-[11px] text-warning"> · tanpa akun</span> : null}
                  </td>
                  {[p.pre, p.post].map((h, i) => (
                    <td key={i} className="py-2 pr-2 text-right font-mono">
                      {h.status === "SELESAI" ? (
                        angka(h.skor)
                      ) : h.status === "BERJALAN" ? (
                        <span className="font-sans text-xs text-primary">sedang</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pr-2 text-right font-mono">{p.kenaikan == null ? "—" : (p.kenaikan > 0 ? "+" : "") + angka(p.kenaikan)}</td>
                  <td className={cn("py-2 pr-2 text-right font-mono", p.kategori && WARNA_GAIN[p.kategori])}>
                    {angka(p.nGain, 2)}
                    {p.kategori ? <span className="ml-1 font-sans text-[11px]">{LABEL_GAIN[p.kategori as keyof typeof LABEL_GAIN]}</span> : null}
                  </td>
                  {kelola ? (
                    <td className="py-2 text-right">
                      {JENIS.filter((jj) => (jj === "PRE" ? p.pre : p.post).status !== "BELUM").map((jj) => (
                        <button
                          key={jj}
                          type="button"
                          disabled={!!sibuk}
                          className="ml-2 text-[11px] text-muted-foreground underline"
                          onClick={() =>
                            aksi(
                              jj,
                              "reset",
                              { pesertaId: p.pesertaId },
                              `Reset ${jj === "PRE" ? "pre-test" : "post-test"} ${p.nama}? Jawabannya dihapus dan ia mengerjakan ulang.`,
                            )
                          }
                        >
                          reset {jj === "PRE" ? "pre" : "post"}
                        </button>
                      ))}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.peserta.length ? <p className="mt-2 text-sm text-muted-foreground">Belum ada peserta.</p> : null}
        </div>
      </section>

      {data.tes.POST.butir.length && (r.jumlahPre > 0 || r.jumlahPost > 0) ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-medium">Analisis butir soal</h2>
          <p className="text-xs text-muted-foreground">
            Persen peserta yang menjawab benar. Penanda muncul bila sedikitnya 5 peserta: terlalu mudah (pre ≥ 90%), terlalu sukar (post &lt; 30%), tidak naik (post ≤ pre).
          </p>
          {data.tes.POST.butir.map((b, i) => (
            <div key={b.soalId} className="rounded-xl border border-border px-3 py-2">
              <p className="text-sm">
                <span className="font-mono text-muted-foreground">
                  {i + 1}. [{b.kisi}]
                </span>{" "}
                <span className="line-clamp-2">{b.pertanyaan}</span>
              </p>
              <div className="mt-1.5 grid gap-1 text-xs">
                {(
                  [
                    ["Pre", b.pre, "bg-muted-foreground/40"],
                    ["Post", b.post, "bg-primary"],
                  ] as const
                ).map(([l, v, c]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="w-8 text-muted-foreground">{l}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-2 rounded-full", c)} style={{ width: `${v ?? 0}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono">{v == null ? "—" : `${angka(v)}%`}</span>
                  </div>
                ))}
              </div>
              {b.catatan.length ? <p className="mt-1 text-[11px] text-warning">{b.catatan.join(" · ")}</p> : null}
            </div>
          ))}
        </section>
      ) : null}
      <Toast title="Pre/Post Test" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
