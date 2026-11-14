"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LABEL_STATUS_PENUGASAN, PERAN_ANGKATAN, type StatusPenugasan } from "@/lib/penugasan-angkatan";
import { kirimJson } from "@/lib/api-klien";
import type { BarisPenugasan, PenugasanAngkatanRecord } from "@/lib/server/repositories/penugasan-angkatan";

const NADA: Record<string, BadgeTone> = { AKTIF: "success", USULAN: "warning", DITOLAK: "danger", DICABUT: "neutral" };
const SUMBER: Record<string, string> = { KELOMPOK: "dari tab Kelompok", SEMINAR: "dari tab Seminar" };

/**
 * Tab Penugasan (EB-035, sama dengan aplikasi lama): coach, mentor, penguji aktualisasi, penguji akademik, dan pendamping
 * studi lapangan per angkatan, dengan larangan rangkap. Usulan mentor dari peserta disetujui/ditolak di sini; penugasan
 * bisa dicabut (riwayat tetap). Coach dari tab Kelompok dan penguji/mentor dari tab Seminar ikut tampil.
 */
export function TabPenugasan({ awal }: { awal: PenugasanAngkatanRecord }) {
  const [data, setData] = useState(awal);
  const [form, setForm] = useState(false);
  const [aksiBaris, setAksiBaris] = useState<{ b: BarisPenugasan; aksi: "setujui" | "tolak" | "cabut" } | null>(null);
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const url = `/api/training/${encodeURIComponent(data.training.id)}/penugasan`;
  const usulan = data.baris.filter((b) => b.status === "USULAN");
  const perPeran = PERAN_ANGKATAN.map((p) => ({ ...p, baris: data.baris.filter((b) => b.peran === p.kode && b.status !== "USULAN") })).filter((p) => p.baris.length);

  async function ubahStatus() {
    if (!aksiBaris) return;
    const { b, aksi } = aksiBaris;
    if (aksi !== "setujui" && !alasan.trim()) return setGalat("Isi alasan");
    const res = await kirimJson<PenugasanAngkatanRecord>(url, "PATCH", { id: b.id, aksi, alasan: alasan.trim() || null });
    if (!res.ok) return setGalat(res.error);
    setData(res.data);
    setAksiBaris(null);
    setAlasan("");
    setGalat("");
    setToast(aksi === "setujui" ? `${b.nama} disetujui sebagai mentor.` : aksi === "tolak" ? "Usulan ditolak." : "Penugasan dicabut.");
  }

  const baris = (b: BarisPenugasan, i: number) => (
    <li key={`${b.id ?? b.sumber}-${i}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {b.nama}
          <Badge size="sm" tone={NADA[b.status] ?? "neutral"}>
            {LABEL_STATUS_PENUGASAN[b.status as StatusPenugasan] ?? b.status}
          </Badge>
          {b.sumber !== "PENUGASAN" ? <span className="text-xs font-normal text-muted-foreground">{SUMBER[b.sumber]}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{[b.jabatan, b.instansi].filter(Boolean).join(" · ") || "—"}</p>
        <p className="text-xs text-muted-foreground">
          Lingkup: {b.lingkup}
          {b.mulai ? ` · ${b.mulai} s.d. ${b.selesai ?? "…"}` : ""}
          {b.dasar ? ` · Dasar: ${b.dasar}` : ""}
          {b.alasan ? ` · Alasan: ${b.alasan}` : ""}
        </p>
      </div>
      {data.bolehKelola && b.sumber === "PENUGASAN" ? (
        b.status === "USULAN" ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAksiBaris({ b, aksi: "setujui" })}>
              Setujui
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAksiBaris({ b, aksi: "tolak" })}>
              Tolak
            </Button>
          </div>
        ) : b.status === "AKTIF" ? (
          <Button size="sm" variant="secondary" onClick={() => setAksiBaris({ b, aksi: "cabut" })}>
            Cabut
          </Button>
        ) : null
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Coach, mentor, penguji, penguji akademik, dan pendamping studi lapangan angkatan ini. Satu orang tidak boleh merangkap coach/mentor dengan penguji pada angkatan yang
          sama.
        </p>
        {data.bolehKelola ? (
          <Button onClick={() => setForm(true)}>
            <Plus size={16} /> Tambah penugasan
          </Button>
        ) : null}
      </div>
      {galat && !aksiBaris ? <Alert tone="danger" title={galat} /> : null}
      {usulan.length ? (
        <section className="rounded-2xl border border-warning/40 p-4">
          <h2 className="font-display text-lg font-medium">
            Usulan mentor dari peserta <span className="font-mono text-sm text-muted-foreground">({usulan.length})</span>
          </h2>
          <ul className="mt-2 flex flex-col gap-2">{usulan.map(baris)}</ul>
        </section>
      ) : null}
      {!perPeran.length && !usulan.length ? (
        <EmptyState title="Belum ada penugasan" description={`Belum ada coach, mentor, atau penguji di angkatan ini.${data.bolehKelola ? " Klik Tambah penugasan." : ""}`} />
      ) : null}
      {perPeran.map((p) => (
        <section key={p.kode} className="rounded-2xl border border-border p-4">
          <h2 className="mb-2 font-display text-lg font-medium">
            {p.label} <span className="text-sm text-muted-foreground">({p.baris.filter((b) => b.status === "AKTIF").length} aktif)</span>
          </h2>
          <ul className="flex flex-col gap-2">{p.baris.map(baris)}</ul>
        </section>
      ))}

      <Dialog open={form} onOpenChange={setForm}>
        <DialogContent title="Tambah penugasan" onPointerDownOutside={(e) => e.preventDefault()} className="max-w-2xl">
          {form ? (
            <FormPenugasan
              url={url}
              data={data}
              onSelesai={(baru) => {
                setForm(false);
                if (baru) {
                  setData(baru);
                  setToast("Penugasan ditambahkan.");
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={aksiBaris !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAksiBaris(null);
            setAlasan("");
            setGalat("");
          }
        }}
      >
        <DialogContent
          title={
            aksiBaris?.aksi === "setujui"
              ? `Setujui ${aksiBaris.b.nama} sebagai mentor?`
              : aksiBaris?.aksi === "tolak"
                ? `Tolak usulan mentor ${aksiBaris?.b.nama}?`
                : `Cabut penugasan ${aksiBaris?.b.peranLabel} ${aksiBaris?.b.nama}?`
          }
          description={
            aksiBaris?.aksi === "setujui"
              ? `Diusulkan untuk ${aksiBaris.b.lingkup}.`
              : aksiBaris?.aksi === "tolak"
                ? "Alasan ditampilkan kepada peserta."
                : "Akses berhenti, riwayatnya tetap tersimpan."
          }
        >
          <div className="flex flex-col gap-3">
            {aksiBaris && aksiBaris.aksi !== "setujui" ? <Input label="Alasan" value={alasan} onChange={setAlasan} maxLength={300} /> : null}
            {galat ? <Alert tone="danger" title={galat} /> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAksiBaris(null)}>
                Batal
              </Button>
              <Button onClick={ubahStatus}>{aksiBaris?.aksi === "setujui" ? "Setujui" : aksiBaris?.aksi === "tolak" ? "Tolak" : "Cabut"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toast title="Penugasan" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormPenugasan({ url, data, onSelesai }: { url: string; data: PenugasanAngkatanRecord; onSelesai: (d: PenugasanAngkatanRecord | null) => void }) {
  const [peran, setPeran] = useState<string>("COACH");
  const [jenisOrang, setJenisOrang] = useState<"pegawai" | "luar">("pegawai");
  const [pegawaiId, setPegawaiId] = useState("");
  const [luar, setLuar] = useState({ nama: "", jabatan: "", instansi: "", email: "", ponsel: "" });
  const [kelompokIds, setKelompokIds] = useState<string[]>([]);
  const [pesertaIds, setPesertaIds] = useState<string[]>([]);
  const [periode, setPeriode] = useState({ mulai: "", selesai: "", dasar: "" });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const butuhLingkup = PERAN_ANGKATAN.find((p) => p.kode === peran)?.butuhLingkup ?? false;
  const togel = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<PenugasanAngkatanRecord>(url, "POST", {
      peran,
      pegawaiId: jenisOrang === "pegawai" ? pegawaiId || null : null,
      namaLuar: jenisOrang === "luar" ? luar.nama.trim() || null : null,
      jabatanLuar: jenisOrang === "luar" ? luar.jabatan.trim() || null : null,
      instansiLuar: jenisOrang === "luar" ? luar.instansi.trim() || null : null,
      emailLuar: jenisOrang === "luar" ? luar.email.trim() || null : null,
      ponselLuar: jenisOrang === "luar" ? luar.ponsel.trim() || null : null,
      pesertaIds,
      kelompokIds,
      mulai: periode.mulai || null,
      selesai: periode.selesai || null,
      dasar: periode.dasar.trim() || null,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    onSelesai(res.data);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <Select label="Peran" value={peran} onValueChange={setPeran} options={PERAN_ANGKATAN.map((p) => ({ value: p.kode, label: p.label }))} />
        <SegmentedControl
          label="Orang"
          value={jenisOrang}
          onValueChange={(v) => setJenisOrang(v as "pegawai" | "luar")}
          options={[
            { value: "pegawai", label: "Pegawai balai" },
            { value: "luar", label: "Orang luar balai" },
          ]}
        />
      </div>
      {jenisOrang === "pegawai" ? (
        <Select
          label="Pegawai"
          placeholder="Pilih pegawai"
          value={pegawaiId || undefined}
          onValueChange={setPegawaiId}
          options={data.pilihanPegawai.map((p) => ({ value: p.id, label: p.jabatan ? `${p.nama} · ${p.jabatan}` : p.nama }))}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nama" value={luar.nama} onChange={(v) => setLuar((x) => ({ ...x, nama: v }))} maxLength={120} />
          <Input label="Jabatan" value={luar.jabatan} onChange={(v) => setLuar((x) => ({ ...x, jabatan: v }))} maxLength={160} />
          <Input label="Instansi" value={luar.instansi} onChange={(v) => setLuar((x) => ({ ...x, instansi: v }))} maxLength={160} />
          <Input label="Email" type="email" value={luar.email} onChange={(v) => setLuar((x) => ({ ...x, email: v }))} maxLength={160} />
          <Input label="Ponsel" type="tel" value={luar.ponsel} onChange={(v) => setLuar((x) => ({ ...x, ponsel: v }))} maxLength={30} />
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted-foreground">Lingkup {butuhLingkup ? "(wajib)" : "(kosong = seluruh angkatan)"}</legend>
        {data.kelompok.length ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.kelompok.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={kelompokIds.includes(k.id)} onChange={() => togel(kelompokIds, setKelompokIds, k.id)} /> {k.label}
              </label>
            ))}
          </div>
        ) : null}
        <details className="rounded-xl border border-border p-2">
          <summary className="cursor-pointer text-sm">
            Pilih peserta (<span className="font-mono">{pesertaIds.length}</span> dipilih dari <span className="font-mono">{data.peserta.length}</span>)
          </summary>
          <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {data.peserta.map((ps) => (
              <label key={ps.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pesertaIds.includes(ps.id)} onChange={() => togel(pesertaIds, setPesertaIds, ps.id)} /> {ps.nomor}. {ps.nama}
              </label>
            ))}
          </div>
        </details>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Mulai" type="date" value={periode.mulai} onChange={(v) => setPeriode((x) => ({ ...x, mulai: v }))} />
        <Input label="Selesai" type="date" value={periode.selesai} onChange={(v) => setPeriode((x) => ({ ...x, selesai: v }))} />
        <Input label="Dasar (nomor SK/surat)" value={periode.dasar} onChange={(v) => setPeriode((x) => ({ ...x, dasar: v }))} maxLength={200} />
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => onSelesai(null)}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan penugasan"}
        </Button>
      </div>
    </form>
  );
}
