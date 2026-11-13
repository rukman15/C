"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JENIS_VIDEO, bacaYoutube, labelJenisVideo, tautanYoutube, type JenisVideo } from "@/lib/coaching";
import { kirimJson } from "@/lib/api-klien";
import type { VideoPustakaRecord } from "@/lib/server/repositories/coaching";
import { PemutarYoutube } from "./pemutar-youtube";

type Isian = { judul: string; tautan: string; jenis: JenisVideo; keterangan: string };
const kosong = (): Isian => ({ judul: "", tautan: "", jenis: "PENGANTAR", keterangan: "" });

/** Kelola pustaka video (sama dengan aplikasi lama): hanya tautan yang disimpan; video tetap di YouTube. */
export function PustakaVideo({ awal }: { awal: VideoPustakaRecord[] }) {
  const router = useRouter();
  const [isian, setIsian] = useState<Isian>(kosong());
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const idPratinjau = bacaYoutube(isian.tautan);
  const batal = () => {
    setUbahId(null);
    setIsian(kosong());
    setGalat("");
  };

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!idPratinjau) return setGalat("Tautan belum dikenali sebagai satu video YouTube.");
    setMenyimpan(true);
    setGalat("");
    const res = ubahId ? await kirimJson(`/api/coaching/video/${encodeURIComponent(ubahId)}`, "PATCH", isian) : await kirimJson("/api/coaching/video", "POST", isian);
    setMenyimpan(false);
    if (!res.ok) return setGalat(res.error);
    setToast(ubahId ? "Video diperbarui; semua kelompok yang memakainya ikut berubah." : "Video ditambahkan ke pustaka.");
    batal();
    router.refresh();
  }

  async function hapus(v: VideoPustakaRecord) {
    const tanya = v.dipakai
      ? `"${v.judul}" masih dipasang di ${v.dipakai} kelompok. Menghapusnya juga melepas video ini dari kelompok tersebut (tanda "sudah ditonton" ikut hilang). Lanjutkan?`
      : `Hapus "${v.judul}" dari pustaka?`;
    if (!window.confirm(tanya)) return;
    const res = await kirimJson(`/api/coaching/video/${encodeURIComponent(v.id)}${v.dipakai ? "?paksa=1" : ""}`, "DELETE");
    if (!res.ok) return setGalat(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/coaching" className="-mt-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Ruang Coaching
      </Link>
      <form onSubmit={simpan} noValidate className="grid gap-4 rounded-2xl border border-border p-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">{ubahId ? "Ubah video" : "Tambah video"}</h2>
          <Input
            label="Tautan YouTube"
            value={isian.tautan}
            onChange={(v) => setIsian((x) => ({ ...x, tautan: v }))}
            placeholder="https://youtu.be/… atau https://www.youtube.com/watch?v=…"
            error={isian.tautan.trim() && !idPratinjau ? "Belum dikenali sebagai satu video YouTube." : undefined}
          />
          <Input label="Judul" value={isian.judul} onChange={(v) => setIsian((x) => ({ ...x, judul: v }))} maxLength={150} placeholder="mis. Pengantar Aksi Perubahan" />
          <Select
            label="Jenis"
            value={isian.jenis}
            onValueChange={(v) => setIsian((x) => ({ ...x, jenis: v as JenisVideo }))}
            options={JENIS_VIDEO.map((j) => ({ value: j.kode, label: j.label }))}
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Keterangan (opsional)</span>
            <textarea
              value={isian.keterangan}
              onChange={(e) => setIsian((x) => ({ ...x, keterangan: e.target.value }))}
              maxLength={1000}
              rows={2}
              placeholder="Apa yang perlu diperhatikan peserta saat menonton"
              className="rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong"
            />
          </label>
          {galat ? (
            <p role="alert" className="text-sm text-destructive">
              {galat}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={menyimpan || !idPratinjau || !isian.judul.trim()}>
              {menyimpan ? "Menyimpan…" : ubahId ? "Simpan perubahan" : "Tambah ke pustaka"}
            </Button>
            {ubahId ? (
              <Button type="button" variant="ghost" onClick={batal}>
                Batal
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {idPratinjau ? (
            <PemutarYoutube key={idPratinjau} youtubeId={idPratinjau} judul={isian.judul || "Pratinjau"} />
          ) : (
            <div className="aspect-video rounded-xl border border-dashed border-border" />
          )}
          <p className="text-xs text-muted-foreground">
            Unggah video ke YouTube dengan visibilitas Tidak publik (Unlisted): tidak muncul di pencarian tetapi bisa diputar di aplikasi. Jangan pilih Pribadi (Private): video
            pribadi tidak bisa diputar. Rekaman sesi yang menampilkan peserta sebaiknya diunggah ke channel milik balai.
          </p>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-medium">Video di pustaka</h2>
        {awal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada video. Tambahkan video pertama Anda di atas.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {awal.map((v) => (
              <article key={v.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
                <PemutarYoutube youtubeId={v.youtubeId} judul={v.judul} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge size="sm">{labelJenisVideo(v.jenis)}</Badge>
                  <span className="text-xs text-muted-foreground">{v.dipakai ? `Dipakai di ${v.dipakai} kelompok` : "Belum dipakai"}</span>
                </div>
                <p className="text-sm font-medium">{v.judul}</p>
                {v.keterangan ? <p className="text-xs text-muted-foreground">{v.keterangan}</p> : null}
                <div className="mt-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setUbahId(v.id);
                      setIsian({ judul: v.judul, tautan: tautanYoutube(v.youtubeId), jenis: v.jenis, keterangan: v.keterangan ?? "" });
                      setGalat("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil size={14} /> Ubah
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => hapus(v)}>
                    <Trash2 size={14} /> Hapus
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Toast title="Pustaka video" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}
