"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Crown, MapPin, Pencil, Printer, Shuffle, Users } from "lucide-react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { JUMLAH_KELOMPOK_MAKS, labelKategori } from "@/lib/kelompok";
import { LABEL_STATUS_PESERTA } from "@/lib/peserta";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { AnggotaKelompok, KelompokItem, KelompokRecord } from "@/lib/server/repositories/kelompok";

const LUAR = "__luar";
const URAIAN: Record<string, { bagi: string; teks: string }> = {
  ELEARNING: { bagi: "Bagi acak", teks: "Kelompok kecil e-learning, dibagi acak (EB-047). Pedoman: 4 kelompok." },
  SEMINAR: {
    bagi: "Susun per instansi & kabupaten",
    teks: "Kelompok bimbingan coach sekaligus kelompok seminar RAP & LAP dan Ruang Coaching (EB-046). Disusun per instansi lalu kabupaten/kota (EB-048). Pedoman: 4 kelompok @ 1 coach.",
  },
  STULA: { bagi: "Bagi per kategori instansi", teks: "Kelompok studi lapangan dibagi menurut kategori instansi peserta, lalu diberi lokus tujuan (EB-050)." },
  MANDIRI: { bagi: "Bagi otomatis", teks: "Jumlah kelompok tidak ditetapkan Pedoman; sesuaikan kebutuhan." },
};

/**
 * Tab Kelompok (sama dengan aplikasi lama ditambah revisi EB-046 s/d EB-050): pilih jenis, atur jumlah, bagi otomatis
 * menurut jenis, ubah kelompok (ketua, coach & kelas, kategori & lokus, tautan), pindahkan anggota, ubah kategori instansi
 * peserta, dan cetak daftar kelompok. Semua hasil otomatis bisa diubah.
 */
