"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Cip } from "@/components/ui/segmen";
import { JENJANG, MODE_PELATIHAN, jpTatapMuka, namaProgram, ringkasanKurikulum, type ModePelatihan } from "@/lib/kurikulum";
import { KATEGORI_DIKLAT, skemaTraining } from "@/lib/skema-training";
import { lamaHari, periodeTeks } from "@/lib/jadwal";
import { TEMPAT_DEFAULT } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { TimDiklat } from "@/lib/tim-kerja";

type Kategori = (typeof KATEGORI_DIKLAT)[number]["value"];

/**
 * Tambah jadwal diklat. Isian dan aturan sama dengan form aplikasi lama (TambahJadwalDiklat):
 * program berkurikulum LAN (PKP/PKA) + mode + angkatan hanya DITAWARKAN sebagai saran
 * (nama, JP); tanggal dan JP tetap diisi penyelenggara. Server memeriksa ulang semuanya.
 */
export function FormTambahJadwal({
  buka,
  global,
  pilihanTim,
  onTutup,
  onTersimpan,
}: {
  buka: boolean;
  global: boolean;
  pilihanTim: TimDiklat[];
  onTutup: () => void;
  onTersimpan: (nama: string) => void;
}) {
  return (
    <Panel buka={buka} onTutup={onTutup} judul="Tambah jadwal diklat" jenis="tengah" tutupLuar={false} lebar="max-w-2xl">
      {buka ? <Isi global={global} pilihanTim={pilihanTim} onTersimpan={onTersimpan} onBatal={onTutup} /> : null}
    </Panel>
  );
}

