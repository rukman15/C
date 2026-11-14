"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Plus, X } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { rapikanNamaSurat } from "@/lib/tata-naskah";
import { tanggalPanjang } from "@/lib/dokumen";
import {
  JENIS_NASKAH,
  KEAMANAN,
  SIFAT_SURAT,
  cocokkanDaftarPegawai,
  jenisNaskah,
  pasangKalimatTanggal,
  rapikanRentang,
  type BentrokItem,
  type IsiNaskah,
  type JenisNaskah,
  type RentangTanggal,
} from "@/lib/persuratan";
import { keDaftar, type PilihanKlien } from "@/lib/persuratan-klien";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { BawaanNaskahRecord, NaskahRecord } from "@/lib/server/repositories/persuratan";
import { AREA, ISIAN, LABEL, PilihPenandatangan, TanggalTugasIsian } from "./isian";

const SURAT_TUGAS: JenisNaskah = "SURAT_TUGAS";
const JENIS_DI_SINI = JENIS_NASKAH.filter((j) => j.kode !== SURAT_TUGAS);
const TANPA = "__tanpa";
const SEMUA = "__semua";

type Form = {
  jenis: JenisNaskah;
  trainingId: string | null;
  hal: string;
  tanggal: string;
  tempat: string;
  sifat: string;
  keamanan: string;
  lampiranTeks: string;
  kepadaTeks: string;
  tembusanTeks: string;
  pegawaiIds: string[];
  tanggalTugas: RentangTanggal[];
  isi: IsiNaskah;
  ttdJabatan: string;
  ttdNama: string;
  ttdNip: string;
  nomor: string;
  notaId: string | null;
  suratTurunan: { id: string; nomor: string | null }[];
};

function dariNaskah(n: NaskahRecord): Form {
  return {
    jenis: n.jenis,
    trainingId: n.trainingId,
    hal: n.hal,
    tanggal: n.tanggal,
    tempat: n.tempat,
    sifat: n.sifat,
    keamanan: n.keamanan,
    lampiranTeks: n.lampiranTeks,
    kepadaTeks: n.kepada.join("\n"),
    tembusanTeks: n.tembusan.join("\n"),
    pegawaiIds: [...n.pegawaiIds],
    tanggalTugas: rapikanRentang(n.tanggalTugas),
    isi: structuredClone(n.isi),
    ttdJabatan: n.ttdJabatan,
    ttdNama: n.ttdNama,
    ttdNip: n.ttdNip,
    nomor: n.nomor ?? "",
    notaId: n.notaId,
    suratTurunan: n.suratTugasDariNota,
  };
}

/**
 * Naskah dinas keluar (sama dengan aplikasi lama): daftar, buat/ubah konsep, unduh Word/PDF, isi nomor. Format Permendagri
 * 18/2024; konsep tanpa tanda tangan (TTE di luar aplikasi). Surat tugas umum didaftar di tab Surat Tugas, tetapi isiannya di
 * halaman ini (?buat=SURAT_TUGAS, ?ubah=<id>, ?dariSurat=<id surat masuk>).
 */
