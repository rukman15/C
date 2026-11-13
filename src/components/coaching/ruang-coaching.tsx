"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { Badge } from "@/components/arc/badge/badge";
import { Select } from "@/components/arc/select/select";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { CATATAN_MAKS, JUDUL_MAKS, KETERANGAN_MAKS, labelJenisVideo } from "@/lib/coaching";
import { periodeSurat, tanggalPanjang } from "@/lib/dokumen";
import { kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { CatatanRecord, RuangCoachingRecord, SesiCoachingRecord, VideoTerpasangRecord } from "@/lib/server/repositories/coaching";
import { PemutarYoutube } from "./pemutar-youtube";
import { TeksTautan } from "./teks-tautan";
import { ForumCoaching, type AwalForum } from "./forum-coaching";

const AREA = "w-full rounded-2xl border border-border bg-transparent p-3 text-sm outline-none focus:border-border-strong";
const UMUM = "__umum";
type IsianSesi = { id: string | null; judul: string; tanggal: string; jamMulai: string; tautanRapat: string; keterangan: string };
const sesiKosong = (): IsianSesi => ({ id: null, judul: "", tanggal: "", jamMulai: "", tautanRapat: "", keterangan: "" });
const hadirLabel = (c: CatatanRecord) => (c.hadir === true ? "Hadir" : c.hadir === false ? "Tidak hadir" : "");
const jadwal = (s: SesiCoachingRecord) => (s.tanggal ? `${tanggalPanjang(s.tanggal)}${s.jamMulai ? `, ${s.jamMulai} WIB` : ""}` : "Belum dijadwalkan");

/**
 * Ruang Coaching satu kelompok (sama dengan aplikasi lama): Sesi & video (jadwal, tautan rapat, video YouTube, catatan
 * coach), Forum tanya-jawab, dan Pantauan peserta (coach, penyelenggara, pimpinan). Hak dihitung server.
 */
export function RuangCoaching({ data, tabAwal }: { data: RuangCoachingRecord; tabAwal: string }) {
  const router = useRouter();
  const api = `/api/coaching/${encodeURIComponent(data.kelompok.id)}`;
  const [tab, setTab] = useState(tabAwal);
  const [galat, setGalat] = useState("");
  const [awalForum, setAwalForum] = useState<{ n: number; isi: AwalForum }>({ n: 0, isi: null });
  const [belumDibaca, setBelumDibaca] = useState(data.forum.belumDibaca);
  const lihatSemua = data.peran !== "peserta";
  const pilihanSesi = data.sesi.map((s) => ({ id: s.id, judul: s.judul }));
  const semuaVideo = useMemo(() => [...data.videoUmum, ...data.sesi.flatMap((s) => s.video)], [data]);
  const onDibaca = useCallback(() => setBelumDibaca(0), []);

  async function aksi(body: Record<string, unknown>): Promise<boolean> {
    setGalat("");
    const res = await kirimJson(api, "POST", body);
    if (!res.ok) {
      setGalat(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  const kartuVideo = (v: VideoTerpasangRecord) => (
    <div key={v.id} className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
      <PemutarYoutube youtubeId={v.youtubeId} judul={v.judul} />
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <Badge size="sm">{labelJenisVideo(v.jenis)}</Badge>
          <p className="mt-1 text-sm font-medium">{v.judul}</p>
        </div>
        {v.keterangan ? <TeksTautan teks={v.keterangan} className="text-muted-foreground" /> : null}
        {v.ditontonSaya !== null ? <TandaTonton key={`${v.id}:${v.ditontonSaya}`} awal={v.ditontonSaya} onUbah={(sudah) => aksi({ aksi: "tonton", id: v.id, sudah })} /> : null}
        {v.ditonton ? (
          <p className="text-xs text-muted-foreground">
            Sudah ditonton <span className="font-mono">{v.ditonton.length}</span> dari <span className="font-mono">{data.anggota.length}</span> peserta
            {v.ditonton.length ? `: ${v.ditonton.map((x) => x.nama).join(", ")}` : ""}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end gap-2">
          {data.bolehMenulis ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAwalForum((x) => ({ n: x.n + 1, isi: { videoKelompokId: v.id, sesiId: v.sesiId, judul: `Tentang video: ${v.judul}` } }));
                setTab("forum");
              }}
            >
              <MessageCircleQuestion size={14} /> Tanya soal video ini
            </Button>
          ) : null}
          {data.bolehKelola ? (
            <>
              <div className="w-56">
                <Select
                  label="Tempat video"
                  value={v.sesiId ?? UMUM}
                  onValueChange={(s) => aksi({ aksi: "pasang-video", videoId: v.videoId, sesiId: s === UMUM ? null : s })}
                  options={[{ value: UMUM, label: "Video umum (tanpa sesi)" }, ...pilihanSesi.map((s) => ({ value: s.id, label: `Sesi: ${s.judul}` }))]}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.confirm(`Lepas "${v.judul}" dari kelompok ini? Tanda "sudah ditonton" peserta ikut hilang. Video tetap ada di pustaka.`) &&
                  aksi({ aksi: "lepas-video", id: v.id })
                }
              >
                Lepas
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href="/dashboard/coaching" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Semua ruang coaching
      </Link>
      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Ruang Coaching</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.kelompok.label} · {data.training.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Coach: <span className="text-foreground">{data.kelompok.coachNama ?? "belum ditetapkan"}</span> · <span className="font-mono">{data.anggota.length}</span> peserta ·{" "}
            {periodeSurat(data.training.startDate, data.training.endDate)}
            {data.peran === "pembaca" ? " · Anda melihat saja" : ""}
          </p>
        </div>
        {data.kelompok.tautan ? (
          <ButtonLink variant="secondary" size="sm" href={data.kelompok.tautan} target="_blank" rel="noopener noreferrer">
            Ruang rapat kelompok <ExternalLink size={14} />
          </ButtonLink>
        ) : null}
      </header>
      {galat ? (
        <p role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {galat}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList aria-label="Bagian ruang coaching">
          <TabsTrigger value="sesi">Sesi & video</TabsTrigger>
          <TabsTrigger value="forum">Forum{belumDibaca ? ` (${belumDibaca} baru)` : ""}</TabsTrigger>
          {lihatSemua ? <TabsTrigger value="pantauan">Pantauan peserta</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="sesi" className="mt-4 flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-medium">Video</h2>
            {data.videoUmum.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {data.bolehKelola ? "Belum ada video umum. Pasang video pengantar dari pustaka di bawah." : "Belum ada video dari coach."}
              </p>
            ) : (
              <div className="flex flex-col gap-3">{data.videoUmum.map(kartuVideo)}</div>
            )}
            {data.bolehKelola && data.pustaka ? <PasangVideo data={data} pilihanSesi={pilihanSesi} aksi={aksi} /> : null}
          </section>
          <SesiCoaching data={data} aksi={aksi} kartuVideo={kartuVideo} />
        </TabsContent>

        <TabsContent value="forum" className="mt-4">
          <ForumCoaching
            key={awalForum.n}
            kelompokId={data.kelompok.id}
            bolehKelola={data.bolehKelola}
            bolehMenulis={data.bolehMenulis}
            pilihanSesi={pilihanSesi}
            pilihanVideo={semuaVideo.map((v) => ({ id: v.id, judul: v.judul }))}
            awal={awalForum.isi}
            onDibaca={onDibaca}
          />
        </TabsContent>

        {lihatSemua ? (
          <TabsContent value="pantauan" className="mt-4">
            <section className="rounded-2xl border border-border p-5">
              <h2 className="text-sm font-medium">Pantauan peserta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Video yang sudah ditandai ditonton dan kehadiran yang dicatat coach per sesi.</p>
              {data.anggota.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Kelompok ini belum punya anggota aktif.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        {["No", "Peserta", "Instansi", "Video ditonton", "Hadir sesi", "Belum menonton"].map((h) => (
                          <th key={h} className="px-3 py-2 font-normal">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.anggota.map((a) => {
                        const sudah = semuaVideo.filter((v) => v.ditonton?.some((x) => x.pesertaId === a.pesertaId));
                        const hadir = data.sesi.filter((s) => s.catatan?.some((c) => c.pesertaId === a.pesertaId && c.hadir === true)).length;
                        const dicatat = data.sesi.filter((s) => s.catatan?.some((c) => c.pesertaId === a.pesertaId && c.hadir !== null)).length;
                        const belum = semuaVideo.filter((v) => !v.ditonton?.some((x) => x.pesertaId === a.pesertaId)).map((v) => v.judul);
                        return (
                          <tr key={a.pesertaId} className="border-b border-border align-top last:border-b-0">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{a.nomor}</td>
                            <td className="px-3 py-2">{a.nama}</td>
                            <td className="px-3 py-2 text-muted-foreground">{a.instansi ?? "–"}</td>
                            <td className="px-3 py-2 font-mono">
                              {sudah.length} / {semuaVideo.length}
                            </td>
                            <td className="px-3 py-2 font-mono">{dicatat ? `${hadir} / ${dicatat}` : "–"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{belum.join(", ") || "–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function PasangVideo({
  data,
  pilihanSesi,
  aksi,
}: {
  data: RuangCoachingRecord;
  pilihanSesi: { id: string; judul: string }[];
  aksi: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [videoId, setVideoId] = useState("");
  const [sesiId, setSesiId] = useState(UMUM);
  async function pasang(e: FormEvent) {
    e.preventDefault();
    if (videoId && (await aksi({ aksi: "pasang-video", videoId, sesiId: sesiId === UMUM ? null : sesiId }))) {
      setVideoId("");
      setSesiId(UMUM);
    }
  }
  return (
    <form onSubmit={pasang} className="mt-4 grid gap-3 rounded-2xl border border-dashed border-border p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
      <Select
        label="Pasang video dari pustaka"
        placeholder="Pilih video"
        value={videoId || undefined}
        onValueChange={setVideoId}
        options={(data.pustaka ?? []).map((p) => ({ value: p.id, label: `${p.judul} (${labelJenisVideo(p.jenis)} · ${p.pemilik})` }))}
      />
      <Select
        label="Tempat"
        value={sesiId}
        onValueChange={setSesiId}
        options={[{ value: UMUM, label: "Video umum" }, ...pilihanSesi.map((s) => ({ value: s.id, label: `Sesi: ${s.judul}` }))]}
      />
      <Button type="submit" disabled={!videoId}>
        Pasang
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        {data.pustaka?.length ? "" : "Pustaka masih kosong. "}
        <Link href="/dashboard/coaching/video" className="text-primary hover:underline">
          Kelola Pustaka Video Saya
        </Link>
        : tambahkan tautan YouTube di sana.
      </p>
    </form>
  );
}

function SesiCoaching({
  data,
  aksi,
  kartuVideo,
}: {
  data: RuangCoachingRecord;
  aksi: (b: Record<string, unknown>) => Promise<boolean>;
  kartuVideo: (v: VideoTerpasangRecord) => React.ReactNode;
}) {
  const [form, setForm] = useState<IsianSesi | null>(null);
  const [bukaCatatan, setBukaCatatan] = useState<string | null>(null);
  const [isiCatatan, setIsiCatatan] = useState<Record<string, { hadir: string; catatan: string; tindakLanjut: string }>>({});
  const [tersimpan, setTersimpan] = useState<string | null>(null);
  const atur = (k: keyof IsianSesi) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const ok = await aksi({
      aksi: "sesi",
      id: form.id,
      judul: form.judul,
      tanggal: form.tanggal || null,
      jamMulai: form.jamMulai || null,
      tautanRapat: form.tautanRapat || null,
      keterangan: form.keterangan || null,
    });
    if (ok) setForm(null);
  }

  function mulaiCatatan(s: SesiCoachingRecord) {
    if (bukaCatatan === s.id) return setBukaCatatan(null);
    setBukaCatatan(s.id);
    setTersimpan(null);
    setIsiCatatan(
      Object.fromEntries(
        data.anggota.map((a) => {
          const c = s.catatan?.find((x) => x.pesertaId === a.pesertaId);
          return [a.pesertaId, { hadir: c?.hadir === true ? "ya" : c?.hadir === false ? "tidak" : "", catatan: c?.catatan ?? "", tindakLanjut: c?.tindakLanjut ?? "" }];
        }),
      ),
    );
  }

  async function simpanCatatan(sesiId: string, pesertaId: string) {
    const c = isiCatatan[pesertaId];
    const ok = await aksi({
      aksi: "catatan",
      sesiId,
      pesertaId,
      hadir: c.hadir === "ya" ? true : c.hadir === "tidak" ? false : null,
      catatan: c.catatan || null,
      tindakLanjut: c.tindakLanjut || null,
    });
    if (ok) setTersimpan(`${sesiId}:${pesertaId}`);
  }
  const ubahCatatan = (id: string, k: "hadir" | "catatan" | "tindakLanjut", v: string) => setIsiCatatan((x) => ({ ...x, [id]: { ...x[id], [k]: v } }));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Sesi coaching</h2>
        {data.bolehKelola && !form ? (
          <Button size="sm" onClick={() => setForm(sesiKosong())}>
            <Plus size={14} /> Tambah sesi
          </Button>
        ) : null}
      </div>
      {form ? (
        <form onSubmit={simpan} noValidate className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary p-4">
          <h3 className="text-sm font-medium">{form.id ? "Ubah sesi" : "Sesi baru"}</h3>
          <Input label="Judul" value={form.judul} onChange={atur("judul")} maxLength={JUDUL_MAKS} placeholder="mis. Sesi 2: Menyusun rancangan aksi perubahan" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Tanggal" type="date" value={form.tanggal} onChange={atur("tanggal")} />
            <Input label="Jam mulai (WIB)" type="time" value={form.jamMulai} onChange={atur("jamMulai")} />
            <Input label="Tautan rapat" value={form.tautanRapat} onChange={atur("tautanRapat")} placeholder="https://zoom.us/j/…" />
          </div>
          <textarea
            value={form.keterangan}
            onChange={(e) => atur("keterangan")(e.target.value)}
            maxLength={KETERANGAN_MAKS}
            rows={2}
            placeholder="Persiapan peserta, bahan yang dibawa, dll."
            className={AREA}
            aria-label="Keterangan"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!form.judul.trim()}>
              Simpan sesi
            </Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Batal
            </Button>
          </div>
        </form>
      ) : null}
      {data.sesi.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada sesi coaching terjadwal.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.sesi.map((s) => (
            <section key={s.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{s.judul}</h3>
                  <p className="text-sm text-muted-foreground">{jadwal(s)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.tautanRapat ? (
                    <ButtonLink size="sm" href={s.tautanRapat} target="_blank" rel="noopener noreferrer">
                      Gabung rapat <ExternalLink size={14} />
                    </ButtonLink>
                  ) : null}
                  {data.bolehKelola ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => mulaiCatatan(s)}>
                        {bukaCatatan === s.id ? "Tutup catatan" : "Catatan peserta"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Ubah ${s.judul}`}
                        onClick={() =>
                          setForm({
                            id: s.id,
                            judul: s.judul,
                            tanggal: s.tanggal ?? "",
                            jamMulai: s.jamMulai ?? "",
                            tautanRapat: s.tautanRapat ?? "",
                            keterangan: s.keterangan ?? "",
                          })
                        }
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Hapus ${s.judul}`}
                        onClick={() =>
                          window.confirm(`Hapus sesi "${s.judul}"? Catatan coach di sesi ini ikut terhapus. Video & pertanyaan forum yang terkait tetap ada.`) &&
                          aksi({ aksi: "hapus-sesi", id: s.id })
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {s.keterangan ? <TeksTautan teks={s.keterangan} className="mt-2 text-muted-foreground" /> : null}
              {s.video.length ? <div className="mt-3 flex flex-col gap-3">{s.video.map(kartuVideo)}</div> : null}
              {s.catatanSaya ? (
                <div className="mt-3 rounded-xl bg-primary/8 p-3">
                  <p className="text-xs text-primary">Catatan coach untuk Anda{hadirLabel(s.catatanSaya) ? ` · ${hadirLabel(s.catatanSaya)}` : ""}</p>
                  {s.catatanSaya.catatan ? <TeksTautan teks={s.catatanSaya.catatan} className="mt-1" /> : null}
                  {s.catatanSaya.tindakLanjut ? (
                    <>
                      <p className="mt-2 text-xs text-muted-foreground">Tindak lanjut</p>
                      <TeksTautan teks={s.catatanSaya.tindakLanjut} />
                    </>
                  ) : null}
                </div>
              ) : null}
              {s.catatan && !data.bolehKelola && s.catatan.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        {["Peserta", "Kehadiran", "Catatan", "Tindak lanjut"].map((h) => (
                          <th key={h} className="px-3 py-2 font-normal">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.catatan.map((c) => (
                        <tr key={c.pesertaId} className="border-b border-border align-top last:border-b-0">
                          <td className="px-3 py-2">{c.nama}</td>
                          <td className="px-3 py-2">{hadirLabel(c) || "–"}</td>
                          <td className="px-3 py-2">{c.catatan ?? "–"}</td>
                          <td className="px-3 py-2">{c.tindakLanjut ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {data.bolehKelola && bukaCatatan === s.id ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">Setiap peserta hanya melihat catatan untuk dirinya sendiri. Kosongkan semua isian untuk menghapus catatan.</p>
                  {data.anggota.map((a) =>
                    isiCatatan[a.pesertaId] ? (
                      <div key={a.pesertaId} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[10rem_9rem_1fr_1fr_auto] md:items-start">
                        <p className="pt-2 text-sm">{a.nama}</p>
                        <Select
                          label="Kehadiran"
                          placeholder="Belum dicatat"
                          value={isiCatatan[a.pesertaId].hadir || undefined}
                          onValueChange={(v) => ubahCatatan(a.pesertaId, "hadir", v)}
                          options={[
                            { value: "ya", label: "Hadir" },
                            { value: "tidak", label: "Tidak hadir" },
                          ]}
                        />
                        <textarea
                          value={isiCatatan[a.pesertaId].catatan}
                          onChange={(e) => ubahCatatan(a.pesertaId, "catatan", e.target.value)}
                          maxLength={CATATAN_MAKS}
                          rows={2}
                          placeholder="Catatan / masukan"
                          aria-label={`Catatan ${a.nama}`}
                          className={AREA}
                        />
                        <textarea
                          value={isiCatatan[a.pesertaId].tindakLanjut}
                          onChange={(e) => ubahCatatan(a.pesertaId, "tindakLanjut", e.target.value)}
                          maxLength={CATATAN_MAKS}
                          rows={2}
                          placeholder="Tindak lanjut"
                          aria-label={`Tindak lanjut ${a.nama}`}
                          className={AREA}
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => simpanCatatan(s.id, a.pesertaId)}>
                            Simpan
                          </Button>
                          {tersimpan === `${s.id}:${a.pesertaId}` ? <span className={cn("text-xs text-success")}>Tersimpan</span> : null}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

/** Centang "sudah saya tonton": langsung berubah, lalu disimpan; kembali seperti semula bila gagal. */
function TandaTonton({ awal, onUbah }: { awal: boolean; onUbah: (sudah: boolean) => Promise<boolean> }) {
  const [sudah, setSudah] = useState(awal);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--accent)]"
        checked={sudah}
        onChange={async (e) => {
          const baru = e.currentTarget.checked;
          setSudah(baru);
          if (!(await onUbah(baru))) setSudah(!baru);
        }}
      />
      Sudah saya tonton
    </label>
  );
}
