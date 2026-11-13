"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, ClipboardList, ClipboardPaste, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Badge } from "@/components/arc/badge/badge";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { JENIS_MASA_TEMPAT_KERJA, labelBentuk, type JenisMasaTempatKerja } from "@/lib/kehadiran";
import { formatTanggalId, totalJp } from "@/lib/sesi";
import { dariIso, keIso } from "@/lib/jadwal";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import { sesiPerHari, type JadwalPembelajaran, type SesiPembelajaran } from "@/lib/data-pembelajaran";
import { FormSesi, FormTempel, Galat } from "./form-sesi";
import { LembarKehadiranLaci } from "./lembar-kehadiran";

type Saring = "semua" | "belum" | "lengkap";
const namaHari = (iso: string) => new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { weekday: "long", timeZone: "UTC" });
const daftarTanggal = (t: string[], maks = 8) => `${t.slice(0, maks).map(formatTanggalId).join(", ")}${t.length > maks ? ", …" : ""}`;

/**
 * Tab Jadwal & Absensi. Sama dengan halaman absensi aplikasi lama: jadwal per hari, rekap kehadiran per sesi,
 * peringatan presensi harian, masa di tempat kerja, lembar kehadiran. Dibaca Ketua Diklat dan Kepala Balai,
 * diubah Ketua Diklat (admin selalu boleh). Jadwal ini terpisah dari sesi mengajar WI.
 */
