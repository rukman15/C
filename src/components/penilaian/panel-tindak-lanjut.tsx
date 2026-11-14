"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText, Printer } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { LABEL_KELULUSAN, formatNilai, type StatusKelulusan } from "@/lib/penilaian";
import { tanggalPanjang } from "@/lib/dokumen";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import type { RemedialJadwalRecord, RemedialPesertaRecord } from "@/lib/server/repositories/formulir-penyelenggaraan";
import type { CalonSuratRecord, DaftarSuratKeteranganRecord } from "@/lib/server/repositories/surat-keterangan";

/** Muat data panel; `versi` naik setiap nilai tersimpan supaya panel ikut terbarui. Galat 403 = panel disembunyikan. */
function useMuat<T>(url: string, versi: number) {
  const [data, setData] = useState<T | null>(null);
  const [galat, setGalat] = useState("");
  const muat = useCallback(async () => {
    const res = await ambilJson<T>(url);
    if (res.ok) {
      setData(res.data);
      setGalat("");
    } else setGalat(res.error);
  }, [url]);
  useEffect(() => {
    void versi;
    muat();
  }, [muat, versi]);
  return { data, setData, galat, setGalat, muat };
}

/**
 * Formulir 15 — Laporan Hasil Evaluasi Remedial (sama dengan aplikasi lama): peserta yang evaluasi akhir pertamanya
 * ditunda. Nilai remedial diisi di lembar Rekap; di sini dicatat waktu, tanggal, teknis, dan catatan, lalu dicetak.
 */
