"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Pin, Plus } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ISI_FORUM_MAKS, JUDUL_MAKS, LABEL_PERAN_PENULIS } from "@/lib/coaching";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { TopikRecord, TopikRingkasRecord, TulisanRecord } from "@/lib/server/repositories/coaching";
import { TeksTautan } from "./teks-tautan";

export type AwalForum = { sesiId?: string | null; videoKelompokId?: string | null; judul?: string } | null;
type Pilihan = { id: string; judul: string }[];

const NADA_PERAN: Record<string, BadgeTone> = { COACH: "success", PENYELENGGARA: "info", PESERTA: "neutral" };
const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";

/**
 * Forum tanya-jawab satu kelompok coaching (sama dengan aplikasi lama). Tulisan tidak bisa dihapus; coach/penyelenggara
 * hanya bisa menyembunyikan (tercatat di Log Audit). Diperbarui berkala (30 detik) selama halaman terlihat.
 */
export function ForumCoaching({
  kelompokId,
  bolehKelola,
  bolehMenulis,
  pilihanSesi,
  pilihanVideo,
  awal,
  onDibaca,
}: {
  kelompokId: string;
  bolehKelola: boolean;
  bolehMenulis: boolean;
  pilihanSesi: Pilihan;
  pilihanVideo: Pilihan;
  awal: AwalForum;
  onDibaca: () => void;
}) {
  const dasar = `/api/coaching/${encodeURIComponent(kelompokId)}/forum`;
  const [daftar, setDaftar] = useState<TopikRingkasRecord[] | null>(null);
  const [galat, setGalat] = useState("");
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [topik, setTopik] = useState<TopikRecord | null>(null);
  const [tulisBaru, setTulisBaru] = useState(!!awal);
  const [baru, setBaru] = useState({ judul: awal?.judul ?? "", isi: "", sesiId: awal?.sesiId ?? "", videoKelompokId: awal?.videoKelompokId ?? "" });
  const [mengirim, setMengirim] = useState(false);
  const [balasan, setBalasan] = useState("");
  const [ubah, setUbah] = useState<{ jenis: "topik" | "balasan"; id: string; judul: string; isi: string } | null>(null);

  const muatDaftar = useCallback(async () => {
    const res = await ambilJson<TopikRingkasRecord[]>(dasar);
    if (res.ok) {
      setDaftar(res.data);
      onDibaca();
    } else setGalat(res.error);
  }, [dasar, onDibaca]);
  const muatTopik = useCallback(
    async (id: string) => {
      const res = await ambilJson<TopikRecord>(`${dasar}/${encodeURIComponent(id)}`);
      if (res.ok) setTopik(res.data);
      else setGalat(res.error);
    },
    [dasar],
  );

  useEffect(() => void muatDaftar(), [muatDaftar]);
  useEffect(() => {
    setTopik(null);
    if (bukaId) void muatTopik(bukaId);
  }, [bukaId, muatTopik]);
  useEffect(() => {
    const h = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (bukaId) void muatTopik(bukaId);
      else void muatDaftar();
    }, 30_000);
    return () => clearInterval(h);
  }, [bukaId, muatTopik, muatDaftar]);

  async function kirim(body: Record<string, unknown>): Promise<boolean> {
    setGalat("");
    const res = await kirimJson(dasar, "POST", body);
    if (!res.ok) setGalat(res.error);
    return res.ok;
  }

  async function ajukan(e: FormEvent) {
    e.preventDefault();
    if (!baru.judul.trim() || !baru.isi.trim()) return setGalat("Isi judul dan pertanyaan.");
    setMengirim(true);
    const ok = await kirim({ aksi: "topik", judul: baru.judul, isi: baru.isi, sesiId: baru.sesiId || null, videoKelompokId: baru.videoKelompokId || null });
    setMengirim(false);
    if (!ok) return;
    setBaru({ judul: "", isi: "", sesiId: "", videoKelompokId: "" });
    setTulisBaru(false);
    await muatDaftar();
  }

  async function balas(e: FormEvent) {
    e.preventDefault();
    if (!topik || !balasan.trim()) return;
    setMengirim(true);
    const ok = await kirim({ aksi: "balas", topikId: topik.id, isi: balasan });
    setMengirim(false);
    if (!ok) return;
    setBalasan("");
    await muatTopik(topik.id);
  }

  async function simpanUbah(e: FormEvent) {
    e.preventDefault();
    if (!ubah || !topik) return;
    const ok =
      ubah.jenis === "topik"
        ? await kirim({ aksi: "ubah-topik", id: ubah.id, judul: ubah.judul, isi: ubah.isi })
        : await kirim({ aksi: "ubah-balasan", id: ubah.id, isi: ubah.isi });
    if (!ok) return;
    setUbah(null);
    await muatTopik(topik.id);
  }

  async function atur(body: { disematkan?: boolean; terjawab?: boolean }) {
    if (topik && (await kirim({ aksi: "atur", id: topik.id, ...body }))) await muatTopik(topik.id);
  }

  async function sembunyikan(jenis: "topik" | "balasan", t: TulisanRecord) {
    if (!topik) return;
    const sembunyi = !t.tersembunyi;
    if (sembunyi && !window.confirm("Sembunyikan tulisan ini dari peserta? Isinya tetap tersimpan dan tindakan ini tercatat di Log Audit.")) return;
    if (await kirim({ aksi: "sembunyikan", jenis, id: t.id, sembunyi })) await muatTopik(topik.id);
  }

  function tutupTopik() {
    setBukaId(null);
    setUbah(null);
    setBalasan("");
    void muatDaftar();
  }

  const Tulisan = (t: TulisanRecord, jenis: "topik" | "balasan") => (
    <div className={cn("rounded-2xl p-4", jenis === "topik" ? "border border-border" : "bg-muted/50", t.tersembunyi && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t.namaPenulis}</span>
        <Badge size="sm" tone={NADA_PERAN[t.peranPenulis] ?? "neutral"}>
          {LABEL_PERAN_PENULIS[t.peranPenulis]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {waktu(t.waktu)}
          {t.diubah ? " · diubah" : ""}
        </span>
      </div>
      {ubah && ubah.id === t.id ? (
        <form onSubmit={simpanUbah} className="mt-3 flex flex-col gap-2">
          {ubah.jenis === "topik" ? <Input value={ubah.judul} onChange={(v) => setUbah({ ...ubah, judul: v })} maxLength={JUDUL_MAKS} aria-label="Judul" /> : null}
          <textarea value={ubah.isi} onChange={(e) => setUbah({ ...ubah, isi: e.target.value })} maxLength={ISI_FORUM_MAKS} rows={4} className={AREA} aria-label="Isi" />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Simpan
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setUbah(null)}>
              Batal
            </Button>
          </div>
        </form>
      ) : t.isi === null ? (
        <p className="mt-2 text-sm text-muted-foreground italic">Tulisan ini disembunyikan oleh {t.disembunyikanOleh ?? "coach"}.</p>
      ) : (
        <>
          {t.tersembunyi ? <p className="mt-2 text-xs text-warning">Disembunyikan dari peserta oleh {t.disembunyikanOleh}</p> : null}
          <TeksTautan teks={t.isi} className="mt-2" />
        </>
      )}
      {!ubah || ubah.id !== t.id ? (
        <div className="mt-2 flex gap-3 text-xs">
          {t.milikSaya && !t.tersembunyi && bolehMenulis && topik ? (
            <button type="button" className="text-primary hover:underline" onClick={() => setUbah({ jenis, id: t.id, judul: topik.judul ?? "", isi: t.isi ?? "" })}>
              Ubah
            </button>
          ) : null}
          {bolehKelola ? (
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => sembunyikan(jenis, t)}>
              {t.tersembunyi ? "Tampilkan lagi" : "Sembunyikan"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {galat ? (
        <p role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      ) : null}
      {bukaId ? (
        <>
          <button type="button" onClick={tutupTopik} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Semua pertanyaan
          </button>
          {!topik ? (
            <Skeleton className="h-40" />
          ) : (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-medium text-pretty">{topik.judul ?? "(disembunyikan)"}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {topik.disematkan ? (
                      <Badge size="sm" icon={<Pin size={12} />}>
                        Disematkan
                      </Badge>
                    ) : null}
                    {topik.terjawab ? (
                      <Badge size="sm" tone="success">
                        Terjawab{topik.terjawabOleh ? ` · ${topik.terjawabOleh}` : ""}
                      </Badge>
                    ) : null}
                    {topik.sesi ? <Badge size="sm">Sesi: {topik.sesi.judul}</Badge> : null}
                    {topik.video ? <Badge size="sm">Video: {topik.video.judul}</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bolehKelola ? (
                    <Button size="sm" variant="secondary" onClick={() => atur({ disematkan: !topik.disematkan })}>
                      {topik.disematkan ? "Lepas sematan" : "Sematkan"}
                    </Button>
                  ) : null}
                  {(bolehKelola || topik.topik.milikSaya) && !topik.tersembunyi ? (
                    <Button size="sm" variant="secondary" onClick={() => atur({ terjawab: !topik.terjawab })}>
                      {topik.terjawab ? "Tandai belum terjawab" : "Tandai terjawab"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {Tulisan(topik.topik, "topik")}
              <div className="flex flex-col gap-2 pl-4 sm:pl-8">
                {topik.balasanList.map((b) => (
                  <div key={b.id}>{Tulisan(b, "balasan")}</div>
                ))}
              </div>
              {bolehMenulis && !topik.tersembunyi ? (
                <form onSubmit={balas} className="flex flex-col gap-2">
                  <textarea
                    value={balasan}
                    onChange={(e) => setBalasan(e.target.value)}
                    maxLength={ISI_FORUM_MAKS}
                    rows={3}
                    placeholder="Tulis balasan…"
                    className={AREA}
                    aria-label="Balasan"
                  />
                  <Button type="submit" className="self-start" disabled={mengirim || !balasan.trim()}>
                    {mengirim ? "Mengirim…" : "Kirim balasan"}
                  </Button>
                </form>
              ) : null}
            </section>
          )}
        </>
      ) : (
        <>
          {bolehMenulis ? (
            tulisBaru ? (
              <form onSubmit={ajukan} noValidate className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <h3 className="text-sm font-medium">Ajukan pertanyaan</h3>
                <Input label="Judul" value={baru.judul} onChange={(v) => setBaru((x) => ({ ...x, judul: v }))} maxLength={JUDUL_MAKS} placeholder="Ringkas pertanyaan Anda" />
                <textarea
                  value={baru.isi}
                  onChange={(e) => setBaru((x) => ({ ...x, isi: e.target.value }))}
                  maxLength={ISI_FORUM_MAKS}
                  rows={4}
                  placeholder="Jelaskan pertanyaan atau hal yang ingin didiskusikan. Tautan (https://…) bisa ditempel."
                  className={AREA}
                  aria-label="Isi pertanyaan"
                />
                {pilihanSesi.length || pilihanVideo.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pilihanSesi.length ? (
                      <Select
                        label="Terkait sesi (opsional)"
                        placeholder="Tidak terkait"
                        value={baru.sesiId || undefined}
                        onValueChange={(v) => setBaru((x) => ({ ...x, sesiId: v }))}
                        options={pilihanSesi.map((s) => ({ value: s.id, label: s.judul }))}
                      />
                    ) : null}
                    {pilihanVideo.length ? (
                      <Select
                        label="Terkait video (opsional)"
                        placeholder="Tidak terkait"
                        value={baru.videoKelompokId || undefined}
                        onValueChange={(v) => setBaru((x) => ({ ...x, videoKelompokId: v }))}
                        options={pilihanVideo.map((s) => ({ value: s.id, label: s.judul }))}
                      />
                    ) : null}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={mengirim}>
                    {mengirim ? "Mengirim…" : "Kirim pertanyaan"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setTulisBaru(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            ) : (
              <Button className="self-start" onClick={() => setTulisBaru(true)}>
                <Plus size={16} /> Ajukan pertanyaan
              </Button>
            )
          ) : null}
          {daftar === null ? (
            <Skeleton className="h-24" />
          ) : daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pertanyaan.{bolehMenulis ? " Mulai diskusi dengan mengajukan pertanyaan pertama." : ""}</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {daftar.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setBukaId(t.id)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={cn("text-sm", t.baru ? "font-medium" : "")}>{t.judul ?? "(disembunyikan)"}</p>
                      <div className="flex flex-wrap gap-1">
                        {t.baru ? (
                          <Badge size="sm" tone="info" dot>
                            Baru
                          </Badge>
                        ) : null}
                        {t.disematkan ? (
                          <Badge size="sm" icon={<Pin size={12} />}>
                            Disematkan
                          </Badge>
                        ) : null}
                        {t.terjawab ? (
                          <Badge size="sm" tone="success">
                            Terjawab
                          </Badge>
                        ) : !t.tersembunyi ? (
                          <Badge size="sm" tone="warning">
                            Belum terjawab
                          </Badge>
                        ) : null}
                        {t.tersembunyi ? <Badge size="sm">Disembunyikan</Badge> : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.namaPenulis} ({LABEL_PERAN_PENULIS[t.peranPenulis]}) · {waktu(t.waktu)} · <span className="font-mono">{t.balasan}</span> balasan
                      {t.sesi ? ` · Sesi: ${t.sesi.judul}` : ""}
                      {t.video ? ` · Video: ${t.video.judul}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