export function TabAbsensi({ data, bolehAtur }: { data: JadwalPembelajaran; bolehAtur: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<"satu" | "tempel" | null>(null);
  const [ubah, setUbah] = useState<SesiPembelajaran | null>(null);
  const [lembar, setLembar] = useState<SesiPembelajaran | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const [toast, setToast] = useState<{ judul: string; isi?: string } | null>(null);

  const sesi = data.sesi;
  const jpWajib = totalJp(sesi.filter((s) => s.wajibHadir));
  const sesiBelum = sesi.filter((s) => s.belumDicatat > 0).length;
  const hari = useMemo(() => {
    const pilih = sesi.filter((s) => saring === "semua" || (saring === "belum" ? s.belumDicatat > 0 : s.belumDicatat === 0));
    return sesiPerHari(pilih);
  }, [sesi, saring]);
  const jumlahHari = useMemo(() => new Set(sesi.map((s) => s.tanggal)).size, [sesi]);

  async function hapus(s: SesiPembelajaran) {
    const res = await kirimJson(`/api/pembelajaran/${encodeURIComponent(s.id)}`, "DELETE");
    if (!res.ok) {
      setToast({ judul: "Sesi tidak dihapus", isi: res.error });
      throw new Error(res.error);
    }
    setToast({ judul: "Sesi dihapus", isi: s.kegiatan });
    router.refresh();
  }

  const tutupForm = (pesan: string) => {
    setForm(null);
    setUbah(null);
    if (pesan) setToast({ judul: "Jadwal diperbarui", isi: pesan });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Ringkasan jadwal" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sesi pembelajaran" value={sesi.length} suffix={"\u00a0sesi"} context={`Dalam ${jumlahHari} hari`} />
        <MetricCard label="JP dengan absensi" value={jpWajib} suffix={" JP"} context={`${totalJp(sesi)} JP seluruhnya`} />
        <MetricCard label="Peserta aktif" value={data.pesertaAktif} suffix={"\u00a0orang"} context="Dicatat di setiap sesi" />
        <MetricCard label="Sesi belum lengkap" value={data.pesertaAktif ? sesiBelum : 0} suffix={"\u00a0sesi"} context="Presensinya masih kurang" />
      </section>

      {data.presensiBelumLengkap.length ? (
        <Alert tone="warning" title={`Presensi belum lengkap pada ${data.presensiBelumLengkap.length} hari`}>
          {daftarTanggal(data.presensiBelumLengkap)}.
        </Alert>
      ) : null}
      {data.presensiTanpaSesi.length ? (
        <Alert tone="warning" title={`${data.presensiTanpaSesi.length} hari kerja belum punya sesi`}>
          {daftarTanggal(data.presensiTanpaSesi, 10)}. Presensi tidak bisa dicatat. Tambahkan sesinya, atau tandai sebagai masa di tempat kerja bila peserta sedang komitmen bersama atau aktualisasi.
        </Alert>
      ) : null}

      <MasaTempatKerjaPanel data={data} bolehAtur={bolehAtur} onGalat={(isi) => setToast({ judul: "Masa di tempat kerja", isi })} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Saring sesi"
          value={saring}
          onValueChange={(v) => setSaring(v as Saring)}
          options={[
            { value: "semua", label: "Semua" },
            { value: "belum", label: "Belum lengkap" },
            { value: "lengkap", label: "Lengkap" },
          ]}
        />
        {bolehAtur ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setForm("tempel")}>
              <ClipboardPaste size={16} /> Tempel dari Excel
            </Button>
            <Button onClick={() => setForm("satu")}>
              <Plus size={16} /> Tambah sesi
            </Button>
          </div>
        ) : null}
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">Presensi dicatat untuk semua sesi. Sesi e-learning asinkron dan mandiri tidak dihitung dalam batas ketidakhadiran. Jadwal ini terpisah dari sesi mengajar WI.</p>

      {sesi.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="Belum ada jadwal pembelajaran"
          description={bolehAtur ? "Tambahkan sesi satu per satu atau tempel dari Excel." : "Ketua Diklat belum menyusun jadwalnya."}
        />
      ) : hari.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada sesi yang cocok dengan saringan.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <AnimatePresence initial={false}>
            {hari.map((h) => (
              <motion.section key={h.tanggal} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  <span>{`${namaHari(h.tanggal)}, ${formatTanggalId(h.tanggal)}`}</span>
                  <span className="font-mono text-xs text-muted-foreground">{h.jp} JP</span>
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {h.sesi.map((s) => (
                    <BarisSesi key={s.id} s={s} pesertaAktif={data.pesertaAktif} bolehAtur={bolehAtur} onLembar={() => setLembar(s)} onUbah={() => setUbah(s)} onHapus={() => hapus(s)} />
                  ))}
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}

      {bolehAtur ? (
        <Dialog open={form !== null || ubah !== null} onOpenChange={(o) => !o && tutupForm("")}>
          <DialogContent
            title={ubah ? "Ubah sesi" : form === "tempel" ? "Tempel jadwal dari Excel" : "Tambah sesi"}
            description={form === "tempel" ? "Kolom: Tanggal, Kegiatan, JP, Keterangan (opsional). Pisahkan dengan Tab, | atau ;. Baris judul dilewati otomatis." : undefined}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="max-w-2xl"
          >
            {ubah ? (
              <FormSesi key={ubah.id} data={data} ubah={ubah} onSelesai={tutupForm} onTambah={() => {}} />
            ) : form === "satu" ? (
              <FormSesi data={data} ubah={null} onSelesai={tutupForm} onTambah={(isi) => setToast({ judul: "Sesi ditambahkan", isi })} />
            ) : form === "tempel" ? (
              <FormTempel data={data} onSelesai={tutupForm} />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <LembarKehadiranLaci
        sesi={lembar}
        bolehAtur={bolehAtur}
        onTutup={() => setLembar(null)}
        onTersimpan={(isi) => {
          setLembar(null);
          setToast({ judul: "Kehadiran disimpan", isi });
        }}
      />
      <Toast title={toast?.judul ?? ""} description={toast?.isi} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function RekapSesi({ s, pesertaAktif }: { s: SesiPembelajaran; pesertaAktif: number }) {
  const dicatat = s.hadir + s.tidakHadir + s.dispensasi;
  if (pesertaAktif === 0 && s.jumlahCatatan === 0) return <span className="text-xs text-muted-foreground">Belum ada peserta</span>;
  if (dicatat === 0)
    return (
      <Badge size="sm" tone="warning" dot>
        Belum dicatat
      </Badge>
    );
  const total = Math.max(1, dicatat + s.belumDicatat);
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-48">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="bg-success" style={{ width: `${(s.hadir / total) * 100}%` }} />
        <span className="bg-warning" style={{ width: `${(s.dispensasi / total) * 100}%` }} />
        <span className="bg-destructive" style={{ width: `${(s.tidakHadir / total) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-success">{s.hadir}</span> hadir
        {s.tidakHadir ? (
          <>
            {" · "}
            <span className="font-mono text-destructive">{s.tidakHadir}</span> tidak
          </>
        ) : null}
        {s.dispensasi ? (
          <>
            {" · "}
            <span className="font-mono text-warning">{s.dispensasi}</span> disp.
          </>
        ) : null}
        {s.belumDicatat ? (
          <>
            {" · "}
            <span className="font-mono">{s.belumDicatat}</span> belum
          </>
        ) : null}
      </p>
    </div>
  );
}

function BarisSesi({ s, pesertaAktif, bolehAtur, onLembar, onUbah, onHapus }: { s: SesiPembelajaran; pesertaAktif: number; bolehAtur: boolean; onLembar: () => void; onUbah: () => void; onHapus: () => Promise<void> }) {
  const bisaDibuka = pesertaAktif > 0 || s.jumlahCatatan > 0;
  return (
    <li className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{s.jamMulai ?? "–"}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{s.kegiatan}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{s.jp} JP</span>
            <Badge size="sm" tone={s.wajibHadir ? "neutral" : "info"}>
              {labelBentuk(s.bentuk)}
            </Badge>
            {s.mataPelatihanNama && s.mataPelatihanNama !== s.kegiatan ? <span>{s.mataPelatihanNama}</span> : null}
            {s.pengampu?.length ? <span>· {s.pengampu.join(", ")}</span> : null}
            {s.ruang ? <span>· {s.ruang}</span> : null}
            {s.keterangan ? <span>· {s.keterangan}</span> : null}
            {s.tautan ? (
              <a href={s.tautan} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Tautan rapat <ExternalLink size={12} />
              </a>
            ) : null}
            {s.diluarPeriode ? (
              <Badge size="sm" tone="warning">
                Di luar periode pelatihan
              </Badge>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:pl-15 lg:pl-0">
        <RekapSesi s={s} pesertaAktif={pesertaAktif} />
        {bisaDibuka ? (
          <Button size="sm" variant={bolehAtur ? "secondary" : "ghost"} onClick={onLembar}>
            <ClipboardList size={14} /> {bolehAtur ? "Absensi" : "Lihat"}
          </Button>
        ) : null}
        {bolehAtur ? (
          <>
            <Button size="sm" variant="ghost" onClick={onUbah} aria-label={`Ubah ${s.kegiatan}`}>
              <Pencil size={14} />
            </Button>
            <ConfirmMorph
              label="Hapus"
              icon={<Trash2 size={14} />}
              prompt="Hapus sesi ini?"
              confirmLabel="Ya, hapus"
              cancelLabel="Batal"
              pendingLabel="Menghapus"
              doneLabel="Dihapus"
              errorLabel="Gagal"
              retryLabel="Coba lagi"
              tone="danger"
              onConfirm={onHapus}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

/** Masa di tempat kerja: hari di dalamnya tidak diperiksa "tanpa sesi". Diisi Ketua Diklat (admin selalu boleh). */
function MasaTempatKerjaPanel({ data, bolehAtur, onGalat }: { data: JadwalPembelajaran; bolehAtur: boolean; onGalat: (pesan: string) => void }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [jenis, setJenis] = useState<JenisMasaTempatKerja>("AKTUALISASI");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const url = `/api/training/${encodeURIComponent(data.training.id)}/masa-tempat-kerja`;
  if (!data.masaTempatKerja.length && !bolehAtur) return null;

  async function tambah(e: FormEvent) {
    e.preventDefault();
    if (!mulai || !selesai) return setGalat("Pilih tanggal mulai dan selesai.");
    setSibuk(true);
    const res = await kirimJson(url, "POST", { aksi: "tambah", jenis, mulai, selesai });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    setGalat("");
    setBuka(false);
    setMulai("");
    setSelesai("");
    router.refresh();
  }
  async function hapus(id: string) {
    setSibuk(true);
    const res = await kirimJson(url, "POST", { aksi: "hapus", id });
    setSibuk(false);
    if (!res.ok) return onGalat(res.error);
    router.refresh();
  }

  const min = dariIso(data.training.startDate);
  const max = data.training.endDate ? dariIso(data.training.endDate) : undefined;
  return (
    <section className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Masa di tempat kerja</span>
        <span className="text-xs text-muted-foreground">tidak diperiksa presensi harian</span>
        <div className="flex flex-wrap gap-1.5 sm:ml-2">
          {data.masaTempatKerja.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs">
              {m.label}: <span className="font-mono">{formatTanggalId(m.mulai)} – {formatTanggalId(m.selesai)}</span>
              {bolehAtur ? (
                <button type="button" disabled={sibuk} onClick={() => hapus(m.id)} aria-label={`Hapus ${m.label}`} className="text-muted-foreground hover:text-destructive">
                  <X size={12} />
                </button>
              ) : null}
            </span>
          ))}
          {!data.masaTempatKerja.length ? <span className="text-xs text-muted-foreground">Belum diisi.</span> : null}
        </div>
        {bolehAtur && !buka ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setBuka(true)}>
            <Plus size={14} /> Tambah
          </Button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {buka ? (
          <motion.form onSubmit={tambah} noValidate initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="grid gap-3 pt-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
              <Select label="Jenis" value={jenis} onValueChange={(v) => setJenis(v as JenisMasaTempatKerja)} options={JENIS_MASA_TEMPAT_KERJA.map((j) => ({ value: j.value, label: j.label }))} />
              <DatePicker label="Mulai" value={dariIso(mulai)} onChange={(d) => setMulai(d ? keIso(d) : "")} minDate={min} maxDate={max} locale="id-ID" />
              <DatePicker label="Selesai" value={dariIso(selesai)} onChange={(d) => setSelesai(d ? keIso(d) : "")} minDate={dariIso(mulai) ?? min} maxDate={max} locale="id-ID" />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => (setBuka(false), setGalat(""))}>
                  Batal
                </Button>
                <Button type="submit" disabled={sibuk}>
                  Simpan
                </Button>
              </div>
            </div>
            <div className={cn(galat && "pt-3")}>
              <Galat teks={galat} />
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
