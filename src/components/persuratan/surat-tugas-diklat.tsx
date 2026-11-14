"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import Toast from "@/components/arc/toast/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { PENERIMA_MAKS_BADAN } from "@/lib/tata-naskah";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { tanggalPanjang } from "@/lib/dokumen";
import { pasangKalimatTanggal, rapikanRentang, type RentangTanggal } from "@/lib/persuratan";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { BawaanSuratRecord, SuratTugasRecord } from "@/lib/server/repositories/dokumen";
import { AREA, ISIAN, LABEL, PilihPenandatangan, TanggalTugasIsian } from "./isian";

type Data = { bawaan: BawaanSuratRecord; surat: SuratTugasRecord[]; bolehKelola: boolean };
type Isian = {
  nomor: string;
  tanggal: string;
  tempat: string;
  dasar: string[];
  untuk: string[];
  penandatangan: string;
  ttdNama: string;
  ttdNip: string;
  pilih: string[];
  tanggalTugas: RentangTanggal[];
};

/**
 * Surat tugas mengajar pada Rincian Diklat (sama dengan aplikasi lama). Konsep tanpa tanda tangan, ditandatangani lewat TTE di
 * luar aplikasi. Unduh Word atau buka halaman cetak untuk PDF.
 */
export function SuratTugasDiklat({ trainingId }: { trainingId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isian, setIsian] = useState<Isian | null>(null);
  const [sedangUbah, setSedangUbah] = useState<string | null>(null);
  const url = `/api/training/${encodeURIComponent(trainingId)}/surat-tugas`;

  const muat = useCallback(async () => {
    const r = await ambilJson<Data>(url);
    if (r.ok) setData(r.data);
    else setGalat(r.error);
  }, [url]);
  useEffect(() => {
    muat();
  }, [muat]);
  // Tautan #surat-tugas (dari menu Surat Tugas) menggulung ke panel ini setelah dimuat.
  useEffect(() => {
    if (data && location.hash === "#surat-tugas") document.getElementById("surat-tugas")?.scrollIntoView();
  }, [data]);

  function bukaBaru() {
    if (!data) return;
    const b = data.bawaan;
    setSedangUbah(null);
    setIsian({
      nomor: "",
      tanggal: isoTanggal(awalHariWib()),
      tempat: b.tempat,
      dasar: [""],
      untuk: [...b.untuk],
      penandatangan: b.penandatangan,
      ttdNama: b.ttdNama,
      ttdNip: b.ttdNip,
      pilih: b.kandidat.map((k) => k.pegawaiId),
      tanggalTugas: rapikanRentang(b.tanggalTugas),
    });
  }
  function bukaUbah(s: SuratTugasRecord) {
    setSedangUbah(s.id);
    setIsian({
      nomor: s.nomor ?? "",
      tanggal: s.tanggal,
      tempat: s.tempat,
      dasar: s.dasar.length ? [...s.dasar] : [""],
      untuk: [...s.untuk],
      penandatangan: s.penandatangan,
      ttdNama: s.ttd.nama,
      ttdNip: s.ttd.nip,
      pilih: s.penerima.map((p) => p.pegawaiId),
      tanggalTugas: rapikanRentang(s.tanggalTugas),
    });
  }
  async function hapus(s: SuratTugasRecord) {
    if (!confirm(`Hapus surat tugas ${s.nomor ?? "tanpa nomor"}?`)) return;
    const r = await kirimJson(`/api/surat-tugas/${encodeURIComponent(s.id)}`, "DELETE");
    if (!r.ok) setGalat(r.error);
    else setToast("Surat tugas dihapus.");
    muat();
  }

  return (
    <section id="surat-tugas" className="mt-6 flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-medium">Surat Tugas</h2>
          <p className="text-xs text-muted-foreground">Konsep tanpa tanda tangan; unggah ke aplikasi TTE setelah dicek.</p>
        </div>
        {data?.bolehKelola ? (
          <Button
            size="sm"
            onClick={bukaBaru}
            disabled={!data.bawaan.kandidat.length}
            title={!data.bawaan.kandidat.length ? "Belum ada Widyaiswara yang penugasannya disetujui" : undefined}
          >
            <Plus size={14} /> Buat surat tugas
          </Button>
        ) : null}
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data ? (
        galat ? null : (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )
      ) : !data.surat.length ? (
        <p className="text-sm text-muted-foreground">
          {data.bawaan.kandidat.length ? "Belum ada surat tugas." : "Surat tugas bisa dibuat setelah ada Widyaiswara yang penugasannya disetujui."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.surat.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className={cn("text-sm", s.nomor ? "font-mono" : "text-muted-foreground")}>{s.nomor ?? "Nomor belum diisi"}</p>
                <p className="text-xs text-muted-foreground">
                  {tanggalPanjang(s.tanggal)} · {s.penerima.map((p) => p.nama).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <ButtonLink size="sm" variant="ghost" href={`/api/surat-tugas/${encodeURIComponent(s.id)}/docx`} download>
                  Word
                </ButtonLink>
                <ButtonLink size="sm" variant="ghost" href={`/cetak/surat-tugas/${encodeURIComponent(s.id)}`} target="_blank" rel="noopener">
                  PDF / Cetak
                </ButtonLink>
                {data.bolehKelola ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => bukaUbah(s)}>
                      Ubah
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => hapus(s)}>
                      Hapus
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!isian} onOpenChange={(o) => !o && setIsian(null)}>
        <DialogContent
          title={sedangUbah ? "Ubah surat tugas" : "Buat surat tugas"}
          onPointerDownOutside={(e) => e.preventDefault()}
          style={{ width: "min(calc(100vw - 2rem), 42rem)" }}
        >
          {isian && data ? (
            <FormSurat
              awal={isian}
              kandidat={data.bawaan.kandidat}
              onKirim={async (isi) => {
                const r = sedangUbah
                  ? await kirimJson<SuratTugasRecord>(`/api/surat-tugas/${encodeURIComponent(sedangUbah)}`, "PUT", isi)
                  : await kirimJson<SuratTugasRecord>(url, "POST", isi);
                if (!r.ok) return r.error;
                setIsian(null);
                setToast(sedangUbah ? "Surat tugas diperbarui." : "Surat tugas dibuat.");
                muat();
                return null;
              }}
              labelSimpan={sedangUbah ? "Simpan perubahan" : "Buat surat tugas"}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Toast title="Surat Tugas" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </section>
  );
}

function FormSurat({
  awal,
  kandidat,
  onKirim,
  labelSimpan,
}: {
  awal: Isian;
  kandidat: BawaanSuratRecord["kandidat"];
  onKirim: (isi: Record<string, unknown>) => Promise<string | null>;
  labelSimpan: string;
}) {
  const [f, setF] = useState(awal);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = <K extends keyof Isian>(k: K, v: Isian[K]) => setF((x) => ({ ...x, [k]: v }));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const g = await onKirim({
      nomor: f.nomor.trim() || null,
      tanggal: f.tanggal,
      tempat: f.tempat,
      dasar: f.dasar,
      untuk: f.untuk,
      pegawaiIds: f.pilih,
      penandatangan: f.penandatangan,
      ttdNama: f.ttdNama,
      ttdNip: f.ttdNip,
      tanggalTugas: rapikanRentang(f.tanggalTugas),
    });
    setSibuk(false);
    if (g) setGalat(g);
  }
  const daftar = (k: "dasar" | "untuk", judul: string, tambah: string, baris: number) => (
    <div className={LABEL}>
      <span>{judul}</span>
      {f[k].map((v, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            rows={baris}
            value={v}
            onChange={(e) =>
              set(
                k,
                f[k].map((x, j) => (j === i ? e.target.value : x)),
              )
            }
            className={cn(AREA, "font-normal")}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Hapus butir ${k}`}
            onClick={() =>
              set(
                k,
                f[k].filter((_, j) => j !== i),
              )
            }
          >
            <X size={14} />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="secondary" onClick={() => set(k, [...f[k], ""])}>
          <Plus size={14} /> {tambah}
        </Button>
      </div>
    </div>
  );

  return (
    <form onSubmit={kirim} className="flex flex-col gap-4">
      <div className={LABEL}>
        <span>Kepada (Widyaiswara yang disetujui); sampai {PENERIMA_MAKS_BADAN} orang bernomor di badan surat, lebih dari itu &quot;Daftar nama terlampir&quot; + lampiran</span>
        <div className="flex flex-col gap-1.5 font-normal">
          {kandidat.map((k) => (
            <label key={k.pegawaiId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.pilih.includes(k.pegawaiId)}
                onChange={() => set("pilih", f.pilih.includes(k.pegawaiId) ? f.pilih.filter((x) => x !== k.pegawaiId) : [...f.pilih, k.pegawaiId])}
              />
              {k.nama}
              <span className="text-xs text-muted-foreground">
                {k.jabatan}
                {k.pangkat !== "-" ? ` · ${k.pangkat}` : ""}
              </span>
            </label>
          ))}
        </div>
      </div>
      <TanggalTugasIsian
        rentang={f.tanggalTugas}
        label="Tanggal mengajar"
        onUbah={(r) => setF((x) => ({ ...x, tanggalTugas: r, untuk: x.untuk.length ? [pasangKalimatTanggal(x.untuk[0], rapikanRentang(r)), ...x.untuk.slice(1)] : x.untuk }))}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={cn(LABEL, "sm:col-span-3")}>
          Nomor surat (diketik pembuat surat; boleh diisi setelah ditandatangani)
          <input
            value={f.nomor}
            onChange={(e) => set("nomor", e.target.value)}
            maxLength={120}
            placeholder="800.1.11.1/…/BBPKA-PDN II"
            className={cn(ISIAN, "font-mono font-normal")}
          />
        </label>
        <label className={LABEL}>
          Pada tanggal
          <input type="date" required value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} className={cn(ISIAN, "font-normal")} />
        </label>
        <label className={cn(LABEL, "sm:col-span-2")}>
          Ditetapkan di
          <input value={f.tempat} onChange={(e) => set("tempat", e.target.value)} maxLength={60} className={cn(ISIAN, "font-normal")} />
        </label>
      </div>
      {daftar("dasar", "Dasar (mis. surat permohonan: nomor & hal)", "Butir dasar", 2)}
      {daftar("untuk", "Untuk", "Butir untuk", 3)}
      <PilihPenandatangan
        jenis="SURAT_TUGAS"
        tanggal={f.tanggal}
        ttd={{ jabatan: f.penandatangan, nama: f.ttdNama, nip: f.ttdNip }}
        onPilih={(t) => setF((x) => ({ ...x, penandatangan: t.jabatan, ttdNama: t.nama, ttdNip: t.nip }))}
      />
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div>
        <Button type="submit" disabled={sibuk || !f.pilih.length}>
          {sibuk ? "Menyimpan…" : labelSimpan}
        </Button>
      </div>
    </form>
  );
}
