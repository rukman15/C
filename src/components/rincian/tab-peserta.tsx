"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardPaste, Copy, KeyRound, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LABEL_STATUS_PESERTA, STATUS_PESERTA, parseTempelanPeserta, type StatusPeserta } from "@/lib/peserta";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { DaftarPeserta, HasilAkunPeserta, PesertaBaris } from "@/lib/data-peserta";
import type { TingkatKehadiran } from "@/lib/kehadiran";

const NADA_STATUS: Record<StatusPeserta, BadgeTone> = { AKTIF: "success", MENGUNDURKAN_DIRI: "warning", DIBERHENTIKAN: "danger" };
const TINGKAT: Record<TingkatKehadiran, { label: string; tone: BadgeTone }> = {
  aman: { label: "Aman", tone: "success" },
  peringatan: { label: "Mendekati batas", tone: "warning" },
  batas: { label: "Mencapai batas", tone: "danger" },
};

type Saring = "semua" | StatusPeserta | "tanpa-akun";

export function TabPeserta({ trainingId, data, bolehUbah }: { trainingId: string; data: DaftarPeserta; bolehUbah: boolean }) {
  const router = useRouter();
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [form, setForm] = useState<"satu" | "tempel" | null>(null);
  const [ubah, setUbah] = useState<PesertaBaris | null>(null);
  const [akun, setAkun] = useState<HasilAkunPeserta | null>(null);
  const [membuatAkun, setMembuatAkun] = useState(false);
  const [toast, setToast] = useState<{ judul: string; isi?: string } | null>(null);

  const aktif = data.peserta.filter((p) => p.status === "AKTIF");
  const tanpaAkun = aktif.filter((p) => !p.punyaAkun);
  const diBatas = aktif.filter((p) => p.rekap.tingkat === "batas").length;
  const adaRekap = data.jumlahSesiWajib > 0;

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data.peserta.filter(
      (p) =>
        (saring === "semua" || (saring === "tanpa-akun" ? !p.punyaAkun && p.status === "AKTIF" : p.status === saring)) &&
        (!q || `${p.nama} ${p.nip ?? ""} ${p.instansi ?? ""} ${p.jabatan ?? ""}`.toLowerCase().includes(q)),
    );
  }, [data.peserta, cari, saring]);

  async function buatAkun() {
    setMembuatAkun(true);
    const res = await kirimJson<HasilAkunPeserta>(`/api/training/${encodeURIComponent(trainingId)}/peserta/akun`, "POST", {});
    setMembuatAkun(false);
    if (!res.ok) return setToast({ judul: "Akun tidak dibuat", isi: res.error });
    setAkun(res.data);
    router.refresh();
  }

  async function hapus(p: PesertaBaris) {
    const res = await kirimJson(`/api/peserta/${encodeURIComponent(p.id)}`, "DELETE");
    if (!res.ok) {
      setToast({ judul: "Peserta tidak dihapus", isi: res.error });
      throw new Error(res.error);
    }
    setToast({ judul: "Peserta dihapus", isi: p.nama });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Ringkasan peserta" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Peserta aktif" value={aktif.length} suffix={" orang"} context={`${data.peserta.length} terdaftar`} />
        <MetricCard label="Belum punya akun" value={tanpaAkun.length} suffix={" orang"} context="Peserta aktif tanpa akun login" />
        <MetricCard label="Sesi wajib hadir" value={data.jumlahSesiWajib} suffix={" sesi"} context={adaRekap ? "Dasar rekap kehadiran" : "Jadwal pembelajaran belum diisi"} />
        <MetricCard
          label="Mencapai batas"
          value={diBatas}
          suffix={" orang"}
          context={data.aturan ? `Batas ${data.aturan.maksJp} JP / ${data.aturan.maksHari} hari` : "Tanpa batas ketidakhadiran"}
        />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex h-10 w-full shrink-0 items-center sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Cari peserta</span>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, NIP, atau instansi"
              className="h-10 w-full rounded-full border border-border bg-transparent pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-border-strong"
            />
          </label>
          <div className="tanpa-bilah -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <SegmentedControl
              label="Saring peserta"
              value={saring}
              onValueChange={(v) => setSaring(v as Saring)}
              options={[
                { value: "semua", label: "Semua" },
                { value: "AKTIF", label: "Aktif" },
                { value: "tanpa-akun", label: "Tanpa akun" },
                { value: "MENGUNDURKAN_DIRI", label: "Mundur" },
                { value: "DIBERHENTIKAN", label: "Diberhentikan" },
              ]}
            />
          </div>
        </div>
        {bolehUbah ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setForm("tempel")}>
              <ClipboardPaste className="size-4" aria-hidden />
              Tempel dari Excel
            </Button>
            <Button variant="secondary" onClick={() => setForm("satu")}>
              <Plus className="size-4" aria-hidden />
              Tambah
            </Button>
            {tanpaAkun.length > 0 ? (
              <Button onClick={buatAkun} disabled={membuatAkun}>
                <KeyRound className="size-4" aria-hidden />
                {membuatAkun ? "Membuat…" : `Buat akun (${tanpaAkun.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.peserta.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="Belum ada peserta"
          description={bolehUbah ? "Tambahkan satu per satu, atau tempel daftar dari Excel." : "Peserta jadwal ini belum dimasukkan."}
        />
      ) : tersaring.length === 0 ? (
        <EmptyState title="Tidak ada yang cocok" description="Ubah kata pencarian atau saringan." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-12 px-4 py-3 font-normal">No</th>
                <th className="px-4 py-3 font-normal">Peserta</th>
                <th className="px-4 py-3 font-normal">Instansi</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Tidak hadir</th>
                {bolehUbah ? <th className="px-4 py-3 text-right font-normal">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {tersaring.map((p) => (
                  <motion.tr key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-border align-top last:border-b-0">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{p.nomor}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nama}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.nip ?? "NIP belum diisi"}</p>
                      {p.jabatan ? <p className="mt-0.5 text-xs text-muted-foreground">{p.jabatan}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.instansi ?? "–"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge size="sm" tone={NADA_STATUS[p.status]} dot>
                          {LABEL_STATUS_PESERTA[p.status]}
                        </Badge>
                        {p.status === "AKTIF" && !p.punyaAkun ? (
                          <Badge size="sm" outline>
                            Belum ada akun
                          </Badge>
                        ) : null}
                      </div>
                      {p.catatan ? <p className="mt-1 max-w-48 text-xs break-words text-muted-foreground">{p.catatan}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      {!adaRekap || p.rekap.jpDicatat === 0 ? (
                        <span className="text-xs text-muted-foreground">Belum ada catatan</span>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-mono text-sm">
                            {p.rekap.jpTidakHadir} JP{p.rekap.hariTidakHadir > 0 ? ` · ${p.rekap.hariTidakHadir} hari` : ""}
                          </span>
                          {data.aturan && p.status === "AKTIF" && p.rekap.tingkat !== "aman" ? (
                            <Badge size="sm" tone={TINGKAT[p.rekap.tingkat].tone}>
                              {TINGKAT[p.rekap.tingkat].label}
                            </Badge>
                          ) : null}
                          {p.rekap.jpDispensasi > 0 ? (
                            <span className={cn("text-xs", p.rekap.dispensasiMelebihi ? "text-destructive" : "text-muted-foreground")}>
                              Dispensasi {p.rekap.jpDispensasi} JP · {p.rekap.hariDispensasi} hari{p.rekap.dispensasiMelebihi ? " — melebihi 6 hari" : ""}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    {bolehUbah ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setUbah(p)}
                            aria-label={`Ubah ${p.nama}`}
                            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <ConfirmMorph
                            label=""
                            icon={<Trash2 size={14} />}
                            prompt="Hapus?"
                            confirmLabel="Ya"
                            cancelLabel="Batal"
                            pendingLabel="Menghapus"
                            doneLabel="Dihapus"
                            errorLabel="Gagal"
                            retryLabel="Ulangi"
                            tone="danger"
                            onConfirm={() => hapus(p)}
                          />
                        </div>
                      </td>
                    ) : null}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {bolehUbah ? (
        <>
          <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
            <DialogContent
              title={form === "tempel" ? "Tempel peserta dari Excel" : "Tambah peserta"}
              description={form === "tempel" ? "Salin kolom Nama, NIP, Jabatan, Instansi dari Excel lalu tempel di sini. Kolom No dan baris judul dilewati otomatis." : undefined}
              onPointerDownOutside={(e) => e.preventDefault()}
              className="max-w-2xl"
            >
              {form === "satu" ? (
                <FormSatu trainingId={trainingId} onSelesai={(n) => (setForm(null), setToast({ judul: "Peserta ditambahkan", isi: n }))} />
              ) : form === "tempel" ? (
                <FormTempel trainingId={trainingId} onSelesai={(n) => (setForm(null), setToast({ judul: "Peserta ditambahkan", isi: `${n} peserta` }))} />
              ) : null}
            </DialogContent>
          </Dialog>
          <Dialog open={ubah !== null} onOpenChange={(o) => !o && setUbah(null)}>
            <DialogContent title="Ubah peserta" onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
              {ubah ? <FormUbah p={ubah} onSelesai={() => (setUbah(null), setToast({ judul: "Perubahan disimpan" }))} /> : null}
            </DialogContent>
          </Dialog>
          <Dialog open={akun !== null} onOpenChange={(o) => !o && setAkun(null)}>
            <DialogContent
              title="Akun peserta"
              description="Kata sandi sementara hanya tampil sekali. Bagikan kepada peserta; mereka wajib menggantinya saat pertama masuk."
              className="max-w-2xl"
            >
              {akun ? <HasilAkun h={akun} /> : null}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      <Toast title={toast?.judul ?? ""} description={toast?.isi} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function Galat({ teks }: { teks: string }) {
  return teks ? (
    <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {teks}
    </p>
  ) : null;
}

function FormSatu({ trainingId, onSelesai }: { trainingId: string; onSelesai: (nama: string) => void }) {
  const router = useRouter();
  const [isi, setIsi] = useState({ nama: "", nip: "", jabatan: "", instansi: "" });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const atur = (k: keyof typeof isi) => (v: string) => setIsi((x) => ({ ...x, [k]: v }));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!isi.nama.trim()) return setGalat("Nama wajib diisi.");
    setSibuk(true);
    const res = await kirimJson(`/api/training/${encodeURIComponent(trainingId)}/peserta`, "POST", {
      peserta: [{ nama: isi.nama, nip: isi.nip || null, jabatan: isi.jabatan || null, instansi: isi.instansi || null }],
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(isi.nama.trim());
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <Input label="Nama" value={isi.nama} onChange={atur("nama")} maxLength={150} />
      <Input label="NIP" value={isi.nip} onChange={atur("nip")} inputMode="numeric" placeholder="18 angka" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Jabatan" value={isi.jabatan} onChange={atur("jabatan")} maxLength={200} />
        <Input label="Instansi" value={isi.instansi} onChange={atur("instansi")} maxLength={200} />
      </div>
      <Galat teks={galat} />
      <div className="flex justify-end">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan peserta"}
        </Button>
      </div>
    </form>
  );
}

function FormTempel({ trainingId, onSelesai }: { trainingId: string; onSelesai: (n: number) => void }) {
  const router = useRouter();
  const [teks, setTeks] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const hasil = useMemo(() => (teks.trim() ? parseTempelanPeserta(teks) : null), [teks]);

  async function simpan() {
    if (!hasil || hasil.baris.length === 0) return;
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<{ ditambah: number }>(`/api/training/${encodeURIComponent(trainingId)}/peserta`, "POST", { peserta: hasil.baris });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(res.data.ditambah);
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        rows={7}
        placeholder={"Nama\tNIP\tJabatan\tInstansi\nBudi Santoso\t198001012005011001\tKepala Bidang\tPemkab Sumedang"}
        aria-label="Tempelan dari Excel"
        className="w-full rounded-2xl border border-border bg-transparent p-4 font-mono text-xs outline-none focus:border-border-strong"
      />
      <AnimatePresence initial={false}>
        {hasil ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3 overflow-hidden">
            <p className="text-sm">
              <span className="font-mono">{hasil.baris.length}</span> peserta siap disimpan
              {hasil.galat.length ? (
                <>
                  , <span className="font-mono text-destructive">{hasil.galat.length}</span> baris bermasalah
                </>
              ) : null}
              .
            </p>
            {hasil.galat.length ? (
              <Alert tone="warning" title="Baris bermasalah tidak ikut disimpan">
                <span className="block mt-1 max-h-28  overflow-y-auto">
                  {hasil.galat.map((g) => (
                    <span key={g.nomor} className="block before:mr-1.5 before:content-['•']">
                      Baris {g.nomor}: {g.alasan}
                    </span>
                  ))}
                </span>
              </Alert>
            ) : null}
            {hasil.baris.length ? (
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {hasil.baris.map((b, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">{b.nama}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{b.nip ?? "–"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{b.instansi ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Galat teks={galat} />
      <div className="flex justify-end">
        <Button onClick={simpan} disabled={sibuk || !hasil || hasil.baris.length === 0}>
          {sibuk ? "Menyimpan…" : `Simpan ${hasil?.baris.length ?? 0} peserta`}
        </Button>
      </div>
    </div>
  );
}

function FormUbah({ p, onSelesai }: { p: PesertaBaris; onSelesai: () => void }) {
  const router = useRouter();
  const [isi, setIsi] = useState({ nama: p.nama, nip: p.nip ?? "", jabatan: p.jabatan ?? "", instansi: p.instansi ?? "", catatan: p.catatan ?? "" });
  const [status, setStatus] = useState<StatusPeserta>(p.status);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const atur = (k: keyof typeof isi) => (v: string) => setIsi((x) => ({ ...x, [k]: v }));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    const res = await kirimJson(`/api/peserta/${encodeURIComponent(p.id)}`, "PATCH", {
      nama: isi.nama,
      nip: isi.nip || null,
      jabatan: isi.jabatan || null,
      instansi: isi.instansi || null,
      catatan: isi.catatan || null,
      status,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai();
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <Input label="Nama" value={isi.nama} onChange={atur("nama")} maxLength={150} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="NIP" value={isi.nip} onChange={atur("nip")} inputMode="numeric" />
        <Select
          label="Status"
          value={status}
          onValueChange={(v) => setStatus(v as StatusPeserta)}
          options={STATUS_PESERTA.map((s) => ({ value: s, label: LABEL_STATUS_PESERTA[s] }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Jabatan" value={isi.jabatan} onChange={atur("jabatan")} maxLength={200} />
        <Input label="Instansi" value={isi.instansi} onChange={atur("instansi")} maxLength={200} />
      </div>
      <Input label="Catatan" value={isi.catatan} onChange={atur("catatan")} maxLength={500} placeholder="mis. alasan mengundurkan diri" />
      <Galat teks={galat} />
      <div className="flex justify-end">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}

function HasilAkun({ h }: { h: HasilAkunPeserta }) {
  const [tersalin, setTersalin] = useState(false);
  const teks = h.dibuat.map((d) => `${d.nama}\t${d.nip}\t${d.sandiSementara}`).join("\n");
  return (
    <div className="flex flex-col gap-4 text-sm">
      {h.dibuat.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p>
              <span className="font-mono">{h.dibuat.length}</span> akun baru
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(`Nama\tNIP (login)\tKata sandi sementara\n${teks}`);
                setTersalin(true);
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              {tersalin ? "Tersalin" : "Salin untuk Excel"}
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Nama</th>
                  <th className="px-3 py-2 font-normal">NIP (untuk masuk)</th>
                  <th className="px-3 py-2 font-normal">Kata sandi sementara</th>
                </tr>
              </thead>
              <tbody>
                {h.dibuat.map((d) => (
                  <tr key={d.pesertaId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">{d.nama}</td>
                    <td className="px-3 py-2 font-mono">{d.nip}</td>
                    <td className="px-3 py-2 font-mono">{d.sandiSementara}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {h.ditautkan.length ? (
        <Alert tone="info" title={`${h.ditautkan.length} peserta memakai akun yang sudah ada`}>
          <span className="block mt-1">
            {h.ditautkan.map((d) => (
              <span key={d.pesertaId} className="block before:mr-1.5 before:content-['•']">
                {d.nama}: {d.keterangan}
              </span>
            ))}
          </span>
        </Alert>
      ) : null}
      {h.dilewati.length ? (
        <Alert tone="warning" title={`${h.dilewati.length} peserta dilewati`}>
          <span className="block mt-1">
            {h.dilewati.map((d) => (
              <span key={d.pesertaId} className="block before:mr-1.5 before:content-['•']">
                {d.nama}: {d.alasan}
              </span>
            ))}
          </span>
        </Alert>
      ) : null}
      {!h.dibuat.length && !h.ditautkan.length && !h.dilewati.length ? <p className="text-muted-foreground">Semua peserta aktif sudah punya akun.</p> : null}
    </div>
  );
}
