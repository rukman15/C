"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JENJANG, MODE_PELATIHAN, jpTatapMuka, namaProgram, ringkasanKurikulum, type ModePelatihan } from "@/lib/kurikulum";
import { KATEGORI_DIKLAT, skemaTraining } from "@/lib/skema-training";
import { dariIso, keIso, lamaHari, periodeTeks } from "@/lib/jadwal";
import { TEMPAT_DEFAULT } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { TimDiklat } from "@/lib/tim-kerja";
import type { RincianDiklat } from "@/lib/rincian";

type Kategori = (typeof KATEGORI_DIKLAT)[number]["value"];
const TANPA_TIM = "__tanpa";

/**
 * Tambah atau ubah (`awal`) jadwal diklat (Dialog Arc). Isian dan aturan sama dengan form aplikasi lama (TambahJadwalDiklat):
 * program berkurikulum LAN (PKP/PKA) + mode + angkatan hanya DITAWARKAN sebagai saran (nama, JP);
 * tanggal dan JP tetap diisi penyelenggara. Server memeriksa ulang semuanya.
 */
export function FormTambahJadwal({
  buka,
  global,
  pilihanTim,
  awal,
  onTutup,
  onTersimpan,
}: {
  buka: boolean;
  global: boolean;
  pilihanTim: TimDiklat[];
  awal?: RincianDiklat;
  onTutup: () => void;
  onTersimpan: (nama: string) => void;
}) {
  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        title={awal ? "Ubah jadwal diklat" : "Tambah jadwal diklat"}
        description="Pilih program untuk mendapat saran nama dan JP dari kurikulum LAN 2023."
        // Klik di luar tidak menutup supaya isian tidak hilang tak sengaja; tutup lewat Batal atau Esc.
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-w-2xl"
      >
        {buka ? <Isi global={global} pilihanTim={pilihanTim} awal={awal} onTersimpan={onTersimpan} onBatal={onTutup} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Isi({
  global,
  pilihanTim,
  awal,
  onTersimpan,
  onBatal,
}: {
  global: boolean;
  pilihanTim: TimDiklat[];
  awal?: RincianDiklat;
  onTersimpan: (nama: string) => void;
  onBatal: () => void;
}) {
  const router = useRouter();
  const [jenis, setJenis] = useState(awal?.jenisPelatihan ?? "");
  const [mode, setMode] = useState<ModePelatihan>((awal?.modePelatihan as ModePelatihan | undefined) ?? MODE_PELATIHAN[0].value);
  const [angkatan, setAngkatan] = useState(awal?.angkatan ?? "");
  const [nama, setNama] = useState(awal?.name ?? "");
  const [namaMengikuti, setNamaMengikuti] = useState(!awal?.name);
  const [kategori, setKategori] = useState<Kategori>((awal?.category as Kategori | undefined) ?? "manajerial");
  const [mulai, setMulai] = useState(awal?.startDate ?? "");
  const [selesai, setSelesai] = useState(awal?.endDate ?? "");
  const [peserta, setPeserta] = useState(awal?.participants ?? 0);
  const [jp, setJp] = useState(awal?.jpDibutuhkan ?? 0);
  // Tempat bawaan ditampilkan sebagai placeholder, bukan isian.
  const [tempat, setTempat] = useState(awal && awal.tempat !== TEMPAT_DEFAULT ? awal.tempat : "");
  // Ketua Diklat/admin boleh tanpa tim; anggota tim wajib memilih timnya (satu tim = langsung terpilih).
  const [tim, setTim] = useState(awal ? (awal.timKerjaId ?? (global ? TANPA_TIM : "")) : global ? TANPA_TIM : (pilihanTim[0]?.id ?? ""));
  // Tim lama yang tidak ada di pilihan (mis. wewenangnya dicabut) tetap ditampilkan saat mengubah.
  const timLain = awal?.timKerjaId && !pilihanTim.some((t) => t.id === awal.timKerjaId) ? [{ id: awal.timKerjaId, nama: awal.timKerjaNama ?? "Tim lama" }] : [];
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

  // Galat sebuah kolom hilang begitu isinya diubah.
  const bersihkan = (k: string) => setGalat((g) => (g[k] ? { ...g, [k]: "" } : g));

  function pilihJenis(kode: string) {
    setJenis(kode);
    if (kode) setKategori("manajerial"); // PKP/PKA = pelatihan struktural kepemimpinan
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (menyimpan) return;
    const timKerjaId = tim && tim !== TANPA_TIM ? tim : null;
    const isi = {
      name: nama,
      category: kategori,
      participants: peserta,
      startDate: mulai,
      endDate: selesai || null,
      jpDibutuhkan: jp,
      tempat: tempat.trim() || undefined,
      jenisPelatihan: jenis || null,
      modePelatihan: jenis ? mode : null,
      angkatan: jenis ? angkatan.trim() || null : null,
      timKerjaId,
    };
    // Periksa di browser dengan skema yang sama dengan server, supaya galat tampil di kolomnya.
    const cek = skemaTraining.safeParse(isi);
    const g: Record<string, string> = {};
    if (!cek.success) {
      for (const i of cek.error.issues) {
        const k = String(i.path[0] ?? "umum");
        g[k] ??= k === "startDate" && !mulai ? "Pilih tanggal mulai" : i.message;
      }
    }
    if (!global && !timKerjaId) g.timKerjaId = "Pilih tim kerja pemegang diklat ini.";
    setGalat(g);
    if (Object.values(g).some(Boolean)) return;

    setMenyimpan(true);
    const res = awal
      ? await kirimJson<{ id: string; name: string }>(`/api/training/${encodeURIComponent(awal.id)}`, "PUT", isi)
      : await kirimJson<{ id: string; name: string }>("/api/training", "POST", isi);
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
        <ChipGroup
          label="Jenis pelatihan"
          multiple={false}
          value={[jenis || "umum"]}
          onValueChange={(v) => pilihJenis(v[0] && v[0] !== "umum" ? v[0] : "")}
          options={[{ value: "umum", label: "Diklat umum" }, ...JENJANG.map((j) => ({ value: j.kode as string, label: j.kode as string }))]}
        />
        {namaJenjang ? <p className="-mt-2 text-xs text-muted-foreground">{namaJenjang} · kurikulum LAN 2023</p> : null}
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
                  <ChipGroup
                    label="Mode pembelajaran"
                    multiple={false}
                    value={[mode]}
                    onValueChange={(v) => v[0] && setMode(v[0] as ModePelatihan)}
                    options={MODE_PELATIHAN}
                  />
                </div>
                <Input label="Angkatan (opsional)" placeholder="mis. IV" maxLength={30} value={angkatan} onChange={setAngkatan} error={galat.angkatan || undefined} />
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
                  {jp !== tatapMuka ? (
                    <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setJp(tatapMuka)}>
                      Isi JP dibutuhkan: <span className="font-mono">{tatapMuka}</span>
                    </Button>
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
            bersihkan("name");
          }}
          error={galat.name || undefined}
          reserveErrorLine
        />
        {saranNama && nama !== saranNama ? (
          <button type="button" onClick={() => setNamaMengikuti(true)} className="-mt-3 self-start text-xs text-primary hover:underline">
            Pakai nama program: {saranNama}
          </button>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-sm">Kategori</span>
          <ChipGroup
            label="Kategori"
            multiple={false}
            value={[kategori]}
            onValueChange={(v) => v[0] && setKategori(v[0] as Kategori)}
            options={KATEGORI_DIKLAT.map((k) => ({ value: k.value, label: k.label }))}
          />
        </div>
      </Bagian>

      <Bagian judul="Waktu dan tempat">
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom galat={galat.startDate}>
            <DatePicker
              label="Tanggal mulai"
              locale="id-ID"
              placeholder="Pilih tanggal"
              value={dariIso(mulai)}
              onChange={(d) => {
                setMulai(d ? keIso(d) : "");
                bersihkan("startDate");
                bersihkan("endDate");
              }}
              showToday
            />
          </Kolom>
          <Kolom galat={galat.endDate}>
            <DatePicker
              label="Tanggal selesai (opsional)"
              locale="id-ID"
              placeholder="Pilih tanggal"
              value={dariIso(selesai)}
              minDate={dariIso(mulai)}
              onChange={(d) => {
                setSelesai(d ? keIso(d) : "");
                bersihkan("endDate");
              }}
            />
          </Kolom>
        </div>
        <AnimatePresence>
          {periode ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="-mt-2 text-xs text-muted-foreground">
              {periode}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <Input label="Tempat" placeholder={TEMPAT_DEFAULT} maxLength={120} value={tempat} onChange={setTempat} error={galat.tempat || undefined} />
      </Bagian>

      <Bagian judul="Kebutuhan">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Jumlah peserta" value={peserta} onValueChange={setPeserta} min={0} max={10_000} locale="id-ID" />
          <NumberField label="JP dibutuhkan" value={jp} onValueChange={setJp} min={0} max={10_000} step={1} largeStep={10} suffix=" JP" locale="id-ID" />
        </div>
        {pilihanTim.length > 0 || timLain.length > 0 || !global ? (
          <Kolom galat={galat.timKerjaId}>
            <Select
              label="Tim kerja pemegang"
              placeholder="Pilih tim"
              value={tim || undefined}
              onValueChange={(v) => {
                setTim(v);
                bersihkan("timKerjaId");
              }}
              options={[...(global ? [{ value: TANPA_TIM, label: "Tanpa tim (Ketua Diklat)" }] : []), ...[...pilihanTim, ...timLain].map((t) => ({ value: t.id, label: t.nama }))]}
            />
          </Kolom>
        ) : null}
      </Bagian>

      {galat.umum ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {galat.umum}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onBatal}>
          Batal
        </Button>
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? "Menyimpan…" : awal ? "Simpan perubahan" : "Simpan jadwal"}
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

/** Pembungkus kolom komponen Arc yang tidak punya tempat galat sendiri. */
function Kolom({ galat, children }: { galat?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {children}
      <AnimatePresence initial={false}>
        {galat ? (
          <motion.span role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-destructive">
            {galat}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
