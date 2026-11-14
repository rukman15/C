"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Select } from "@/components/arc/select/select";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { periodeSurat } from "@/lib/dokumen";
import { JENIS_CUTI, hariKerja, type JenisCuti } from "@/lib/persuratan";
import type { PilihanKlien } from "@/lib/persuratan-klien";
import { ambilJson, kirimJson } from "@/lib/api-klien";
import { cn } from "@/lib/utils";
import type { CutiRecord } from "@/lib/server/repositories/cuti";
import { ISIAN } from "./isian";

const DIRI = "__diri";
const LAMA: Record<string, { label: string; tone: BadgeTone }> = {
  DIAJUKAN: { label: "Pengajuan lama", tone: "warning" },
  DITOLAK: { label: "Ditolak", tone: "danger" },
  DIBATALKAN: { label: "Dibatalkan", tone: "neutral" },
};

/**
 * Surat cuti pegawai (keputusan 28 Okt 2026, sama dengan aplikasi lama): cuti TIDAK diajukan/diputuskan di aplikasi. Kepegawaian/TU
 * membuat Nota Dinas + Surat Izin Cuti; nomor diketik pembuat surat. Cuti sakit: alasan medis tidak diminta dan tidak disimpan.
 * Pengajuan LAMA yang masih "Diajukan" tetap bisa disetujui/ditolak/dibatalkan.
 */
