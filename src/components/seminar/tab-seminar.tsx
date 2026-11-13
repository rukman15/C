"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Landmark, Pencil, Printer, Settings2, Video } from "lucide-react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { DURASI_SEMINAR_BAWAAN, ISTIRAHAT_SEMINAR_BAWAAN, MENTOR_HADIR, STATUS_PANGGIL, jamSelesai, slotSeminar } from "@/lib/seminar";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { BarisSeminarRecord, SeminarKelompokRecord, SeminarRecord } from "@/lib/server/repositories/seminar";
import type { RekeningLengkapRecord } from "@/lib/server/repositories/rekening-mentor";
import type { StatusRekening } from "@/lib/rekening-mentor";
import { ambilJson } from "@/lib/api-klien";

const LUAR = "__luar";
const KOSONG = "__kosong";
const NADA_STATUS: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  MENUNGGU: "neutral",
  DIPANGGIL: "info",
  PRESENTASI: "warning",
  SELESAI: "success",
  TIDAK_HADIR: "danger",
};

/**
 * Tab Seminar (aplikasi lama + EB-055): seminar RAP/LAP disusun per kelompok bimbingan & seminar — kelas, 2 penguji,
 * evaluator kelas, jam per peserta (45 menit, istirahat 11.45–12.30) — lalu diterapkan ke anggotanya. Tiap peserta
 * tetap bisa disesuaikan (jam, urutan, mentor & kehadirannya). Evaluator mengubah status panggilan. Penguji hanya
 * melihat kelompok/peserta yang ia uji; pimpinan melihat saja.
 */
