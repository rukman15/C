"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings2 } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ambilJson, kirimJson } from "@/lib/api-klien";

type PeranTim = "ketua" | "anggota";
type Tim = { id: string; nama: string };
type Pegawai = { id: string; nama: string; nip: string | null; jabatan: string | null; role: string | null; timKerja: (Tim & { peran: PeranTim })[] };
type Data = { pegawai: Pegawai[]; timKerja: Tim[] };

const PERAN = [
  { id: "peserta", label: "Pegawai umum / peserta" },
  { id: "pamdal", label: "Pamdal" },
  { id: "keuangan", label: "Keuangan" },
  { id: "kepegawaian", label: "Kepegawaian" },
  { id: "ketua-diklat", label: "Ketua Tim Diklat" },
  { id: "widyaiswara", label: "Widyaiswara" },
  { id: "kepala-balai", label: "Kepala Balai" },
  { id: "kabag-tu", label: "Kepala Bagian Tata Usaha (lihat saja)" },
  { id: "admin", label: "Administrator sistem" },
];
const TANPA = "__tanpa";
/** Nomenklatur Permendagri 11/2025 (Organisasi & Tata Kerja UPT BPSDM). */
const JABATAN = [
  "Kepala Balai Besar Pengembangan Kompetensi Aparatur Pemerintahan Dalam Negeri II",
  "Kepala Bagian Tata Usaha",
  "Kepala Subbagian Program, Data, Pelaporan dan Keuangan",
  "Kepala Subbagian Sumber Daya Manusia dan Umum",
  "Widyaiswara Ahli Utama",
  "Widyaiswara Ahli Madya",
  "Widyaiswara Ahli Muda",
  "Widyaiswara Ahli Pertama",
];

/**
 * Pemetaan Pegawai (admin), sama dengan aplikasi lama: jabatan/fungsi, role akses login, dan keanggotaan Tim Kerja. Bila
 * jabatan atau role akun sendiri berubah, pengguna keluar agar dasbor diperbarui.
 */
export function PemetaanPegawai({ pegawaiSaya, roleSaya }: { pegawaiSaya: string | null; roleSaya: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const muat = async () => {
    const r = await ambilJson<Data>("/api/admin/pemetaan-pegawai");
    if (r.ok) setData(r.data);
    else setGalat(r.error);
  };
  useEffect(() => {
    muat();
  }, []);
  if (!data) return galat ? <Alert tone="danger" title={galat} /> : <p className="text-sm text-muted-foreground">Memuat pemetaan pegawai…</p>;
  const q = cari.trim().toLowerCase();
  const tampil = q
    ? data.pegawai.filter((p) => [p.nama, p.nip ?? "", p.jabatan ?? "", p.role ?? "", ...p.timKerja.map((t) => t.nama)].some((v) => v.toLowerCase().includes(q)))
    : data.pegawai;

  async function simpan(p: Pegawai, isi: { jabatan: string | null; role: string | null; timKerja: { id: string; peran: PeranTim }[] }) {
    const r = await kirimJson(`/api/admin/pemetaan-pegawai/${encodeURIComponent(p.id)}`, "PATCH", isi);
    if (!r.ok) return r.error;
    if (pegawaiSaya === p.id && (isi.role !== roleSaya || isi.jabatan !== p.jabatan)) {
      await kirimJson("/api/auth/session", "DELETE");
      router.replace("/login");
      return null;
    }
    setBuka(null);
    setToast(`${p.nama} disimpan.`);
    await muat();
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">{data.pegawai.length}</span> pegawai · <span className="font-mono">{data.timKerja.length}</span> Tim Kerja
      </p>
      <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama, NIP, jabatan, role, atau tim…" leftIcon={<Search size={16} />} />
      {!tampil.length ? (
        <EmptyState title="Pegawai tidak ditemukan" description="Coba kata kunci lain." />
      ) : (
        <ul className="flex flex-col gap-2">
          {tampil.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{p.nip ?? "Tanpa NIP"}</span> · {p.jabatan ?? "Jabatan belum dipetakan"} ·{" "}
                    {PERAN.find((o) => o.id === p.role)?.label ?? (p.role ? "Role tidak dikenal" : "Tanpa akun login")}
                  </p>
                  {p.timKerja.length ? (
                    <p className="text-xs text-muted-foreground">Tim: {p.timKerja.map((t) => `${t.nama} (${t.peran === "ketua" ? "Ketua" : "Anggota"})`).join(", ")}</p>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setBuka(buka === p.id ? null : p.id)}>
                  <Settings2 size={14} /> {buka === p.id ? "Tutup" : "Atur pemetaan"}
                </Button>
              </div>
              {buka === p.id ? <FormPemetaan p={p} tim={data.timKerja} onSimpan={(isi) => simpan(p, isi)} /> : null}
            </li>
          ))}
        </ul>
      )}
      <Toast title="Pemetaan Pegawai" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormPemetaan({
  p,
  tim,
  onSimpan,
}: {
  p: Pegawai;
  tim: Tim[];
  onSimpan: (isi: { jabatan: string | null; role: string | null; timKerja: { id: string; peran: PeranTim }[] }) => Promise<string | null>;
}) {
  const [jabatan, setJabatan] = useState(p.jabatan ?? "");
  const [role, setRole] = useState(p.role ?? "");
  const [pilih, setPilih] = useState(p.timKerja.map(({ id, peran }) => ({ id, peran })));
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  async function kirim(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    const g = await onSimpan({ jabatan: jabatan.trim() || null, role: role || null, timKerja: pilih });
    setSibuk(false);
    if (g) setGalat(g);
  }
  return (
    <form onSubmit={kirim} noValidate className="mt-3 grid gap-3 border-t border-border pt-3">
      <Input label="Jabatan / fungsi" value={jabatan} onChange={setJabatan} maxLength={200} list={`jabatan-${p.id}`} placeholder="Nama jabatan resmi" />
      <datalist id={`jabatan-${p.id}`}>
        {JABATAN.map((j) => (
          <option key={j} value={j} />
        ))}
      </datalist>
      <div>
        <Select
          label="Role akses akun"
          value={role || TANPA}
          onValueChange={(v) => setRole(v === TANPA ? "" : v)}
          disabled={!p.role}
          options={[{ value: TANPA, label: "Tanpa akun login" }, ...PERAN.map((o) => ({ value: o.id, label: o.label }))]}
        />
        {!p.role ? <p className="mt-1 text-xs text-muted-foreground">Pegawai ini belum memiliki akun login.</p> : null}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-muted-foreground">Keanggotaan Tim Kerja</legend>
        {!tim.length ? <p className="text-xs text-muted-foreground">Belum ada Tim Kerja. Buat dulu di halaman Tim Kerja.</p> : null}
        {tim.map((t) => {
          const m = pilih.find((x) => x.id === t.id);
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
              <label className="flex min-w-40 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!m}
                  onChange={(e) => setPilih((x) => (e.target.checked ? [...x, { id: t.id, peran: "anggota" }] : x.filter((y) => y.id !== t.id)))}
                />
                {t.nama}
              </label>
              {m ? (
                <select
                  value={m.peran}
                  aria-label={`Peran ${p.nama} di ${t.nama}`}
                  onChange={(e) => setPilih((x) => x.map((y) => (y.id === t.id ? { ...y, peran: e.target.value as PeranTim } : y)))}
                  className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
                >
                  <option value="ketua">Ketua</option>
                  <option value="anggota">Anggota</option>
                </select>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div>
        <Button type="submit" size="sm" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan pemetaan"}
        </Button>
      </div>
    </form>
  );
}
