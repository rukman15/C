"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Footprints, MapPin, Paperclip, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { KATEGORI_INSTANSI, labelKategori } from "@/lib/kelompok";
import { STATUS_LOKASI, batasPenetapan, labelStatusLokasi } from "@/lib/stula";
import { formatTanggalId } from "@/lib/sesi";
import { kirimJson } from "@/lib/api-klien";
import type { LokasiRecord, StulaRecord } from "@/lib/server/repositories/stula";
import { kirimBerkas } from "@/lib/unggah";

const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";
const TANPA = "__tanpa";
const LAIN = "__lain";
const NADA: Record<string, "success" | "danger" | "neutral"> = { LAYAK: "success", TIDAK_LAYAK: "danger", CALON: "neutral" };

/**
 * Panel studi lapangan di tab Kelompok jenis STULA (EB-049, EB-050, EB-053): daftar calon lokasi/lokus, advance kunjungan
 * (tanggal, petugas, hasil, satu berkas), status kelayakan, ketua tim balai, penugasan lokasi ke kelompok (lokus kelompok
 * ikut terisi), pencocokan otomatis per kategori, dan peringatan H-7 sebelum stula. Admin boleh menyesuaikan semuanya.
 */
export function PanelStula({ trainingId, data }: { trainingId: string; data: StulaRecord }) {
  const router = useRouter();
  const [ubah, setUbah] = useState<LokasiRecord | "baru" | null>(null);
  const [kunjungan, setKunjungan] = useState<LokasiRecord | null>(null);
  const [hapus, setHapus] = useState<{ aksi: "hapus-lokasi" | "hapus-kunjungan"; id: string; judul: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const url = `/api/training/${encodeURIComponent(trainingId)}/stula`;
  const labelKelompok = (id: string | null) => data.kelompok.find((k) => k.id === id)?.label ?? null;
  const siapCocok = data.lokasi.some((l) => l.status === "LAYAK" && !l.kelompokId) && data.kelompok.some((k) => !data.lokasi.some((l) => l.kelompokId === k.id));

  async function aksi(body: Record<string, unknown>, pesan: string) {
    setGalat("");
    const res = await kirimJson<{ dipasangkan?: number }>(url, "POST", body);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    setToast(res.data?.dipasangkan !== undefined ? `${res.data.dipasangkan} lokasi dipasangkan ke kelompok.` : pesan);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-medium">Lokasi studi lapangan</h2>
          <p className="text-sm text-muted-foreground">
            Hasil advance kunjungan menjadi daftar lokasi tujuan.{" "}
            {data.mulaiStula ? (
              <>
                Stula mulai <span className="font-mono">{formatTanggalId(data.mulaiStula)}</span>; lokasi dan ketua tim ditetapkan paling lambat{" "}
                <span className="font-mono">{formatTanggalId(batasPenetapan(data.mulaiStula))}</span>.
              </>
            ) : (
              "Tanggal stula belum ada di jadwal (sesi bentuk Stula)."
            )}
          </p>
        </div>
        {data.bolehKelola ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!siapCocok} onClick={() => aksi({ aksi: "cocokkan" }, "")}>
              <Wand2 size={14} /> Cocokkan otomatis
            </Button>
            <Button size="sm" onClick={() => setUbah("baru")}>
              <Plus size={14} /> Tambah lokasi
            </Button>
          </div>
        ) : null}
      </div>

      {data.peringatan.length ? (
        <Alert tone="warning" title="Perlu ditetapkan sebelum stula">
          {data.peringatan.map((p) => (
            <span key={p} className="block">
              {p}
            </span>
          ))}
        </Alert>
      ) : null}
      {galat ? <Alert tone="danger" title={galat} /> : null}

      {data.lokasi.length === 0 ? (
        <EmptyState title="Belum ada lokasi" description="Catat calon lokasi stula, lalu rekam hasil advance kunjungan ke tiap lokasi." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.lokasi.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <MapPin size={15} className="shrink-0 text-muted-foreground" />
                    {l.nama}
                    <Badge size="sm" tone={NADA[l.status] ?? "neutral"}>
                      {labelStatusLokasi(l.status)}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[l.kategori ? labelKategori(l.kategori) : null, l.alamat].filter(Boolean).join(" · ") || "Kategori dan alamat belum diisi"}
                  </p>
                  <p className="text-sm">
                    Kelompok: {labelKelompok(l.kelompokId) ?? <span className="text-muted-foreground">belum dipasangkan</span>} · Ketua tim:{" "}
                    {l.ketuaTimNama ?? <span className="text-muted-foreground">belum ditetapkan</span>}
                  </p>
                  {l.narahubungNama || l.narahubungPonsel ? (
                    <p className="text-sm text-muted-foreground">
                      Narahubung: {l.narahubungNama ? `${l.narahubungNama} ` : ""}
                      {l.narahubungPonsel ? <span className="font-mono">{l.narahubungPonsel}</span> : null}
                    </p>
                  ) : null}
                  {l.catatan ? <p className="mt-1 text-sm whitespace-pre-line">{l.catatan}</p> : null}
                </div>
                {data.bolehKelola ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setKunjungan(l)}>
                      <Footprints size={14} /> Catat kunjungan
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Ubah ${l.nama}`} onClick={() => setUbah(l)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Hapus ${l.nama}`} onClick={() => setHapus({ aksi: "hapus-lokasi", id: l.id, judul: l.nama })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : null}
              </div>
              {l.kunjungan.length ? (
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">Advance kunjungan</p>
                  {l.kunjungan.map((k) => (
                    <div key={k.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p>
                          <span className="font-mono">{formatTanggalId(k.tanggal)}</span> · {k.petugas}
                        </p>
                        {k.hasil ? <p className="whitespace-pre-line text-muted-foreground">{k.hasil}</p> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {k.berkas ? (
                          <ButtonLink size="sm" variant="ghost" href={`${url}/kunjungan/${encodeURIComponent(k.id)}`} target="_blank" rel="noopener">
                            <Paperclip size={14} /> <span className="max-w-40 truncate">{k.berkas.nama}</span>
                          </ButtonLink>
                        ) : null}
                        {data.bolehKelola ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Hapus catatan kunjungan"
                            onClick={() => setHapus({ aksi: "hapus-kunjungan", id: k.id, judul: `kunjungan ${formatTanggalId(k.tanggal)}` })}
                          >
                            <Trash2 size={14} />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={ubah !== null} onOpenChange={(o) => !o && setUbah(null)}>
        <DialogContent title={ubah === "baru" ? "Tambah lokasi" : ubah ? `Ubah ${ubah.nama}` : "Lokasi"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {ubah ? (
            <FormLokasi
              key={ubah === "baru" ? "baru" : ubah.id}
              url={url}
              data={data}
              lokasi={ubah === "baru" ? null : ubah}
              onSelesai={(p) => {
                setUbah(null);
                if (p) setToast(p);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={kunjungan !== null} onOpenChange={(o) => !o && setKunjungan(null)}>
        <DialogContent title={kunjungan ? `Kunjungan ke ${kunjungan.nama}` : "Kunjungan"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {kunjungan ? (
            <FormKunjungan
              url={url}
              lokasi={kunjungan}
              onSelesai={(p) => {
                setKunjungan(null);
                if (p) setToast(p);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={hapus !== null} onOpenChange={(o) => !o && setHapus(null)}>
        <DialogContent
          title={hapus ? `Hapus ${hapus.judul}?` : "Hapus"}
          description={
            hapus?.aksi === "hapus-lokasi" ? "Catatan kunjungan dan berkasnya ikut terhapus; lokus kelompok yang memakainya dikosongkan." : "Berkas kunjungan ikut terhapus."
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setHapus(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const h = hapus!;
                setHapus(null);
                aksi({ aksi: h.aksi, id: h.id }, "Dihapus.");
              }}
            >
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toast title="Studi lapangan" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </section>
  );
}

function FormLokasi({ url, data, lokasi, onSelesai }: { url: string; data: StulaRecord; lokasi: LokasiRecord | null; onSelesai: (pesan: string) => void }) {
  const router = useRouter();
  const [nama, setNama] = useState(lokasi?.nama ?? "");
  const [kategori, setKategori] = useState(lokasi?.kategori ?? "");
  const [alamat, setAlamat] = useState(lokasi?.alamat ?? "");
  const [nhNama, setNhNama] = useState(lokasi?.narahubungNama ?? "");
  const [nhPonsel, setNhPonsel] = useState(lokasi?.narahubungPonsel ?? "");
  const [status, setStatus] = useState(lokasi?.status ?? "CALON");
  const [catatan, setCatatan] = useState(lokasi?.catatan ?? "");
  const [ketua, setKetua] = useState(lokasi?.ketuaTimPegawaiId ?? (lokasi?.ketuaTimNama ? LAIN : ""));
  const [ketuaNama, setKetuaNama] = useState(lokasi?.ketuaTimPegawaiId ? "" : (lokasi?.ketuaTimNama ?? ""));
  const [kelompok, setKelompok] = useState(lokasi?.kelompokId ?? TANPA);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return setGalat("Nama lokasi wajib diisi");
    setSibuk(true);
    setGalat("");
    const res = await kirimJson(url, "POST", {
      aksi: "simpan-lokasi",
      id: lokasi?.id ?? null,
      nama: nama.trim(),
      kategori: kategori || null,
      alamat: alamat.trim() || null,
      narahubungNama: nhNama.trim() || null,
      narahubungPonsel: nhPonsel.trim() || null,
      status,
      catatan: catatan.trim() || null,
      ketuaTimPegawaiId: ketua && ketua !== LAIN ? ketua : null,
      ketuaTimNama: ketua === LAIN ? ketuaNama.trim() || null : null,
      kelompokId: kelompok === TANPA ? null : kelompok,
    });
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(`${nama.trim()} disimpan.`);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <Input label="Nama lokasi" value={nama} onChange={setNama} maxLength={150} placeholder="mis. RSUD Sumedang" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Kategori instansi"
          placeholder="Pilih kategori"
          value={kategori || undefined}
          onValueChange={setKategori}
          options={KATEGORI_INSTANSI.map((k) => ({ value: k.kode, label: k.label }))}
        />
        <Select label="Status" value={status} onValueChange={setStatus} options={STATUS_LOKASI.map((s) => ({ value: s.kode, label: s.label }))} />
      </div>
      <Input label="Alamat" value={alamat} onChange={setAlamat} maxLength={300} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Narahubung" value={nhNama} onChange={setNhNama} maxLength={150} />
        <Input label="Nomor HP narahubung" value={nhPonsel} onChange={setNhPonsel} maxLength={30} inputMode="tel" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Select
            label="Ketua tim (balai)"
            placeholder="Belum ditetapkan"
            value={ketua || undefined}
            onValueChange={setKetua}
            options={[...data.pegawai.map((p) => ({ value: p.id, label: p.nama })), { value: LAIN, label: "Nama lain…" }]}
          />
          {ketua === LAIN ? <Input label="Nama ketua tim" value={ketuaNama} onChange={setKetuaNama} maxLength={150} /> : null}
        </div>
        <Select
          label="Kelompok"
          value={kelompok}
          onValueChange={setKelompok}
          options={[{ value: TANPA, label: "Belum dipasangkan" }, ...data.kelompok.map((k) => ({ value: k.id, label: k.kategori ? `${k.label} · ${k.kategori}` : k.label }))]}
        />
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Catatan</span>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} maxLength={1000} className={AREA} />
      </label>
      {galat ? <Alert tone="danger" title={galat} /> : null}
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

function FormKunjungan({ url, lokasi, onSelesai }: { url: string; lokasi: LokasiRecord; onSelesai: (pesan: string) => void }) {
  const router = useRouter();
  const [tanggal, setTanggal] = useState("");
  const [petugas, setPetugas] = useState("");
  const [hasil, setHasil] = useState("");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!tanggal) return setGalat("Tanggal kunjungan wajib diisi");
    if (!petugas.trim()) return setGalat("Petugas kunjungan wajib diisi");
    if (berkas && berkas.size > 10 * 1024 * 1024) return setGalat("Ukuran berkas maksimal 10 MB");
    setSibuk(true);
    setGalat("");
    const res = await kirimBerkas(`${url}/kunjungan`, "kunjungan", { lokasiId: lokasi.id, tanggal, petugas: petugas.trim(), hasil: hasil.trim() }, berkas);
    setSibuk(false);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
    onSelesai(`Kunjungan ke ${lokasi.nama} dicatat.`);
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Tanggal kunjungan" type="date" value={tanggal} onChange={setTanggal} />
        <Input label="Petugas" value={petugas} onChange={setPetugas} maxLength={300} placeholder="mis. Ketua Diklat, staf TU" />
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Hasil kunjungan</span>
        <textarea
          value={hasil}
          onChange={(e) => setHasil(e.target.value)}
          rows={4}
          maxLength={2000}
          className={AREA}
          placeholder="Kesediaan lokus, narasumber, kapasitas, catatan teknis…"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Berkas (opsional: foto atau berita acara, PDF/JPG/PNG maks 10 MB)</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setBerkas(e.target.files?.[0] ?? null)} className="text-sm" />
      </label>
      <p className="text-xs text-muted-foreground">Setelah kunjungan, ubah status lokasi menjadi Layak atau Tidak layak.</p>
      {galat ? <Alert tone="danger" title={galat} /> : null}
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