export function TabKelompok({ data }: { data: KelompokRecord }) {
  const router = useRouter();
  const path = usePathname();
  const [jumlah, setJumlah] = useState(data.kelompok.length || data.pedoman || 4);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [ubah, setUbah] = useState<KelompokItem | null>(null);
  const [tanyaBagi, setTanyaBagi] = useState(false);
  const url = `/api/training/${encodeURIComponent(data.training.id)}/kelompok`;
  const u = URAIAN[data.jenis];
  const kelola = data.bolehKelola;
  const stula = data.jenis === "STULA";

  async function kirim(body: Record<string, unknown>, pesan?: string): Promise<boolean> {
    setSibuk(true);
    setGalat("");
    const res = await kirimJson<{ dibagi?: number }>(url, "POST", { jenis: data.jenis, ...body });
    setSibuk(false);
    if (!res.ok) {
      setGalat(res.error);
      return false;
    }
    if (pesan) setToast(res.data?.dibagi !== undefined ? `${res.data.dibagi} peserta dibagi ke ${jumlah} kelompok.` : pesan);
    router.refresh();
    return true;
  }

  const pindah = (a: AnggotaKelompok, kelompokId: string) => kirim({ aksi: "pindah", pesertaId: a.id, kelompokId: kelompokId === LUAR ? null : kelompokId });
  const aturKategori = (a: AnggotaKelompok, kategori: string) => kirim({ aksi: "kategori-peserta", pesertaId: a.id, kategori: kategori === "__tebak" ? null : kategori });

  const baris = (a: AnggotaKelompok, kini: string | null) => (
    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{a.nomor}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", a.status !== "AKTIF" && "text-muted-foreground line-through")}>{a.nama}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {data.jenis === "SEMINAR" && a.kabupaten ? `${a.kabupaten} · ` : ""}
          {a.instansi ?? a.jabatan ?? "–"}
          {a.status !== "AKTIF" ? ` · ${LABEL_STATUS_PESERTA[a.status]}` : ""}
        </span>
      </span>
      {stula ? (
        kelola ? (
          <select
            aria-label={`Kategori instansi ${a.nama}`}
            disabled={sibuk}
            value={a.kategoriDitebak ? "__tebak" : a.kategori}
            onChange={(e) => aturKategori(a, e.target.value)}
            className="h-8 max-w-[11rem] rounded-full border border-border bg-transparent px-2 text-xs"
          >
            <option value="__tebak">{labelKategori(a.kategori)} (otomatis)</option>
            {data.kategori.map((k) => (
              <option key={k.kode} value={k.kode}>
                {k.label}
              </option>
            ))}
          </select>
        ) : (
          <Badge size="sm">{labelKategori(a.kategori)}</Badge>
        )
      ) : null}
      {kelola ? (
        <select
          aria-label={`Pindahkan ${a.nama}`}
          disabled={sibuk}
          value={kini ?? LUAR}
          onChange={(e) => pindah(a, e.target.value)}
          className="h-8 rounded-full border border-border bg-transparent px-2 text-xs"
        >
          <option value={LUAR}>Tanpa kelompok</option>
          {data.kelompok.map((k) => (
            <option key={k.id} value={k.id}>
              Kelompok {k.nomor}
            </option>
          ))}
        </select>
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <SegmentedControl
          label="Jenis kelompok"
          value={data.jenis}
          onValueChange={(v) => router.push(`${path}?jenis=${v}`)}
          options={data.daftarJenis.map((j) => ({ value: j.kode, label: j.jumlah ? `${j.label} (${j.jumlah})` : j.label }))}
        />
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{u.teks} Peserta melihat kelompok dan teman sekelompoknya di ruang belajar.</p>
      {data.peringatan.length ? (
        <Alert tone="warning" title="Perlu diperiksa">
          <span className="block ">
            {data.peringatan.map((p) => (
              <span key={p} className="block before:mr-1.5 before:content-['•']">
                {p}
              </span>
            ))}
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {kelola ? (
          <>
            <div className="w-40">
              <NumberField label="Jumlah kelompok" value={jumlah} onValueChange={setJumlah} min={1} max={JUMLAH_KELOMPOK_MAKS} />
            </div>
            <Button variant="secondary" disabled={sibuk || !jumlah} onClick={() => kirim({ aksi: "jumlah", jumlah }, "Jumlah kelompok disimpan.")}>
              Atur jumlah
            </Button>
            <Button disabled={sibuk || !jumlah} onClick={() => (data.kelompok.some((k) => k.anggota.length) ? setTanyaBagi(true) : kirim({ aksi: "bagi", jumlah }, "dibagi"))}>
              <Shuffle size={16} /> {u.bagi}
            </Button>
          </>
        ) : null}
        {data.kelompok.length ? (
          <ButtonLink variant="ghost" className="ml-auto" href={`/cetak/kelompok/${data.training.id}?jenis=${data.jenis}`} target="_blank" rel="noopener">
            <Printer size={16} /> Cetak / PDF
          </ButtonLink>
        ) : null}
      </div>
      {galat ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {galat}
        </p>
      ) : null}

      {data.kelompok.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Belum ada kelompok"
          description={kelola ? `Tekan "${u.bagi}" untuk membentuk ${jumlah} kelompok sekaligus membagi peserta aktif.` : "Ketua Diklat belum membentuk kelompok."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.kelompok.map((k) => (
            <section key={k.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium">{k.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{k.anggota.filter((a) => a.status === "AKTIF").length}</span> peserta aktif
                  </p>
                </div>
                {kelola ? (
                  <Button size="sm" variant="ghost" onClick={() => setUbah(k)} aria-label={`Ubah ${k.label}`}>
                    <Pencil size={14} /> Ubah
                  </Button>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Crown size={13} /> Ketua
                </dt>
                <dd>{k.ketuaNama ?? <span className="text-muted-foreground">belum dipilih</span>}</dd>
                {data.pakaiCoach ? (
                  <>
                    <dt className="text-muted-foreground">Coach</dt>
                    <dd>{k.coachNama ?? <span className="text-muted-foreground">belum ditetapkan</span>}</dd>
                    <dt className="text-muted-foreground">Kelas seminar</dt>
                    <dd>{k.kelas ?? "–"}</dd>
                  </>
                ) : null}
                {stula ? (
                  <>
                    <dt className="text-muted-foreground">Kategori</dt>
                    <dd>{k.kategori ?? "–"}</dd>
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <MapPin size={13} /> Lokus
                    </dt>
                    <dd>{k.lokus ?? <span className="text-muted-foreground">belum ditentukan</span>}</dd>
                  </>
                ) : null}
                {k.tautan ? (
                  <>
                    <dt className="text-muted-foreground">Ruang daring</dt>
                    <dd className="truncate">
                      <a href={k.tautan} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {k.tautan}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {k.anggota.length ? k.anggota.map((a) => baris(a, k.id)) : <li className="py-3 text-sm text-muted-foreground">Belum ada anggota.</li>}
              </ul>
            </section>
          ))}
        </div>
      )}

      {data.tanpaKelompok.length && data.kelompok.length ? (
        <section className="rounded-2xl border border-dashed border-border p-4">
          <h2 className="text-sm font-medium">
            Belum masuk kelompok · <span className="font-mono">{data.tanpaKelompok.length}</span>
          </h2>
          <ul className="mt-2 divide-y divide-border">{data.tanpaKelompok.map((a) => baris(a, null))}</ul>
        </section>
      ) : null}

      <Dialog open={tanyaBagi} onOpenChange={setTanyaBagi}>
        <DialogContent
          title={`${u.bagi}?`}
          description="Semua anggota kelompok jenis ini disusun ulang dan ketua kelompok dikosongkan. Coach, kelas, lokus, dan tautan tetap."
          className="max-w-md"
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTanyaBagi(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setTanyaBagi(false);
                void kirim({ aksi: "bagi", jumlah }, "dibagi");
              }}
            >
              Susun ulang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={ubah !== null} onOpenChange={(o) => !o && setUbah(null)}>
        <DialogContent title={ubah ? `Ubah ${ubah.label}` : "Ubah kelompok"} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-xl">
          {ubah ? (
            <FormKelompok
              key={ubah.id}
              k={ubah}
              data={data}
              sibuk={sibuk}
              onSimpan={async (isi) => (await kirim({ aksi: "ubah", id: ubah.id, ...isi }, "Kelompok disimpan.")) && setUbah(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Toast title="Kelompok" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormKelompok({ k, data, sibuk, onSimpan }: { k: KelompokItem; data: KelompokRecord; sibuk: boolean; onSimpan: (isi: Record<string, unknown>) => void }) {
  const [nama, setNama] = useState(k.nama ?? "");
  const [ketua, setKetua] = useState(k.ketuaPesertaId ?? "");
  const [coachWi, setCoachWi] = useState(k.coachPegawaiId ?? LUAR);
  const [coachNama, setCoachNama] = useState(k.coachPegawaiId ? "" : (k.coachNama ?? ""));
  const [kelas, setKelas] = useState(k.kelas ?? "");
  const [kategori, setKategori] = useState(k.kategori ?? "");
  const [lokus, setLokus] = useState(k.lokus ?? "");
  const [tautan, setTautan] = useState(k.tautan ?? "");
  const aktif = k.anggota.filter((a) => a.status === "AKTIF");

  function simpan(e: FormEvent) {
    e.preventDefault();
    const wi = data.wi.find((w) => w.id === coachWi);
    onSimpan({
      nama: nama.trim() || null,
      ketuaPesertaId: ketua || null,
      coachPegawaiId: wi ? wi.id : null,
      coachNama: wi ? wi.nama : coachNama.trim() || null,
      kelas: kelas.trim() || null,
      kategori: kategori.trim() || null,
      lokus: lokus.trim() || null,
      tautan: tautan.trim() || null,
    });
  }

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
      <Input label="Nama kelompok (opsional)" value={nama} onChange={setNama} maxLength={60} />
      <Select label="Ketua kelompok" placeholder="Pilih anggota" value={ketua || undefined} onValueChange={setKetua} options={aktif.map((a) => ({ value: a.id, label: a.nama }))} />
      {data.pakaiCoach ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Coach"
            value={coachWi}
            onValueChange={setCoachWi}
            options={[{ value: LUAR, label: "Bukan WI di jadwal ini" }, ...data.wi.map((w) => ({ value: w.id, label: w.nama }))]}
          />
          {coachWi === LUAR ? <Input label="Nama coach" value={coachNama} onChange={setCoachNama} maxLength={150} /> : <span />}
          <Input label="Kelas/ruang seminar" value={kelas} onChange={setKelas} maxLength={30} placeholder="mis. E" />
        </div>
      ) : null}
      {data.jenis === "STULA" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Kategori kelompok" value={kategori} onChange={setKategori} maxLength={120} placeholder="mis. Kesehatan/RSUD" />
          <Input label="Lokus tujuan" value={lokus} onChange={setLokus} maxLength={150} placeholder="mis. Dinkes/RSUD" />
        </div>
      ) : null}
      <Input label="Tautan ruang daring (opsional)" value={tautan} onChange={setTautan} maxLength={500} placeholder="https://…" />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