export function PanelRemedial({ trainingId, versi, bolehUbah }: { trainingId: string; versi: number; bolehUbah: boolean }) {
  const url = `/api/training/${encodeURIComponent(trainingId)}/remedial`;
  const { data, setData, galat, setGalat } = useMuat<RemedialJadwalRecord>(url, versi);
  const [edit, setEdit] = useState<string | null>(null);
  const [f, setF] = useState({ tanggal: "", waktu: "", teknis: "", catatan: "" });
  const [sibuk, setSibuk] = useState(false);
  type Baris = RemedialPesertaRecord["baris"][number];
  const kunci = (p: RemedialPesertaRecord, b: Baris) => `${p.pesertaId}|${b.jenis}`;
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  function buka(p: RemedialPesertaRecord, b: Baris) {
    if (edit === kunci(p, b)) return setEdit(null);
    setEdit(kunci(p, b));
    setF({ tanggal: b.tanggal ?? "", waktu: b.waktu ?? "", teknis: b.teknisPelaksanaan ?? "", catatan: b.catatan ?? "" });
  }
  async function simpan(e: FormEvent, p: RemedialPesertaRecord, b: Baris) {
    e.preventDefault();
    setSibuk(true);
    const res = await kirimJson<RemedialJadwalRecord>(url, "PUT", {
      pesertaId: p.pesertaId,
      jenisEvaluasi: b.jenis,
      tanggal: f.tanggal || null,
      waktu: f.waktu || null,
      teknis: f.teknis || null,
      catatan: f.catatan || null,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setEdit(null);
  }

  if (!data && !galat) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-medium">Laporan hasil evaluasi remedial (Formulir 15)</h2>
          <p className="text-sm text-muted-foreground">Peserta yang evaluasi akhir pertamanya ditunda. Nilai remedial diisi di tabel rekap; di sini pelaksanaannya.</p>
        </div>
        {data?.peserta.length ? (
          <ButtonLink size="sm" variant="secondary" href={`/cetak/formulir-15/${trainingId}`} target="_blank" rel="noopener">
            <Printer size={14} /> Cetak semua
          </ButtonLink>
        ) : null}
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {data && !data.peserta.length ? <p className="text-sm text-muted-foreground">Tidak ada peserta yang ditunda — Formulir 15 tidak diperlukan.</p> : null}
      {data?.peserta.map((p) => (
        <div key={p.pesertaId} className="rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{p.nomor}.</span>
            <span className="min-w-0 flex-1 text-sm font-medium">{p.nama}</span>
            <span className="text-xs text-muted-foreground">Sekarang: {LABEL_KELULUSAN[p.status as StatusKelulusan] ?? p.status}</span>
            <ButtonLink size="sm" variant="ghost" href={`/cetak/formulir-15/${trainingId}?peserta=${encodeURIComponent(p.pesertaId)}`} target="_blank" rel="noopener">
              <Printer size={14} /> Cetak
            </ButtonLink>
          </div>
          {p.perluKeputusanTim ? <p className="mt-1 text-xs text-warning">Sikap perilaku kurang baik — konseling, diputus Tim Evaluasi Akhir.</p> : null}
          <ul className="mt-2 flex flex-col gap-1.5">
            {p.baris.map((b) => (
              <li key={b.jenis} className="rounded-lg bg-muted/60 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-medium">{b.jenisEvaluasi}</span>
                  <span className="text-muted-foreground">{b.bentukTindakLanjut}</span>
                  <span>
                    Nilai: <span className="font-mono">{b.nilai == null ? "—" : formatNilai(b.nilai)}</span>
                  </span>
                  {bolehUbah ? (
                    <button type="button" className="text-primary underline" onClick={() => buka(p, b)}>
                      {edit === kunci(p, b) ? "tutup" : "isi pelaksanaan"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {[b.waktu, b.tanggal ? tanggalPanjang(b.tanggal) : "", b.teknisPelaksanaan].filter(Boolean).join(" · ") || "Pelaksanaan belum dicatat"}
                  {b.catatan ? ` — ${b.catatan}` : ""}
                </p>
                {edit === kunci(p, b) ? (
                  <form onSubmit={(e) => simpan(e, p, b)} className="mt-2 grid gap-2 sm:grid-cols-3">
                    <Input label="Tanggal" type="date" value={f.tanggal} onChange={set("tanggal")} />
                    <Input label="Waktu" value={f.waktu} onChange={set("waktu")} maxLength={20} placeholder="08.00–10.00" />
                    <Input label="Teknis" value={f.teknis} onChange={set("teknis")} maxLength={200} placeholder="mis. ujian tulis" />
                    <div className="sm:col-span-3">
                      <Input label="Catatan / dasar pertimbangan nilai" value={f.catatan} onChange={set("catatan")} maxLength={500} />
                    </div>
                    <div className="sm:col-span-3">
                      <Button type="submit" size="sm" disabled={sibuk}>
                        {sibuk ? "Menyimpan…" : "Simpan"}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/**
 * Surat keterangan "ditunda kelulusannya" / "tidak lulus" (KepKa LAN 2/2023 III.F.5–6), sama dengan aplikasi lama. Yang
 * berhak dihitung dari nilai; nomor diketik pembuat surat; ditandatangani Kepala Balai lewat TTE di luar aplikasi.
 */
export function PanelSuratKeterangan({ trainingId, versi }: { trainingId: string; versi: number }) {
  const url = `/api/training/${encodeURIComponent(trainingId)}/surat-keterangan`;
  const { data, galat, setGalat, muat } = useMuat<DaftarSuratKeteranganRecord>(url, versi);
  const [edit, setEdit] = useState<string | null>(null);
  const [nomor, setNomor] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const kunci = (c: CalonSuratRecord) => `${c.pesertaId}:${c.jenis}`;

  function buka(c: CalonSuratRecord) {
    setEdit(edit === kunci(c) ? null : kunci(c));
    setNomor(c.surat?.nomor ?? "");
    setTanggal(c.surat?.tanggal ?? hariIni());
  }
  async function simpan(e: FormEvent, c: CalonSuratRecord) {
    e.preventDefault();
    setSibuk(true);
    const res = await kirimJson(url, "POST", { aksi: "simpan", pesertaId: c.pesertaId, jenis: c.jenis, nomor: nomor.trim() || null, tanggal });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setEdit(null);
    await muat();
  }
  async function hapus(c: CalonSuratRecord) {
    if (!c.surat || !window.confirm(`Hapus surat keterangan ${c.nama}?`)) return;
    setSibuk(true);
    const res = await kirimJson(url, "POST", { aksi: "hapus", id: c.surat.id });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    await muat();
  }

  if (!data || !data.calon.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Surat keterangan ditunda / tidak lulus</h2>
        <p className="text-sm text-muted-foreground">
          Untuk peserta yang ditunda kelulusannya atau tidak lulus, ditandatangani Kepala Balai (TTE di luar aplikasi). Isi surat dibaca dari nilai saat dicetak; nomor diketik
          pembuat surat.
        </p>
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <ul className="flex flex-col gap-2">
        {data.calon.map((c) => (
          <li key={kunci(c)} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{c.nomorPeserta}.</span>
              <span className="min-w-0 flex-1 text-sm">
                {c.nama}{" "}
                <Badge size="sm" tone={c.jenis === "DITUNDA" ? "warning" : "danger"}>
                  {c.label}
                </Badge>{" "}
                <span className="text-xs text-muted-foreground">
                  nilai akhir <span className="font-mono">{formatNilai(c.nilaiAkhir)}</span>
                </span>
                {c.tidakSesuai ? <span className="block text-xs text-destructive">Nilai kini tidak lagi menunjukkan status ini — periksa sebelum mencetak.</span> : null}
              </span>
              {c.surat ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{c.surat.nomor || "nomor belum diisi"}</span> · {tanggalPanjang(c.surat.tanggal)}
                  </span>
                  {!c.tidakSesuai ? (
                    <>
                      <ButtonLink size="sm" variant="ghost" href={`/api/surat-keterangan/${encodeURIComponent(c.surat.id)}/docx`}>
                        <FileText size={14} /> Word
                      </ButtonLink>
                      <ButtonLink size="sm" variant="ghost" href={`/cetak/surat-keterangan/${encodeURIComponent(c.surat.id)}`} target="_blank" rel="noopener">
                        <Printer size={14} /> PDF
                      </ButtonLink>
                    </>
                  ) : null}
                </>
              ) : null}
              {data.bolehKelola ? (
                <>
                  <Button size="sm" variant="secondary" disabled={sibuk} onClick={() => buka(c)}>
                    {edit === kunci(c) ? "Tutup" : c.surat ? "Ubah" : "Buat surat"}
                  </Button>
                  {c.surat ? (
                    <button type="button" className="text-xs text-destructive underline" disabled={sibuk} onClick={() => hapus(c)}>
                      hapus
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            {edit === kunci(c) ? (
              <form onSubmit={(e) => simpan(e, c)} className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <Input label="Nomor surat (boleh dikosongkan dulu)" value={nomor} onChange={setNomor} maxLength={120} />
                <Input label="Tanggal surat" type="date" value={tanggal} onChange={setTanggal} />
                <Button type="submit" size="sm" disabled={sibuk || !tanggal}>
                  Simpan
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
