"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { labelPangkat, type StatusRegistrasi } from "@/lib/registrasi";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";

type Registrasi = {
  id: string;
  status: StatusRegistrasi;
  username: string | null;
  email: string;
  nama: string;
  nip: string;
  provinsi: string;
  kabKota: string;
  instansi: string;
  unitOrganisasi: string;
  unitKerja: string | null;
  golongan: string;
  jabatan: string;
  telepon: string | null;
  ponsel: string;
  alamat: string;
  diajukan: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
};
const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/**
 * Registrasi Peserta (admin & Ketua Diklat), sama dengan aplikasi lama: periksa pendaftaran mandiri. Setujui = akun aktif;
 * Tolak = akun & data pendaftar dihapus (alasan di Log Audit, boleh mendaftar ulang).
 */
export function RegistrasiPeserta() {
  const [status, setStatus] = useState<StatusRegistrasi>("MENUNGGU");
  const [data, setData] = useState<Registrasi[] | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [aksi, setAksi] = useState<{ r: Registrasi; jenis: "setujui" | "tolak" } | null>(null);
  const [alasan, setAlasan] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const muat = async (s: StatusRegistrasi) => {
    setData(null);
    const r = await ambilJson<Registrasi[]>(`/api/registrasi?status=${s}`);
    if (r.ok) setData(r.data);
    else setGalat(r.error);
  };
  useEffect(() => {
    muat(status);
  }, [status]);
  const q = cari.trim().toLowerCase();
  const tampil = (data ?? []).filter(
    (r) => !q || [r.nama, r.nip, r.username ?? "", r.email, r.instansi, r.unitOrganisasi, r.jabatan, r.kabKota].some((v) => v.toLowerCase().includes(q)),
  );

  async function putuskan() {
    if (!aksi) return;
    const { r, jenis } = aksi;
    const res = await kirimJson(`/api/registrasi/${encodeURIComponent(r.id)}`, "PATCH", jenis === "tolak" ? { aksi: jenis, alasan: alasan.trim() } : { aksi: jenis });
    setAksi(null);
    setAlasan("");
    if (!res.ok) return setGalat(res.error);
    setToast(`${r.nama}: registrasi ${jenis === "setujui" ? "disetujui" : "ditolak"}.`);
    muat(status);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Status"
          value={status}
          onValueChange={(v) => setStatus(v as StatusRegistrasi)}
          options={[
            { value: "MENUNGGU", label: "Menunggu" },
            { value: "DISETUJUI", label: "Disetujui" },
          ]}
        />
        <div className="min-w-56 flex-1">
          <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama, NIP, instansi, jabatan…" leftIcon={<Search size={16} />} />
        </div>
      </div>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {!data ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : !tampil.length ? (
        <EmptyState
          title={status === "MENUNGGU" ? "Tidak ada registrasi yang menunggu" : "Belum ada registrasi yang disetujui"}
          description="Pendaftaran mandiri dari halaman /registrasi tampil di sini."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tampil.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={buka === r.id} onClick={() => setBuka(buka === r.id ? null : r.id)}>
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    {r.nama} <ChevronDown size={14} className={cn("shrink-0 transition-transform", buka === r.id && "rotate-180")} />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    NIP <span className="font-mono">{r.nip}</span> · {r.jabatan} · {r.instansi}
                  </p>
                </button>
                <span className="text-xs text-muted-foreground">
                  {r.status === "MENUNGGU" ? `Diajukan ${waktu(r.diajukan)}` : `Disetujui ${r.diputuskanPada ? waktu(r.diputuskanPada) : ""} oleh ${r.diputuskanOleh ?? "—"}`}
                </span>
                {r.status === "MENUNGGU" ? (
                  <>
                    <Button size="sm" onClick={() => setAksi({ r, jenis: "setujui" })}>
                      Setujui
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAksi({ r, jenis: "tolak" })}>
                      Tolak
                    </Button>
                  </>
                ) : null}
              </div>
              {buka === r.id ? (
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                  {(
                    [
                      ["Nama pengguna", r.username ?? "—"],
                      ["Surel", r.email],
                      ["Pangkat/golongan", labelPangkat(r.golongan)],
                      ["Wilayah", `${r.kabKota}, ${r.provinsi}`],
                      ["OPD / unit organisasi", r.unitOrganisasi],
                      ["Unit kerja", r.unitKerja ?? "—"],
                      ["Ponsel", r.ponsel],
                      ["Telepon", r.telepon ?? "—"],
                      ["Alamat", r.alamat],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-36 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className="min-w-0 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={aksi !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAksi(null);
            setAlasan("");
          }
        }}
      >
        <DialogContent
          title={aksi?.jenis === "setujui" ? `Setujui registrasi ${aksi.r.nama}?` : `Tolak registrasi ${aksi?.r.nama}?`}
          description={aksi?.jenis === "setujui" ? `NIP ${aksi.r.nip}. Akunnya langsung bisa dipakai masuk.` : "Akun dan datanya dihapus; pendaftar boleh mendaftar ulang."}
        >
          <div className="flex flex-col gap-3">
            {aksi?.jenis === "tolak" ? <Input label="Alasan (dicatat di Log Audit)" value={alasan} onChange={setAlasan} maxLength={500} /> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAksi(null)}>
                Batal
              </Button>
              <Button disabled={aksi?.jenis === "tolak" && !alasan.trim()} onClick={putuskan}>
                {aksi?.jenis === "setujui" ? "Setujui" : "Tolak"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toast title="Registrasi" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