export function TabSeminar({ data, rekening }: { data: SeminarRecord; rekening?: Record<string, StatusRekening> | null }) {
  const router = useRouter();
  const path = usePathname();
  const [atur, setAtur] = useState<SeminarKelompokRecord | null>(null);
  const [ubah, setUbah] = useState<BarisSeminarRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rek, setRek] = useState<{ nama: string; isi: RekeningLengkapRecord | null; galat: string } | null>(null);
  const [galat, setGalat] = useState("");
  const kelola = data.bolehKelola;
  const url = `/api/training/${encodeURIComponent(data.training.id)}/seminar`;
  const tanpaKelompok = data.baris.filter((b) => !b.kelompokId || !data.kelompok.some((k) => k.kelompokId === b.kelompokId));

  async function status(b: BarisSeminarRecord, s: string) {
    if (!b.id) return;
    setGalat("");
    const res = await kirimJson(url, "POST", { id: b.id, status: s });
    if (!res.ok) return setGalat(res.error);
    router.refresh();
  }

  async function bukaRekening(b: BarisSeminarRecord) {
    setRek({ nama: b.nama, isi: null, galat: "" });
    const res = await ambilJson<RekeningLengkapRecord>(`${url}/rekening/${encodeURIComponent(b.pesertaId)}`);
    setRek({ nama: b.nama, isi: res.ok ? res.data : null, galat: res.ok ? "" : res.error });
  }
  const tombolRekening = (b: BarisSeminarRecord) => {
    const st = rekening?.[b.pesertaId];
    if (!st || st === "TIDAK_PERLU") return null;
    if (st === "BELUM" || st === "PERLU_ULANG")
      return (
        <Badge size="sm" tone="warning">
          {st === "BELUM" ? "Rekening belum diisi" : "Rekening perlu diisi ulang"}
        </Badge>
      );
    return (
      <Button size="sm" variant="ghost" onClick={() => bukaRekening(b)}>
        <Landmark size={14} /> Rekening
      </Button>
    );
  };

  const baris = (b: BarisSeminarRecord, durasi: number) => (
    <li key={b.pesertaId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{b.jamMulai ? `${b.jamMulai}` : "–"}</span>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate text-sm">
          {b.urutan ? <span className="font-mono text-muted-foreground">{b.urutan}. </span> : null}
          {b.nama}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{b.judulAksiPerubahan ?? "Judul aksi perubahan belum diisi"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          Penguji: {b.pengujiNama ?? "belum diisi"} · Mentor: {b.mentorNama ?? "belum diisi"}
          {b.mentorHadir ? ` · ${b.mentorHadir === "DARING" ? "daring (Zoom)" : "hadir langsung"}` : ""}
          {b.jamMulai ? ` · selesai ${jamSelesai(b.jamMulai, durasi)}` : ""}
        </span>
      </span>
      {tombolRekening(b)}
      {b.nilai.jumlah ? (
        <span className="font-mono text-xs text-muted-foreground" title="Aspek nilai seminar yang sudah terisi">
          {b.nilai.terisi}/{b.nilai.jumlah}
        </span>
      ) : null}
      {kelola && b.id ? (
        <select
          aria-label={`Status panggilan ${b.nama}`}
          value={b.status}
          onChange={(e) => status(b, e.target.value)}
          className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
        >
          {STATUS_PANGGIL.map((s) => (
            <option key={s.kode} value={s.kode}>
              {s.label}
            </option>
          ))}
        </select>
      ) : (
        <Badge size="sm" tone={NADA_STATUS[b.status] ?? "neutral"}>
          {b.id ? (STATUS_PANGGIL.find((s) => s.kode === b.status)?.label ?? b.status) : "Belum dijadwalkan"}
        </Badge>
      )}
      {kelola ? (
        <Button size="icon" variant="ghost" aria-label={`Ubah jadwal ${b.nama}`} onClick={() => setUbah(b)}>
          <Pencil size={14} />
        </Button>
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Jenis seminar"
          value={data.jenis}
          onValueChange={(v) => router.push(`${path}?jenis=${v}`)}
          options={[
            { value: "RAP", label: "Seminar RAP" },
            { value: "LAP", label: "Seminar LAP" },
          ]}
        />
        <ButtonLink variant="ghost" className="ml-auto" href={`/cetak/seminar/${data.training.id}?jenis=${data.jenis}`} target="_blank" rel="noopener">
          <Printer size={16} /> Cetak / PDF
        </ButtonLink>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        {data.jenis === "RAP" ? "Seminar Rancangan Aksi Perubahan" : "Seminar Laporan Implementasi Aksi Perubahan"} disusun per kelompok bimbingan & seminar (EB-055): satu kelas,
        penguji, coach, dan evaluator kelas; tiap peserta {DURASI_SEMINAR_BAWAAN} menit. Nilai diisi di tab Penilaian.
        {data.hanyaMilikSaya ? " Anda melihat peserta yang Anda uji." : ""}
      </p>
      {galat ? <Alert tone="danger" title={galat} /> : null}

      {!data.kelompok.length ? (
        <EmptyState title="Belum ada kelompok seminar" description="Bentuk kelompok bimbingan & seminar dulu di tab Kelompok; jadwal seminar disusun per kelompok." />
      ) : (
        <div className="flex flex-col gap-4">
          {data.kelompok.map((k) => {
            const anggota = data.baris.filter((b) => b.kelompokId === k.kelompokId);
            return (
              <section key={k.kelompokId} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-medium">
                      {k.label}
                      {k.ruang || k.kelas ? <span className="text-muted-foreground"> · kelas {k.ruang ?? k.kelas}</span> : null}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {k.tanggal ? <span className="font-mono">{formatTanggalId(k.tanggal)}</span> : "Tanggal belum diatur"}
                      {k.jamMulai ? (
                        <>
                          {" "}
                          · mulai <span className="font-mono">{k.jamMulai}</span> · {k.durasiMenit} menit/peserta
                        </>
                      ) : null}
                    </p>
                    <dl className="mt-2 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                      <Info label="Penguji" isi={k.pengujiNama} />
                      <Info label="Coach" isi={k.coachNama} />
                      <Info label="Evaluator" isi={k.evaluatorNama ? `${k.evaluatorNama}${k.evaluatorPonsel ? ` · ${k.evaluatorPonsel}` : ""}` : null} />
                      <Info label="Ketua" isi={k.ketuaNama} />
                    </dl>
                    {k.tautanDaring ? (
                      <a href={k.tautanDaring} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
                        <Video size={14} /> Tautan Zoom kelas
                      </a>
                    ) : null}
                  </div>
                  {kelola ? (
                    <Button size="sm" variant="secondary" onClick={() => setAtur(k)}>
                      <Settings2 size={14} /> Atur kelompok
                    </Button>
                  ) : null}
                </div>
                {anggota.length ? (
                  <ul className="mt-3 divide-y divide-border border-t border-border">{anggota.map((b) => baris(b, k.durasiMenit))}</ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Belum ada anggota aktif.</p>
                )}
              </section>
            );
          })}
          {tanpaKelompok.length ? (
            <section className="rounded-2xl border border-dashed border-border p-4">
              <h2 className="text-sm font-medium">Belum masuk kelompok seminar · {tanpaKelompok.length}</h2>
              <ul className="mt-2 divide-y divide-border">{tanpaKelompok.map((b) => baris(b, DURASI_SEMINAR_BAWAAN))}</ul>
            </section>
          ) : null}
        </div>
      )}

      <Dialog open={atur !== null} onOpenChange={(o) => !o && setAtur(null)}>
        <DialogContent title={atur ? `Atur seminar ${data.jenis} ${atur.label}` : "Atur kelompok"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {atur ? (
            <FormKelompok
              key={atur.kelompokId}
              url={`${url}/kelompok`}
              data={data}
              k={atur}
              jumlah={data.baris.filter((b) => b.kelompokId === atur.kelompokId).length}
              onSelesai={(p) => {
                setAtur(null);
                if (p) setToast(p);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={ubah !== null} onOpenChange={(o) => !o && setUbah(null)}>
        <DialogContent title={ubah ? `Jadwal ${ubah.nama}` : "Jadwal peserta"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {ubah ? (
            <FormPeserta
              key={ubah.pesertaId}
              url={url}
              jenis={data.jenis}
              b={ubah}
              penguji={data.pilihanPenguji}
              onSelesai={(p) => {
                setUbah(null);
                if (p) setToast(p);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={rek !== null} onOpenChange={(o) => !o && setRek(null)}>
        <DialogContent
          title={rek ? `Rekening mentor ${rek.nama}` : "Rekening mentor"}
          description="Pembukaan ini tercatat di Log Audit. Jangan disalin ke tempat lain selain keperluan honor."
        >
          {rek?.galat ? <Alert tone="danger" title={rek.galat} /> : null}
          {rek?.isi ? (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Mentor</dt>
              <dd>{rek.isi.mentorNama}</dd>
              <dt className="text-muted-foreground">Bank</dt>
              <dd>{rek.isi.namaBank}</dd>
              <dt className="text-muted-foreground">Nomor rekening</dt>
              <dd className="font-mono select-all">{rek.isi.nomorRekening}</dd>
              <dt className="text-muted-foreground">Atas nama</dt>
              <dd>{rek.isi.atasNama}</dd>
              <dt className="text-muted-foreground">HP mentor</dt>
              <dd className="font-mono">{rek.isi.ponsel}</dd>
            </dl>
          ) : !rek?.galat ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : null}
          {rek?.isi && !rek.isi.berlaku ? <Alert tone="warning" title="Milik mentor sebelumnya; peserta perlu mengisi ulang." /> : null}
        </DialogContent>
      </Dialog>
      <Toast title="Seminar" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function Info({ label, isi }: { label: string; isi: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0", !isi && "text-muted-foreground")}>{isi ?? "belum diisi"}</dd>
    </div>
  );
}

function Galat({ teks }: { teks: string }) {
  return teks ? <Alert tone="danger" title={teks} /> : null;
}

function FormKelompok({ url, data, k, jumlah, onSelesai }: { url: string; data: SeminarRecord; k: SeminarKelompokRecord; jumlah: number; onSelesai: (p: string) => void }) {
  const router = useRouter();
  const pilihan = (id: string | null, nama: string | null) => (id ? id : nama ? LUAR : "");
  const [f, setF] = useState({
    tanggal: k.tanggal ?? "",
    jamMulai: k.jamMulai ?? "08:00",
    durasi: String(k.durasiMenit),
    istirahat: k.id ? !!k.istirahatMulai : true,
    istirahatMulai: k.istirahatMulai ?? ISTIRAHAT_SEMINAR_BAWAAN.mulai,
    istirahatSelesai: k.istirahatSelesai ?? ISTIRAHAT_SEMINAR_BAWAAN.selesai,
    ruang: k.ruang ?? k.kelas ?? "",
    tautan: k.tautanDaring ?? "",
    p1: pilihan(k.pengujiPegawaiId, k.pengujiNama),
    p1Nama: k.pengujiPegawaiId ? "" : (k.pengujiNama ?? ""),
    evaluator: k.evaluatorNama ?? "",
    evaluatorPonsel: k.evaluatorPonsel ?? "",
  });
  const [terapkan, setTerapkan] = useState(true);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (kunci: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [kunci]: v }));
  const durasi = Number(f.durasi) || 0;
  const slot = slotSeminar(f.jamMulai, durasi, jumlah, f.istirahat ? { mulai: f.istirahatMulai, selesai: f.istirahatSelesai } : null);
  const akhir = slot.filter(Boolean).pop();
  const opsiPenguji = [
    { value: KOSONG, label: "Belum ditentukan" },
    ...data.pilihanPenguji.map((p) => ({ value: p.id, label: p.nama })),
    { value: LUAR, label: "Penguji dari luar balai…" },
  ];

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<{ diterapkan: number }>(url, "POST", {
      jenis: data.jenis,
      kelompokId: k.kelompokId,
      terapkan,
      tanggal: f.tanggal || null,
      jamMulai: f.jamMulai || null,
      durasiMenit: durasi || null,
      istirahatMulai: f.istirahat ? f.istirahatMulai : null,
      istirahatSelesai: f.istirahat ? f.istirahatSelesai : null,
      ruang: f.ruang.trim() || null,
      tautanDaring: f.tautan.trim() || null,
      pengujiPegawaiId: f.p1 && f.p1 !== LUAR && f.p1 !== KOSONG ? f.p1 : null,
      pengujiNama: f.p1 === LUAR ? f.p1Nama.trim() || null : null,
      evaluatorNama: f.evaluator.trim() || null,
      evaluatorPonsel: f.evaluatorPonsel.trim() || null,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(terapkan ? `${k.label}: jadwal ${res.data.diterapkan} peserta diperbarui.` : `${k.label} disimpan.`);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Tanggal" type="date" value={f.tanggal} onChange={set("tanggal")} />
        <Input label="Jam mulai" type="time" value={f.jamMulai} onChange={set("jamMulai")} />
        <Input label="Menit per peserta" type="number" inputMode="numeric" value={f.durasi} onChange={set("durasi")} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.istirahat} onChange={(e) => setF((x) => ({ ...x, istirahat: e.target.checked }))} />
        Ada istirahat
      </label>
      {f.istirahat ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Istirahat mulai" type="time" value={f.istirahatMulai} onChange={set("istirahatMulai")} />
          <Input label="Istirahat selesai" type="time" value={f.istirahatSelesai} onChange={set("istirahatSelesai")} />
        </div>
      ) : null}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={13} />
        {jumlah && slot[0] && akhir ? (
          <>
            {jumlah} peserta: <span className="font-mono">{slot[0].mulai}</span>–<span className="font-mono">{akhir.selesai}</span>
          </>
        ) : (
          "Isi jam mulai untuk melihat perkiraan selesai."
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Kelas/ruang" value={f.ruang} onChange={set("ruang")} maxLength={100} placeholder="mis. E" />
        <Input label="Tautan Zoom (bila daring)" value={f.tautan} onChange={set("tautan")} maxLength={500} inputMode="url" placeholder="https://zoom.us/j/…" />
      </div>
      <div className="flex flex-col gap-2">
        <Select label="Penguji kelas" value={f.p1 || KOSONG} onValueChange={(v) => set("p1")(v === KOSONG ? "" : v)} options={opsiPenguji} />
        {f.p1 === LUAR ? <Input label="Nama penguji" value={f.p1Nama} onChange={set("p1Nama")} maxLength={150} /> : null}
        <p className="text-xs text-muted-foreground">
          Tiap peserta 1 penguji, 1 mentor, 1 coach. Penguji ini dipakai semua anggota; bila ada peserta yang diuji orang lain, ganti di jadwal peserta itu.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Evaluator kelas" value={f.evaluator} onChange={set("evaluator")} maxLength={150} />
        <Input label="Nomor HP evaluator" value={f.evaluatorPonsel} onChange={set("evaluatorPonsel")} maxLength={20} inputMode="tel" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={terapkan} onChange={(e) => setTerapkan(e.target.checked)} />
        <span>
          Terapkan ke {jumlah} anggota: tanggal, jam berurutan, kelas, tautan, penguji, dan evaluator. Penguji yang sudah diganti per peserta, mentor, dan status panggilan tidak
          berubah.
        </span>
      </label>
      <Galat teks={galat} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai("")}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function FormPeserta({
  url,
  jenis,
  b,
  penguji,
  onSelesai,
}: {
  url: string;
  jenis: string;
  b: BarisSeminarRecord;
  penguji: { id: string; nama: string }[];
  onSelesai: (p: string) => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    tanggal: b.tanggal ?? "",
    jamMulai: b.jamMulai ?? "",
    urutan: b.urutan != null ? String(b.urutan) : "",
    mentorNama: b.mentorNama ?? "",
    mentorJabatan: b.mentorJabatan ?? "",
    mentorHadir: b.mentorHadir ?? "",
    penguji: b.pengujiPegawaiId ?? (b.pengujiNama ? LUAR : ""),
    pengujiNama: b.pengujiPegawaiId ? "" : (b.pengujiNama ?? ""),
  });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (kunci: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [kunci]: v }));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const res = await kirimJson(url, "PUT", {
      jenis,
      isian: [
        {
          pesertaId: b.pesertaId,
          tanggal: f.tanggal || null,
          jamMulai: f.jamMulai || null,
          urutan: f.urutan ? Number(f.urutan) : null,
          ruang: b.ruang,
          tautanDaring: b.tautanDaring,
          pengujiPegawaiId: f.penguji && f.penguji !== LUAR ? f.penguji : null,
          pengujiNama: f.penguji === LUAR ? f.pengujiNama.trim() || null : null,
          mentorNama: f.mentorNama.trim() || null,
          mentorJabatan: f.mentorJabatan.trim() || null,
          mentorHadir: f.mentorHadir || null,
          evaluatorNama: b.evaluatorNama,
        },
      ],
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(`Jadwal ${b.nama} disimpan.`);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Tanggal" type="date" value={f.tanggal} onChange={set("tanggal")} />
        <Input label="Jam" type="time" value={f.jamMulai} onChange={set("jamMulai")} />
        <Input label="Urutan" type="number" inputMode="numeric" value={f.urutan} onChange={set("urutan")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nama mentor" value={f.mentorNama} onChange={set("mentorNama")} maxLength={150} />
        <Input label="Jabatan/instansi mentor" value={f.mentorJabatan} onChange={set("mentorJabatan")} maxLength={150} />
      </div>
      <Select
        label="Kehadiran mentor"
        value={f.mentorHadir || KOSONG}
        onValueChange={(v) => set("mentorHadir")(v === KOSONG ? "" : v)}
        options={[{ value: KOSONG, label: "Belum dikonfirmasi" }, ...MENTOR_HADIR.map((m) => ({ value: m.kode, label: m.label }))]}
      />
      <div className="flex flex-col gap-2">
        <Select
          label="Penguji"
          value={f.penguji || KOSONG}
          onValueChange={(v) => set("penguji")(v === KOSONG ? "" : v)}
          options={[
            { value: KOSONG, label: "Belum ditentukan" },
            ...(b.pengujiPegawaiId && !penguji.some((p) => p.id === b.pengujiPegawaiId) ? [{ value: b.pengujiPegawaiId, label: b.pengujiNama ?? "Penguji" }] : []),
            ...penguji.map((p) => ({ value: p.id, label: p.nama })),
            { value: LUAR, label: "Penguji dari luar balai…" },
          ]}
        />
        {f.penguji === LUAR ? <Input label="Nama penguji" value={f.pengujiNama} onChange={set("pengujiNama")} maxLength={150} /> : null}
      </div>
      <p className="text-xs text-muted-foreground">Satu peserta satu penguji. Kelas, tautan, dan evaluator mengikuti pengaturan kelompok.</p>
      <Galat teks={galat} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai("")}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