export function NaskahDinas({ emailSaya, hariIni }: { emailSaya: string; hariIni: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pilihan, setPilihan] = useState<PilihanKlien | null>(null);
  const [tahun, setTahun] = useState(Number(hariIni.slice(0, 4)));
  const [filterJenis, setFilterJenis] = useState(SEMUA);
  const [saringNomor, setSaringNomor] = useState<"" | "belum" | "sudah">("");
  const [daftar, setDaftar] = useState<NaskahRecord[] | null>(null);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [pilihJenis, setPilihJenis] = useState<JenisNaskah>("NOTA_DINAS");
  const [pilihDiklat, setPilihDiklat] = useState("");
  const [f, setF] = useState<Form | null>(null);
  const [sedangUbah, setSedangUbah] = useState<string | null>(null);
  const [galatMulai, setGalatMulai] = useState("");

  const muat = useCallback(async () => {
    const r = await ambilJson<NaskahRecord[]>(`/api/persuratan/naskah?tahun=${tahun}${filterJenis !== SEMUA ? `&jenis=${filterJenis}` : ""}`);
    if (r.ok) setDaftar(r.data);
    else setGalat(r.error);
  }, [tahun, filterJenis]);

  const mulaiBaru = useCallback(
    async (o: { jenis: JenisNaskah; diklat: string; suratMasukId?: string | null; notaId?: string | null }) => {
      setGalatMulai("");
      if (jenisNaskah(o.jenis)?.diklat && !o.diklat) return setGalatMulai("Pilih jadwal diklat dulu");
      const q = new URLSearchParams({ jenis: o.jenis });
      if (o.diklat) q.set("trainingId", o.diklat);
      if (o.suratMasukId) q.set("suratMasukId", o.suratMasukId);
      if (o.notaId) q.set("notaId", o.notaId);
      const r = await ambilJson<BawaanNaskahRecord>(`/api/persuratan/naskah/bawaan?${q}`);
      if (!r.ok) return setGalatMulai(r.error);
      const b = r.data;
      setSedangUbah(null);
      setF({
        jenis: b.jenis,
        trainingId: b.trainingId,
        hal: b.hal,
        tanggal: hariIni,
        tempat: b.tempat,
        sifat: b.sifat,
        keamanan: "B",
        lampiranTeks: b.lampiranTeks,
        kepadaTeks: b.kepada.join("\n"),
        tembusanTeks: "",
        pegawaiIds: [...(b.pegawaiIds ?? [])],
        tanggalTugas: rapikanRentang(b.tanggalTugas),
        isi: b.isi,
        ttdJabatan: b.ttdJabatan,
        ttdNama: b.ttdNama,
        ttdNip: b.ttdNip,
        nomor: "",
        notaId: b.notaId,
        suratTurunan: [],
      });
    },
    [hariIni],
  );
  const bukaUbah = useCallback(async (id: string) => {
    // Daftar tidak memuat penerima & isi lengkap: ambil satu naskah dulu.
    const r = await ambilJson<NaskahRecord>(`/api/persuratan/naskah/${encodeURIComponent(id)}`);
    if (!r.ok) return setGalat(r.error);
    setSedangUbah(id);
    setF(dariNaskah(r.data));
  }, []);

  useEffect(() => {
    ambilJson<PilihanKlien>("/api/persuratan/pilihan").then((r) => {
      if (!r.ok) return setGalat(r.error);
      setPilihan(r.data);
      const dari = params.get("dariSurat");
      const buat = params.get("buat");
      const idUbah = params.get("ubah");
      if (dari && r.data.hak.susun) mulaiBaru({ jenis: SURAT_TUGAS, diklat: "", suratMasukId: dari });
      else if (buat === SURAT_TUGAS && r.data.hak.susun) mulaiBaru({ jenis: SURAT_TUGAS, diklat: "" });
      else if (idUbah) bukaUbah(idUbah);
    });
    // Parameter URL hanya dibaca saat halaman dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!pilihan || (!pilihan.hak.susun && !pilihan.hak.nomor)) return;
    setDaftar(null);
    muat();
  }, [pilihan, muat]);

  const naskahDiSini = (daftar ?? []).filter((n) => n.jenis !== SURAT_TUGAS);
  const tampil = naskahDiSini.filter((n) => !saringNomor || (saringNomor === "belum" ? !n.nomor : !!n.nomor));
  const jumlahBelumNomor = naskahDiSini.filter((n) => !n.nomor).length;
  const bisaUbah = (n: NaskahRecord) => !!pilihan && (pilihan.hak.nomor || n.dibuatOleh === emailSaya);
  const defPilih = jenisNaskah(pilihJenis);

  async function hapus(n: NaskahRecord) {
    if (!confirm(`Hapus konsep ${n.label}?${n.hal ? `\n${n.hal}` : ""}`)) return;
    const r = await kirimJson(`/api/persuratan/naskah/${encodeURIComponent(n.id)}`, "DELETE");
    if (!r.ok) setGalat(r.error);
    else setToast("Naskah dihapus.");
    muat();
  }
  function tutupForm() {
    setF(null);
    setSedangUbah(null);
    if (params.toString()) router.replace("/dashboard/persuratan");
  }

  if (galat && !pilihan) return <Alert tone="danger" title={galat} />;
  if (!pilihan) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (!pilihan.hak.susun && !pilihan.hak.nomor) return <EmptyState title="Tidak berwenang" description="Naskah dinas disusun oleh TU, Kepegawaian, Ketua Diklat, dan pimpinan." />;

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {pilihan.hak.susun ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-medium">Buat naskah</h2>
          <p className="text-xs text-muted-foreground">1. Pilih jenis naskah, 2. lengkapi isi, 3. periksa dan simpan konsep. Nomor diketik pembuat surat setelah ditandatangani.</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3" role="group" aria-label="Pilih jenis naskah">
            {JENIS_DI_SINI.map((j) => (
              <button
                key={j.kode}
                type="button"
                aria-pressed={pilihJenis === j.kode}
                onClick={() => setPilihJenis(j.kode)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors sm:py-3",
                  pilihJenis === j.kode ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="block text-sm font-medium">{j.label}</span>
                <span className="mt-1 hidden text-xs text-muted-foreground sm:block">{j.keterangan}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label={`Jadwal diklat ${defPilih?.diklat ? "(wajib)" : "(opsional)"}`}
              value={pilihDiklat || TANPA}
              onValueChange={(v) => setPilihDiklat(v === TANPA ? "" : v)}
              options={[{ value: TANPA, label: "Tidak dikaitkan" }, ...pilihan.diklat.map((d) => ({ value: d.id, label: `${d.name} · ${tanggalPanjang(d.startDate)}` }))]}
            />
            <Button onClick={() => mulaiBaru({ jenis: pilihJenis, diklat: pilihDiklat })}>
              Lanjutkan isi naskah <ArrowRight size={16} />
            </Button>
          </div>
          {galatMulai && !f ? <Alert tone="danger" title={galatMulai} /> : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Daftar naskah</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <Select
                label="Jenis"
                value={filterJenis}
                onValueChange={setFilterJenis}
                options={[{ value: SEMUA, label: "Semua jenis" }, ...JENIS_DI_SINI.map((j) => ({ value: j.kode, label: j.label }))]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Nomor"
                value={saringNomor || SEMUA}
                onValueChange={(v) => setSaringNomor(v === SEMUA ? "" : (v as "belum" | "sudah"))}
                options={[
                  { value: SEMUA, label: "Semua" },
                  { value: "belum", label: `Belum bernomor${jumlahBelumNomor ? ` (${jumlahBelumNomor})` : ""}` },
                  { value: "sudah", label: "Sudah bernomor" },
                ]}
              />
            </div>
            <label className={cn(LABEL, "w-24")}>
              Tahun
              <input type="number" min={2020} max={2100} value={tahun} onChange={(e) => setTahun(Number(e.target.value) || tahun)} className={cn(ISIAN, "font-mono font-normal")} />
            </label>
          </div>
        </div>
        {!daftar ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !naskahDiSini.length ? (
          <EmptyState title="Belum ada naskah pada tahun ini" description="Surat tugas ada di tab Surat Tugas." />
        ) : !tampil.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada naskah yang cocok dengan saringan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Jenis</th>
                  <th className="px-3 py-2 font-medium">Hal</th>
                  <th className="px-3 py-2 font-medium">Nomor</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {tampil.map((n) => (
                  <tr key={n.id} className="border-b border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2">{tanggalPanjang(n.tanggal)}</td>
                    <td className="px-3 py-2">
                      {n.label}
                      {n.notaId ? <div className="text-xs text-muted-foreground">dari nota usulan</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      {n.hal || "-"}
                      {n.trainingName ? <div className="text-xs text-muted-foreground">{n.trainingName}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {n.nomor ? (
                        <span className="font-mono">{n.nomor}</span>
                      ) : (
                        <Badge size="sm" tone="warning">
                          Belum bernomor
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <ButtonLink size="sm" variant="ghost" href={`/api/persuratan/naskah/${encodeURIComponent(n.id)}/docx`} download>
                          Word
                        </ButtonLink>
                        <ButtonLink size="sm" variant="ghost" href={`/cetak/naskah/${encodeURIComponent(n.id)}`} target="_blank" rel="noopener">
                          PDF
                        </ButtonLink>
                        {bisaUbah(n) ? (
                          <Button size="sm" variant="secondary" onClick={() => bukaUbah(n.id)}>
                            {n.nomor ? "Ubah" : "Ubah / isi nomor"}
                          </Button>
                        ) : null}
                        {pilihan.hak.susun && n.jenis === "NOTA_USULAN" && n.pegawaiIds.length ? (
                          <Button size="sm" variant="ghost" onClick={() => mulaiBaru({ jenis: SURAT_TUGAS, diklat: n.trainingId ?? "", notaId: n.id })}>
                            Buat surat tugas
                          </Button>
                        ) : null}
                        {bisaUbah(n) && !n.nomor ? (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => hapus(n)}>
                            Hapus
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={!!f} onOpenChange={(o) => !o && tutupForm()}>
        <DialogContent
          title={f ? `${sedangUbah ? "Ubah" : "Buat"} ${jenisNaskah(f.jenis)?.label ?? "naskah"}` : "Naskah"}
          description={sedangUbah ? "Mengubah konsep" : "Langkah 2 dari 3 · Isi konsep"}
          onPointerDownOutside={(e) => e.preventDefault()}
          style={{ width: "min(calc(100vw - 2rem), 48rem)" }}
        >
          {f ? (
            <FormNaskah
              awal={f}
              pilihan={pilihan}
              sedangUbah={sedangUbah}
              onTersimpan={(jenis) => {
                setToast(sedangUbah ? "Naskah diperbarui." : "Naskah dibuat.");
                setF(null);
                setSedangUbah(null);
                // Surat tugas didaftar di tab Surat Tugas: kembali ke sana setelah disimpan.
                if (jenis === SURAT_TUGAS) router.push("/dashboard/persuratan/surat-tugas");
                else {
                  if (params.toString()) router.replace("/dashboard/persuratan");
                  muat();
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Toast title="Naskah Dinas" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormNaskah({ awal, pilihan, sedangUbah, onTersimpan }: { awal: Form; pilihan: PilihanKlien; sedangUbah: string | null; onTersimpan: (jenis: JenisNaskah) => void }) {
  const [f, setF] = useState<Form>(awal);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [cariPegawai, setCariPegawai] = useState("");
  const [tempelan, setTempelan] = useState("");
  const [hasilTempel, setHasilTempel] = useState("");
  const [bentrok, setBentrok] = useState<Record<string, BentrokItem[]>>({});
  const def = jenisNaskah(f.jenis);
  const bentuk = def?.bentuk ?? "surat-dinas";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setIsi = <K extends keyof IsiNaskah>(k: K, v: IsiNaskah[K]) => setF((x) => ({ ...x, isi: { ...x.isi, [k]: v } }));
  const ubahDaftar = (k: "paragraf" | "dasar" | "untuk", i: number, v: string) =>
    setIsi(
      k,
      f.isi[k].map((x, j) => (j === i ? v : x)),
    );
  const buangDaftar = (k: "paragraf" | "dasar" | "untuk", i: number) =>
    setIsi(
      k,
      f.isi[k].filter((_, j) => j !== i),
    );

  const pegawaiTersaring = useMemo(() => {
    const q = cariPegawai.trim().toLowerCase();
    return pilihan.pegawai.filter((p) => !q || `${p.nama} ${p.jabatan}`.toLowerCase().includes(q)).slice(0, 50);
  }, [pilihan.pegawai, cariPegawai]);
  const namaPegawai = (id: string) => pilihan.pegawai.find((p) => p.id === id)?.nama ?? id;

  // Bentrok jadwal pegawai pada tanggal tugas (surat tugas), diperiksa server dengan jeda.
  const kunciBentrok = bentuk === "surat-tugas" ? JSON.stringify([f.pegawaiIds, rapikanRentang(f.tanggalTugas), sedangUbah]) : "";
  useEffect(() => {
    const body = { pegawaiIds: f.pegawaiIds, tanggalTugas: rapikanRentang(f.tanggalTugas), naskahId: sedangUbah };
    if (!kunciBentrok || !body.pegawaiIds.length || !body.tanggalTugas.length) {
      setBentrok({});
      return;
    }
    let batal = false;
    const t = setTimeout(async () => {
      const r = await kirimJson<Record<string, BentrokItem[]>>("/api/persuratan/bentrok", "POST", body);
      if (r.ok && !batal) setBentrok(r.data);
    }, 400);
    return () => {
      batal = true;
      clearTimeout(t);
    };
    // kunciBentrok merangkum isian yang memicu pemeriksaan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciBentrok]);
  const tandaBentrok = (id: string) => {
    const xs = bentrok[id] ?? [];
    if (!xs.length) return null;
    return { cegah: xs.some((x) => x.tingkat === "cegah"), teks: xs.map((x) => `${x.keterangan} (${x.tanggal.map(tanggalPanjang).join(", ")})`).join("; ") };
  };
  const togglePegawai = (id: string) => set("pegawaiIds", f.pegawaiIds.includes(id) ? f.pegawaiIds.filter((x) => x !== id) : [...f.pegawaiIds, id]);

  function cocokkanTempelan() {
    const h = cocokkanDaftarPegawai(tempelan, pilihan.pegawai);
    set("pegawaiIds", [...new Set([...f.pegawaiIds, ...h.ids])]);
    const bagian = [`${h.ids.length} pegawai ditambahkan`];
    if (h.tidakKetemu.length) bagian.push(`tidak ditemukan: ${h.tidakKetemu.join(", ")}`);
    if (h.ganda.length) bagian.push(`nama ganda (pilih manual): ${h.ganda.join(", ")}`);
    setHasilTempel(bagian.join(" · "));
    if (!h.tidakKetemu.length && !h.ganda.length) setTempelan("");
  }
  function ubahTanggalTugas(r: RentangTanggal[]) {
    setF((x) => {
      // Kalimat tanggal di butir "Untuk" pertama mengikuti isian tanggal tugas.
      const untuk = x.isi.untuk.length ? [...x.isi.untuk] : [""];
      untuk[0] = pasangKalimatTanggal(untuk[0], rapikanRentang(r));
      return { ...x, tanggalTugas: r, isi: { ...x.isi, untuk } };
    });
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const isi = {
      jenis: f.jenis,
      trainingId: f.trainingId,
      hal: f.hal,
      tanggal: f.tanggal,
      tempat: f.tempat,
      sifat: f.sifat,
      keamanan: f.keamanan,
      lampiranTeks: f.lampiranTeks,
      kepada: keDaftar(f.kepadaTeks),
      tembusan: keDaftar(f.tembusanTeks),
      pegawaiIds: f.pegawaiIds,
      tanggalTugas: rapikanRentang(f.tanggalTugas),
      isi: f.isi,
      ttdJabatan: f.ttdJabatan,
      ttdNama: f.ttdNama,
      ttdNip: f.ttdNip,
      nomor: f.nomor.trim() || null,
      notaId: f.notaId,
    };
    const r = sedangUbah
      ? await kirimJson<NaskahRecord>(`/api/persuratan/naskah/${encodeURIComponent(sedangUbah)}`, "PUT", isi)
      : await kirimJson<NaskahRecord>("/api/persuratan/naskah", "POST", isi);
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    onTersimpan(f.jenis);
  }

  const Daftar = ({ k, judul, tambah, baris }: { k: "paragraf" | "dasar" | "untuk"; judul: string; tambah: string; baris: number }) => (
    <div className={LABEL}>
      <span>{judul}</span>
      {f.isi[k].map((v, i) => (
        <div key={i} className="flex gap-2">
          <textarea rows={baris} value={v} onChange={(e) => ubahDaftar(k, i, e.target.value)} className={cn(AREA, "font-normal")} />
          <Button type="button" size="sm" variant="ghost" aria-label="Hapus butir" onClick={() => buangDaftar(k, i)}>
            <X size={14} />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setIsi(k, [...f.isi[k], ""])}>
          <Plus size={14} /> {tambah}
        </Button>
      </div>
    </div>
  );

  return (
    <form onSubmit={simpan} className="flex flex-col gap-4">
      {f.suratTurunan.length ? (
        <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
          Dari nota ini sudah dibuat {f.suratTurunan.length} surat tugas: {f.suratTurunan.map((s) => s.nomor ?? "belum bernomor").join(", ")}.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {bentuk !== "surat-tugas" ? (
          <label className={cn(LABEL, "sm:col-span-3")}>
            {bentuk === "berita-acara" || bentuk === "laporan" ? "Judul" : "Hal"}
            <input value={f.hal} onChange={(e) => set("hal", e.target.value)} maxLength={300} className={cn(ISIAN, "font-normal")} />
          </label>
        ) : null}
        <label className={LABEL}>
          Tanggal
          <input type="date" required value={f.tanggal} onChange={(e) => set("tanggal", e.target.value)} className={cn(ISIAN, "font-normal")} />
        </label>
        {bentuk === "surat-tugas" || bentuk === "laporan" ? (
          <label className={LABEL}>
            Tempat penetapan
            <input value={f.tempat} onChange={(e) => set("tempat", e.target.value)} maxLength={60} className={cn(ISIAN, "font-normal")} />
          </label>
        ) : null}
        {bentuk === "nota-dinas" || bentuk === "surat-dinas" ? (
          <>
            <label className={LABEL}>
              Sifat
              <select value={f.sifat} onChange={(e) => set("sifat", e.target.value)} className={cn(ISIAN, "font-normal")}>
                {SIFAT_SURAT.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Lampiran
              <input
                value={f.lampiranTeks}
                onChange={(e) => set("lampiranTeks", e.target.value)}
                maxLength={120}
                placeholder="mis. 1 (satu) berkas"
                className={cn(ISIAN, "font-normal")}
              />
            </label>
          </>
        ) : null}
        <label className={LABEL}>
          Klasifikasi keamanan
          <select value={f.keamanan} onChange={(e) => set("keamanan", e.target.value)} className={cn(ISIAN, "font-normal")}>
            {KEAMANAN.map((k) => (
              <option key={k.kode} value={k.kode}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(LABEL, "sm:col-span-2")}>
          Nomor surat (diketik pembuat surat; boleh diisi setelah ditandatangani)
          <input value={f.nomor} onChange={(e) => set("nomor", e.target.value)} maxLength={120} className={cn(ISIAN, "font-mono font-normal")} />
        </label>
      </div>

      {bentuk === "nota-dinas" || bentuk === "surat-dinas" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            Yth. (satu tujuan per baris)
            <textarea rows={3} value={f.kepadaTeks} onChange={(e) => set("kepadaTeks", e.target.value)} className={cn(AREA, "font-normal")} />
          </label>
          <label className={LABEL}>
            Tembusan (satu per baris)
            <textarea rows={3} value={f.tembusanTeks} onChange={(e) => set("tembusanTeks", e.target.value)} className={cn(AREA, "font-normal")} />
          </label>
        </div>
      ) : null}

      {def?.pegawai ? (
        <div className={LABEL}>
          <span>
            {f.jenis === "NOTA_USULAN"
              ? `Pegawai yang diusulkan (${f.pegawaiIds.length})`
              : `Pegawai yang ditugaskan (${f.pegawaiIds.length}); lebih dari 5 orang otomatis "Daftar nama terlampir"`}
          </span>
          {f.pegawaiIds.length ? (
            <>
              <div className="flex flex-wrap gap-1.5 font-normal">
                {f.pegawaiIds.map((id) => {
                  const tb = tandaBentrok(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      title={tb ? `Bentrok: ${tb.teks}` : "Hapus dari daftar"}
                      onClick={() => togglePegawai(id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                        tb ? (tb.cegah ? "border-destructive text-destructive" : "border-warning text-warning") : "border-border",
                      )}
                    >
                      {tb ? <AlertTriangle size={12} /> : null}
                      {namaPegawai(id)} <X size={12} />
                    </button>
                  );
                })}
              </div>
              {f.pegawaiIds.map((id) => {
                const tb = tandaBentrok(id);
                return tb ? (
                  <span key={id} className={cn("text-xs font-normal", tb.cegah ? "text-destructive" : "text-warning")}>
                    {namaPegawai(id)}: {tb.teks}
                    {tb.cegah ? " (tidak bisa disimpan/dinomori)" : " (peringatan)"}
                  </span>
                ) : null;
              })}
            </>
          ) : null}
          <details className="text-xs font-normal">
            <summary className="cursor-pointer text-muted-foreground">Tempel daftar NIP/nama (dari Excel/WhatsApp)</summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                rows={4}
                value={tempelan}
                onChange={(e) => setTempelan(e.target.value)}
                placeholder="Satu NIP atau nama per baris"
                aria-label="Daftar NIP atau nama"
                className={AREA}
              />
              <div>
                <Button type="button" size="sm" variant="secondary" disabled={!tempelan.trim()} onClick={cocokkanTempelan}>
                  Cocokkan & tambahkan
                </Button>
              </div>
              {hasilTempel ? (
                <span className="text-muted-foreground" role="status">
                  {hasilTempel}
                </span>
              ) : null}
            </div>
          </details>
          <input
            value={cariPegawai}
            onChange={(e) => setCariPegawai(e.target.value)}
            placeholder="Cari nama atau jabatan…"
            aria-label="Cari pegawai"
            className={cn(ISIAN, "font-normal")}
          />
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border font-normal">
            {pegawaiTersaring.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-1 text-sm">
                <input type="checkbox" checked={f.pegawaiIds.includes(p.id)} onChange={() => togglePegawai(p.id)} />
                {p.nama} <span className="text-xs text-muted-foreground">{p.jabatan}</span>
                {f.pegawaiIds.includes(p.id) && tandaBentrok(p.id) ? <span className="text-xs text-warning">bentrok</span> : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {bentuk === "surat-tugas" ? (
        <>
          <TanggalTugasIsian rentang={f.tanggalTugas} onUbah={ubahTanggalTugas} />
          {Daftar({ k: "dasar", judul: "Dasar", tambah: "Butir dasar", baris: 2 })}
          {Daftar({ k: "untuk", judul: "Untuk", tambah: "Butir untuk", baris: 3 })}
        </>
      ) : null}

      {bentuk === "berita-acara" ? (
        <>
          <div className={LABEL}>
            <span>Para pihak</span>
            {f.isi.pihak.map((ph, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border p-2 font-normal sm:grid-cols-4">
                {(["sebutan", "jabatan", "nama", "nip"] as const).map((k) => (
                  <input
                    key={k}
                    value={ph[k]}
                    onChange={(e) =>
                      setIsi(
                        "pihak",
                        f.isi.pihak.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                      )
                    }
                    placeholder={{ sebutan: "Sebutan (Pihak Pertama)", jabatan: "Jabatan", nama: "Nama", nip: "NIP" }[k]}
                    aria-label={`${k} pihak ${i + 1}`}
                    className={ISIAN}
                  />
                ))}
                <div className="sm:col-span-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setIsi(
                        "pihak",
                        f.isi.pihak.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={14} /> Hapus pihak
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsi("pihak", [...f.isi.pihak, { sebutan: "", jabatan: "", nama: "", nip: "" }])}>
                <Plus size={14} /> Pihak
              </Button>
            </div>
          </div>
          <div className={LABEL}>
            <span>Mengetahui/Mengesahkan (opsional)</span>
            {f.isi.mengetahui ? (
              <div className="grid gap-2 font-normal sm:grid-cols-4">
                {(["jabatan", "nama", "nip"] as const).map((k) => (
                  <input
                    key={k}
                    value={f.isi.mengetahui![k]}
                    onChange={(e) => setIsi("mengetahui", { ...f.isi.mengetahui!, [k]: e.target.value })}
                    placeholder={{ jabatan: "Jabatan", nama: "Nama", nip: "NIP" }[k]}
                    aria-label={`${k} mengetahui`}
                    className={ISIAN}
                  />
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsi("mengetahui", null)}>
                  Hapus
                </Button>
              </div>
            ) : (
              <div>
                <Button type="button" size="sm" variant="secondary" onClick={() => setIsi("mengetahui", { sebutan: "", jabatan: "", nama: "", nip: "" })}>
                  <Plus size={14} /> Mengetahui
                </Button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {bentuk === "laporan" ? (
        <div className={LABEL}>
          <span>Bagian laporan (paragraf dipisah baris kosong)</span>
          {f.isi.bagian.map((b, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-2 font-normal">
              <div className="flex gap-2">
                <input
                  value={b.judul}
                  onChange={(e) =>
                    setIsi(
                      "bagian",
                      f.isi.bagian.map((x, j) => (j === i ? { ...x, judul: e.target.value } : x)),
                    )
                  }
                  placeholder="Judul bagian"
                  aria-label={`Judul bagian ${i + 1}`}
                  className={ISIAN}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Hapus bagian"
                  onClick={() =>
                    setIsi(
                      "bagian",
                      f.isi.bagian.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={14} />
                </Button>
              </div>
              <BagianTeks
                nilai={b.isi}
                onUbah={(isi) =>
                  setIsi(
                    "bagian",
                    f.isi.bagian.map((x, j) => (j === i ? { ...x, isi } : x)),
                  )
                }
                label={`Isi bagian ${i + 1}`}
              />
            </div>
          ))}
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setIsi("bagian", [...f.isi.bagian, { judul: "", isi: [] }])}>
              <Plus size={14} /> Bagian
            </Button>
          </div>
        </div>
      ) : null}

      {bentuk === "nota-dinas" || bentuk === "surat-dinas" || bentuk === "berita-acara" ? (
        <>
          {def?.acara ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <span className="text-xs text-muted-foreground sm:col-span-2">Rincian acara (tampil setelah paragraf pertama)</span>
              {!f.isi.acara ? (
                <div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setIsi("acara", { hari: "", waktu: "", tempat: "", acara: "" })}>
                    <Plus size={14} /> Rincian acara
                  </Button>
                </div>
              ) : (
                (["hari", "waktu", "tempat", "acara"] as const).map((k) => (
                  <input
                    key={k}
                    value={f.isi.acara![k]}
                    onChange={(e) => setIsi("acara", { ...f.isi.acara!, [k]: e.target.value })}
                    placeholder={{ hari: "Hari/tanggal", waktu: "Waktu", tempat: "Tempat", acara: "Acara" }[k]}
                    aria-label={{ hari: "Hari/tanggal", waktu: "Waktu", tempat: "Tempat", acara: "Acara" }[k]}
                    className={ISIAN}
                  />
                ))
              )}
            </div>
          ) : null}
          {Daftar({ k: "paragraf", judul: "Isi (per paragraf)", tambah: "Paragraf", baris: 3 })}
        </>
      ) : null}

      {f.isi.lampiran ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
          <span>
            Lampiran: {f.isi.lampiran.judul} ({f.isi.lampiran.baris.length} baris, dari data diklat)
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setIsi("lampiran", null)}>
            Hapus lampiran
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <PilihPenandatangan
          jenis={f.jenis}
          tanggal={f.tanggal}
          ttd={{ jabatan: f.ttdJabatan, nama: f.ttdNama, nip: f.ttdNip }}
          onPilih={(t) => setF((x) => ({ ...x, ttdJabatan: t.jabatan, ttdNama: t.nama, ttdNip: t.nip }))}
          className="sm:col-span-3"
        />
        <label className={cn(LABEL, "sm:col-span-3")}>
          Jabatan penanda tangan (per baris)
          <textarea rows={3} value={f.ttdJabatan} onChange={(e) => set("ttdJabatan", e.target.value)} className={cn(AREA, "font-normal")} />
        </label>
        {pilihan.pegawai.length && f.jenis !== SURAT_TUGAS ? (
          <label className={cn(LABEL, "sm:col-span-3")}>
            Pegawai lain dari Data Pegawai (mengisi nama & NIP; sesuaikan baris jabatan)
            <select
              value=""
              onChange={(e) => {
                const pg = pilihan.pegawai.find((x) => x.id === e.target.value);
                if (pg) setF((x) => ({ ...x, ttdNama: rapikanNamaSurat(pg.nama), ttdNip: pg.nip }));
              }}
              className={cn(ISIAN, "font-normal")}
            >
              <option value="">Pilih pegawai…</option>
              {pilihan.pegawai.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.nama}
                  {pg.jabatan ? ` · ${pg.jabatan}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={cn(LABEL, "sm:col-span-2")}>
          Nama penanda tangan (dengan gelar)
          <input value={f.ttdNama} onChange={(e) => set("ttdNama", e.target.value)} maxLength={150} className={cn(ISIAN, "font-normal")} />
        </label>
        <label className={LABEL}>
          NIP (pangkat dibaca dari Data Pegawai)
          <input value={f.ttdNip} onChange={(e) => set("ttdNip", e.target.value)} maxLength={30} className={cn(ISIAN, "font-mono font-normal")} />
        </label>
      </div>

      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : sedangUbah ? "Simpan perubahan" : "Simpan konsep"}
        </Button>
      </div>
    </form>
  );
}

/** Isian paragraf bagian laporan: teks bebas, dipecah per baris kosong saat disimpan (teks mentah dipertahankan saat mengetik). */
function BagianTeks({ nilai, onUbah, label }: { nilai: string[]; onUbah: (isi: string[]) => void; label: string }) {
  const [teks, setTeks] = useState(nilai.join("\n\n"));
  return (
    <textarea
      rows={4}
      value={teks}
      aria-label={label}
      onChange={(e) => {
        setTeks(e.target.value);
        onUbah(
          e.target.value
            .split(/\n\s*\n/)
            .map((x) => x.trim())
            .filter(Boolean),
        );
      }}
      className={AREA}
    />
  );
}