function Isi({ global, pilihanTim, onTersimpan, onBatal }: { global: boolean; pilihanTim: TimDiklat[]; onTersimpan: (nama: string) => void; onBatal: () => void }) {
  const router = useRouter();
  const [jenis, setJenis] = useState("");
  const [mode, setMode] = useState<ModePelatihan>(MODE_PELATIHAN[0].value);
  const [angkatan, setAngkatan] = useState("");
  const [nama, setNama] = useState("");
  const [namaMengikuti, setNamaMengikuti] = useState(true);
  const [kategori, setKategori] = useState<Kategori>("manajerial");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [peserta, setPeserta] = useState("");
  const [jp, setJp] = useState("");
  const [tempat, setTempat] = useState("");
  // Ketua Diklat/admin boleh tanpa tim; anggota tim wajib memilih timnya (satu tim = langsung terpilih).
  const [tim, setTim] = useState(global ? "" : (pilihanTim[0]?.id ?? ""));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const kurikulum = jenis ? ringkasanKurikulum(jenis, mode) : null;
  const tatapMuka = jenis ? jpTatapMuka(jenis, mode) : 0;
  const saranNama = jenis ? namaProgram(jenis, angkatan) : "";
  const namaJenjang = JENJANG.find((j) => j.kode === jenis)?.nama ?? "";

  // Nama mengikuti saran program selama pengguna belum mengetiknya sendiri.
  useEffect(() => {
    if (namaMengikuti) setNama(saranNama);
  }, [saranNama, namaMengikuti]);

  function pilihJenis(kode: string) {
    setJenis(kode);
    if (kode) setKategori("manajerial"); // PKP/PKA = pelatihan struktural kepemimpinan
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (menyimpan) return;
    const isi = {
      name: nama,
      category: kategori,
      participants: peserta ? Number(peserta) : 0,
      startDate: mulai,
      endDate: selesai || null,
      jpDibutuhkan: jp ? Number(jp) : 0,
      tempat: tempat.trim() || undefined,
      jenisPelatihan: jenis || null,
      modePelatihan: jenis ? mode : null,
      angkatan: jenis ? angkatan.trim() || null : null,
      timKerjaId: tim || null,
    };
    // Periksa di browser dengan skema yang sama dengan server, supaya galat tampil di kolomnya.
    const cek = skemaTraining.safeParse(isi);
    const g: Record<string, string> = {};
    if (!cek.success) {
      for (const i of cek.error.issues) {
        const k = String(i.path[0] ?? "umum");
        g[k] ??= k === "participants" || k === "jpDibutuhkan" ? "Isi angka 0 sampai 10.000" : i.message;
      }
    }
    if (!global && !tim) g.timKerjaId = "Pilih tim kerja pemegang diklat ini.";
    setGalat(g);
    if (Object.keys(g).length > 0) return;

    setMenyimpan(true);
    const res = await kirimJson<{ id: string; name: string }>("/api/training", "POST", isi);
    setMenyimpan(false);
    if (!res.ok) {
      setGalat({ umum: res.error });
      return;
    }
    router.refresh();
    onTersimpan(res.data.name);
  }

  const periode = mulai && (!selesai || selesai >= mulai) ? `${periodeTeks(mulai, selesai || undefined)} · ${lamaHari({ startDate: mulai, endDate: selesai || undefined })} hari` : null;

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-6">
      <Bagian judul="Program">
        <Cip
          label="Jenis pelatihan"
          nilai={jenis}
          onPilih={pilihJenis}
          pilihan={[{ value: "", label: "Diklat umum" }, ...JENJANG.map((j) => ({ value: j.kode as string, label: j.kode as string }))]}
        />
        {namaJenjang ? <p className="text-xs text-muted-foreground">{namaJenjang} · kurikulum LAN 2023</p> : null}
        <AnimatePresence initial={false}>
          {jenis ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="overflow-hidden"
            >
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-sm">Mode pembelajaran</span>
                  <Cip label="Mode pembelajaran" nilai={mode} onPilih={setMode} pilihan={MODE_PELATIHAN} />
                </div>
                <Input label="Angkatan (opsional)" placeholder="mis. IV" maxLength={30} value={angkatan} onChange={setAngkatan} error={galat.angkatan} />
              </div>
              {kurikulum ? (
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="flex gap-2 text-pretty">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      Menurut kurikulum: <span className="font-mono">{kurikulum.totalJp}</span> JP dalam <span className="font-mono">{kurikulum.totalHari}</span> hari,
                      termasuk <span className="font-mono">{tatapMuka}</span> JP tatap muka (e-learning sinkron + klasikal).
                    </span>
                  </p>
                  {Number(jp) !== tatapMuka ? (
                    <button
                      type="button"
                      onClick={() => setJp(String(tatapMuka))}
                      className="self-start rounded-full border border-border bg-background px-3 py-1 text-xs hover:border-border-strong"
                    >
                      Isi JP dibutuhkan: <span className="font-mono">{tatapMuka}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Bagian>

      <Bagian judul="Identitas">
        <Input
          label="Nama pelatihan"
          placeholder="mis. Diklat Teknis Umum"
          maxLength={200}
          value={nama}
          onChange={(v) => {
            setNama(v);
            setNamaMengikuti(v.trim() === "");
          }}
          error={galat.name}
          reserveErrorLine
        />
        {saranNama && nama !== saranNama ? (
          <button type="button" onClick={() => setNamaMengikuti(true)} className="-mt-3 self-start text-xs text-primary hover:underline">
            Pakai nama program: {saranNama}
          </button>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-sm">Kategori</span>
          <Cip label="Kategori" nilai={kategori} onPilih={setKategori} pilihan={KATEGORI_DIKLAT.map((k) => ({ value: k.value, label: k.label }))} />
        </div>
      </Bagian>

      <Bagian judul="Waktu dan tempat">
        <div className="grid gap-4 sm:grid-cols-2">
          <Tanggal label="Tanggal mulai" value={mulai} onChange={setMulai} galat={galat.startDate} />
          <Tanggal label="Tanggal selesai (opsional)" value={selesai} min={mulai || undefined} onChange={setSelesai} galat={galat.endDate} />
        </div>
        <AnimatePresence>
          {periode ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="-mt-2 text-xs text-muted-foreground">
              {periode}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <Input label="Tempat" placeholder={TEMPAT_DEFAULT} maxLength={120} value={tempat} onChange={setTempat} error={galat.tempat} />
      </Bagian>

      <Bagian judul="Kebutuhan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Jumlah peserta" inputMode="numeric" placeholder="0" value={peserta} onChange={(v) => setPeserta(v.replace(/\D/g, ""))} error={galat.participants} />
          <Input label="JP dibutuhkan" inputMode="numeric" placeholder="0" value={jp} onChange={(v) => setJp(v.replace(/\D/g, ""))} error={galat.jpDibutuhkan} />
        </div>
        {pilihanTim.length > 0 || !global ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm">Tim kerja pemegang</span>
            <select
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              className="h-11 rounded-full border border-border bg-transparent px-4 text-sm outline-none focus:border-border-strong"
            >
              {global ? <option value="">Tanpa tim (Ketua Diklat)</option> : null}
              {pilihanTim.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nama}
                </option>
              ))}
            </select>
            {galat.timKerjaId ? <span className="text-xs text-destructive">{galat.timKerjaId}</span> : null}
          </label>
        ) : null}
      </Bagian>

      {galat.umum ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {galat.umum}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-background px-6 pt-4">
        <Button type="button" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? "Menyimpan…" : "Simpan jadwal"}
        </Button>
      </div>
    </form>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-xs text-muted-foreground">{judul}</legend>
      {children}
    </fieldset>
  );
}

function Tanggal({ label, value, onChange, min, galat }: { label: string; value: string; onChange: (v: string) => void; min?: string; galat?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!galat}
        className="h-11 rounded-full border border-border bg-transparent px-4 font-mono text-sm outline-none focus:border-border-strong aria-[invalid=true]:border-destructive"
      />
      {galat ? <span className="text-xs text-destructive">{galat}</span> : null}
    </label>
  );
}