export function Cuti({ hariIni }: { hariIni: string }) {
  const [pilihan, setPilihan] = useState<PilihanKlien | null>(null);
  const [daftar, setDaftar] = useState<CutiRecord[] | null>(null);
  const [cari, setCari] = useState("");
  const [galat, setGalat] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [nomorUntuk, setNomorUntuk] = useState<{ id: string; nota: string; izin: string } | null>(null);
  const [tolakUntuk, setTolakUntuk] = useState<{ id: string; alasan: string } | null>(null);

  const muat = useCallback(async () => {
    const r = await ambilJson<CutiRecord[]>("/api/persuratan/cuti");
    if (r.ok) setDaftar(r.data);
    else setGalat(r.error);
  }, []);
  useEffect(() => {
    ambilJson<PilihanKlien>("/api/persuratan/pilihan").then((r) => (r.ok ? setPilihan(r.data) : setGalat(r.error)));
    muat();
  }, [muat]);

  const kelola = !!pilihan?.hak.kelolaCuti;
  const q = cari.trim().toLowerCase();
  const tampil = (daftar ?? []).filter((c) => !q || `${c.pegawaiNama} ${c.label} ${c.nomorNotaDinas ?? ""} ${c.nomorSuratIzin ?? ""}`.toLowerCase().includes(q));
  const milikSaya = (c: CutiRecord) => !!pilihan?.pegawaiId && c.pegawaiId === pilihan.pegawaiId;

  async function patch(c: CutiRecord, body: Record<string, unknown>, sukses: (d: CutiRecord) => string) {
    setGalat("");
    const r = await kirimJson<CutiRecord>(`/api/persuratan/cuti/${encodeURIComponent(c.id)}`, "PATCH", body);
    if (!r.ok) setGalat(r.error);
    else setToast(sukses(r.data));
    muat();
    return r.ok;
  }
  async function hapus(c: CutiRecord) {
    if (!confirm(`Hapus surat ${c.label.toLowerCase()} ${c.pegawaiNama}?\n${periodeSurat(c.mulai, c.selesai)}`)) return;
    setGalat("");
    const r = await kirimJson(`/api/persuratan/cuti/${encodeURIComponent(c.id)}`, "DELETE");
    if (!r.ok) setGalat(r.error);
    else setToast("Surat cuti dihapus.");
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      {galat ? <Alert tone="danger" title={galat} /> : null}
      {kelola && pilihan ? (
        <FormCuti
          pilihan={pilihan}
          hariIni={hariIni}
          onDibuat={(c) => {
            setToast(`Surat ${c.label.toLowerCase()} ${c.pegawaiNama} dibuat.`);
            muat();
          }}
        />
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg font-medium">{kelola ? "Surat cuti" : "Cuti saya"}</h2>
          {daftar?.length ? (
            <div className="w-64">
              <Input label="Cari" value={cari} onChange={setCari} placeholder="Nama, jenis, nomor…" leftIcon={<Search size={16} />} />
            </div>
          ) : null}
        </div>
        {!daftar ? (
          <p className="text-sm text-muted-foreground" role="status">
            Memuat…
          </p>
        ) : !daftar.length ? (
          <EmptyState title={kelola ? "Belum ada surat cuti" : "Belum ada surat cuti untuk Anda"} description="Surat cuti yang dibuat Kepegawaian/TU tampil di sini." />
        ) : !tampil.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada surat cuti yang cocok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Pegawai</th>
                  <th className="px-3 py-2 font-medium">Cuti</th>
                  <th className="px-3 py-2 font-medium">Nomor</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((c) => (
                  <tr key={c.id} className="border-b border-border align-top">
                    <td className="px-3 py-2">
                      {c.pegawaiNama}
                      <div className="text-xs text-muted-foreground">{c.pegawaiJabatan}</div>
                    </td>
                    <td className="px-3 py-2">
                      {c.label} · <span className="font-mono">{c.lamaHari}</span> hari kerja
                      <div className="text-xs text-muted-foreground">
                        {periodeSurat(c.mulai, c.selesai)}
                        {c.alasan ? ` · ${c.alasan}` : ""}
                      </div>
                      {LAMA[c.status] ? (
                        <Badge size="sm" tone={LAMA[c.status].tone} className="mt-1">
                          {LAMA[c.status].label}
                        </Badge>
                      ) : null}
                      {c.alasanTolak ? <div className="text-xs text-destructive">{c.alasanTolak}</div> : null}
                      {!c.pemberiIzin.diBalai ? <div className="text-xs text-warning">Izin dari {c.pemberiIzin.jabatan}; balai membuat nota dinas permohonan saja</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      {nomorUntuk?.id === c.id ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={nomorUntuk.nota}
                            onChange={(e) => setNomorUntuk({ ...nomorUntuk, nota: e.target.value })}
                            placeholder="Nomor nota dinas"
                            aria-label="Nomor nota dinas"
                            maxLength={120}
                            className={cn(ISIAN, "h-8 w-56 font-mono text-xs")}
                          />
                          {c.pemberiIzin.diBalai ? (
                            <input
                              value={nomorUntuk.izin}
                              onChange={(e) => setNomorUntuk({ ...nomorUntuk, izin: e.target.value })}
                              placeholder="Nomor surat izin"
                              aria-label="Nomor surat izin"
                              maxLength={120}
                              className={cn(ISIAN, "h-8 w-56 font-mono text-xs")}
                            />
                          ) : null}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={async () => {
                                await patch(
                                  c,
                                  { aksi: "nomor", nomorNotaDinas: nomorUntuk.nota || null, nomorSuratIzin: nomorUntuk.izin || null },
                                  () => `Nomor surat cuti ${c.pegawaiNama} disimpan.`,
                                );
                                setNomorUntuk(null);
                              }}
                            >
                              Simpan
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setNomorUntuk(null)}>
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : c.nomorNotaDinas || c.nomorSuratIzin ? (
                        <>
                          {c.nomorNotaDinas ? (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Nota dinas:</span> <span className="font-mono">{c.nomorNotaDinas}</span>
                            </div>
                          ) : null}
                          {c.nomorSuratIzin ? (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Surat izin:</span> <span className="font-mono">{c.nomorSuratIzin}</span>
                            </div>
                          ) : null}
                        </>
                      ) : c.status === "DISETUJUI" ? (
                        <Badge size="sm" tone="warning">
                          Belum bernomor
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {c.status === "DIAJUKAN" && pilihan?.hak.putusCuti && !milikSaya(c) ? (
                          tolakUntuk?.id === c.id ? (
                            <>
                              <input
                                value={tolakUntuk.alasan}
                                onChange={(e) => setTolakUntuk({ ...tolakUntuk, alasan: e.target.value })}
                                placeholder="Alasan penolakan"
                                aria-label="Alasan penolakan"
                                className={cn(ISIAN, "h-8 w-48 text-xs")}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!tolakUntuk.alasan.trim()}
                                onClick={async () => {
                                  await patch(c, { aksi: "tolak", alasanTolak: tolakUntuk.alasan }, (d) => `${d.label} ${d.pegawaiNama}: ${d.labelStatus.toLowerCase()}.`);
                                  setTolakUntuk(null);
                                }}
                              >
                                Tolak
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setTolakUntuk(null)}>
                                Batal
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => patch(c, { aksi: "setujui" }, (d) => `${d.label} ${d.pegawaiNama}: ${d.labelStatus.toLowerCase()}.`)}
                              >
                                Setujui
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setTolakUntuk({ id: c.id, alasan: "" })}>
                                Tolak
                              </Button>
                            </>
                          )
                        ) : null}
                        {c.status === "DIAJUKAN" && (milikSaya(c) || kelola) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              confirm(`Batalkan pengajuan ${c.label.toLowerCase()} ${c.pegawaiNama}?\n${periodeSurat(c.mulai, c.selesai)}`) &&
                              patch(c, { aksi: "batal" }, (d) => `${d.label} ${d.pegawaiNama}: ${d.labelStatus.toLowerCase()}.`)
                            }
                          >
                            Batalkan
                          </Button>
                        ) : null}
                        {c.status === "DISETUJUI" ? (
                          <>
                            {kelola && nomorUntuk?.id !== c.id ? (
                              <Button size="sm" variant="secondary" onClick={() => setNomorUntuk({ id: c.id, nota: c.nomorNotaDinas ?? "", izin: c.nomorSuratIzin ?? "" })}>
                                {c.nomorNotaDinas || c.nomorSuratIzin ? "Ubah nomor" : "Isi nomor"}
                              </Button>
                            ) : null}
                            <ButtonLink size="sm" variant="ghost" href={`/api/persuratan/cuti/${encodeURIComponent(c.id)}/docx`} download>
                              Word
                            </ButtonLink>
                            <ButtonLink size="sm" variant="ghost" href={`/cetak/cuti/${encodeURIComponent(c.id)}`} target="_blank" rel="noopener">
                              PDF
                            </ButtonLink>
                          </>
                        ) : null}
                        {kelola && c.status !== "DIAJUKAN" ? (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => hapus(c)}>
                            Hapus
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Toast title="Cuti" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </div>
  );
}

function FormCuti({ pilihan, hariIni, onDibuat }: { pilihan: PilihanKlien; hariIni: string; onDibuat: (c: CutiRecord) => void }) {
  const [pegawaiId, setPegawaiId] = useState("");
  const [jenis, setJenis] = useState<JenisCuti>("TAHUNAN");
  const [mulai, setMulai] = useState(hariIni);
  const [selesai, setSelesai] = useState(hariIni);
  const [lamaHari, setLamaHari] = useState("1");
  const [alasan, setAlasan] = useState("");
  const [nota, setNota] = useState("");
  const [izin, setIzin] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Lama cuti mengikuti hari kerja (Senin–Jumat); bisa dikurangi bila ada libur nasional.
  function ubahTanggal(m: string, s: string) {
    setMulai(m);
    setSelesai(s);
    setLamaHari(String(Math.max(1, hariKerja(m, s))));
  }
  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!pilihan.pegawaiId && !pegawaiId) return setGalat("Pilih pegawai.");
    if (jenis !== "SAKIT" && !alasan.trim()) return setGalat("Alasan wajib diisi.");
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<CutiRecord>("/api/persuratan/cuti", "POST", {
      pegawaiId: pegawaiId || null,
      jenis,
      mulai,
      selesai,
      lamaHari: Number(lamaHari),
      alasan: jenis === "SAKIT" ? null : alasan,
      nomorNotaDinas: nota || null,
      nomorSuratIzin: izin || null,
    });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setAlasan("");
    setNota("");
    setIzin("");
    onDibuat(r.data);
  }
  return (
    <form onSubmit={kirim} noValidate className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-4">
      <h2 className="font-display text-lg font-medium sm:col-span-4">Buat surat cuti</h2>
      <div className="sm:col-span-2">
        <Select
          label="Pegawai"
          value={pegawaiId || (pilihan.pegawaiId ? DIRI : "")}
          onValueChange={(v) => setPegawaiId(v === DIRI ? "" : v)}
          placeholder="Pilih pegawai…"
          options={[...(pilihan.pegawaiId ? [{ value: DIRI, label: "Diri sendiri" }] : []), ...pilihan.pegawai.map((p) => ({ value: p.id, label: p.nama }))]}
        />
      </div>
      <div className="sm:col-span-2">
        <Select label="Jenis cuti" value={jenis} onValueChange={(v) => setJenis(v as JenisCuti)} options={JENIS_CUTI.map((j) => ({ value: j.kode, label: j.label }))} />
      </div>
      <Input label="Mulai" type="date" value={mulai} onChange={(v) => ubahTanggal(v, selesai < v ? v : selesai)} />
      <Input label="Selesai" type="date" value={selesai} min={mulai} onChange={(v) => ubahTanggal(mulai, v)} />
      <Input label="Lama (hari kerja)" type="number" min={1} value={lamaHari} onChange={setLamaHari} />
      {jenis === "SAKIT" ? (
        <p className="text-xs text-muted-foreground sm:col-span-4">
          Cuti sakit: rincian penyakit tidak perlu ditulis dan tidak disimpan. Surat keterangan dokter diserahkan langsung ke Kepegawaian.
        </p>
      ) : (
        <div className="sm:col-span-4">
          <Input label="Alasan" value={alasan} onChange={setAlasan} maxLength={500} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Input label="Nomor nota dinas (boleh menyusul)" value={nota} onChange={setNota} maxLength={120} />
      </div>
      <div className="sm:col-span-2">
        <Input label="Nomor surat izin (bila izin dari Kepala Balai)" value={izin} onChange={setIzin} maxLength={120} />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-4">Lama cuti dihitung Senin–Jumat; kurangi sendiri bila ada libur nasional atau cuti bersama.</p>
      {galat ? <Alert tone="danger" title={galat} className="sm:col-span-4" /> : null}
      <div className="sm:col-span-4">
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Buat surat cuti"}
        </Button>
      </div>
    </form>
  );
}
