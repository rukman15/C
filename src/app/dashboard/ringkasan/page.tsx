import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/server/halaman";
import { getRingkasanLembaga } from "@/lib/server/repositories/ringkasan";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ringkasan Lembaga" };

const fmtTanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function Angka({ nilai, label, nada }: { nilai: number; label: string; nada?: "success" | "warning" | "danger" | "muted" }) {
  return (
    <div className="rounded-xl bg-muted/50 py-3 text-center">
      <p
        className={cn(
          "font-display text-2xl font-medium",
          nada === "success" && "text-success",
          nada === "warning" && "text-warning",
          nada === "danger" && "text-destructive",
          nada === "muted" && "text-muted-foreground",
        )}
      >
        {nilai}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Kartu({ judul, children, tautan }: { judul: string; children: React.ReactNode; tautan?: { href: string; label: string } }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 className="font-display text-base font-medium">{judul}</h2>
      {children}
      {tautan ? (
        <Link href={tautan.href} className="text-xs text-primary underline underline-offset-2">
          {tautan.label}
        </Link>
      ) : null}
    </section>
  );
}

/** Ringkasan Lembaga — Kepala Balai dan Kabag TU (admin ikut lolos), sama dengan aplikasi lama. Hanya baca. */
export default async function HalamanRingkasan() {
  const p = await wajibPengguna();
  if (p.role !== "admin" && p.role !== "kepala-balai" && p.role !== "kabag-tu")
    return (
      <HalamanDasbor judul="Ringkasan Lembaga">
        <EmptyState title="Tidak berwenang" description="Halaman ini untuk Kepala Balai dan Kabag TU." />
      </HalamanDasbor>
    );
  const d = await getRingkasanLembaga({ persuratan: true });
  const wi = d.widyaiswara;
  const persenJp = wi.totalJpMaksimal > 0 ? Math.round((wi.jpTerpakaiBerKapasitas / wi.totalJpMaksimal) * 100) : null;
  const perhatian: { teks: string; href?: string; label?: string }[] = [];
  if (d.penugasanWi.menunggu > 0)
    perhatian.push({ teks: `${d.penugasanWi.menunggu} pengajuan WI lama belum ditetapkan penyelenggara.`, href: "/dashboard/jadwal", label: "Lihat" });
  if (d.penugasanWi.trainingButuhWiSegera.length > 0)
    perhatian.push({ teks: `${d.penugasanWi.trainingButuhWiSegera.length} pelatihan sudah lewat batas H-3 tapi belum punya WI yang disetujui.` });
  if (wi.jumlahOverCapacity > 0) perhatian.push({ teks: `${wi.jumlahOverCapacity} Widyaiswara melebihi batas JP bulan ini.`, href: "/dashboard/wi", label: "Lihat beban JP" });

  return (
    <HalamanDasbor judul="Ringkasan Lembaga" keterangan="Gambaran cepat pelatihan, penugasan Widyaiswara, dan kepegawaian.">
      <div className="flex flex-col gap-4">
        {perhatian.length ? (
          <section className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <h2 className="text-sm font-medium text-warning">Perlu perhatian</h2>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {perhatian.map((x) => (
                <li key={x.teks} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{x.teks}</span>
                  {x.href ? (
                    <Link href={x.href} className="underline underline-offset-2">
                      {x.label}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            {d.penugasanWi.trainingButuhWiSegera.length ? (
              <ul className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
                {d.penugasanWi.trainingButuhWiSegera.map((t) => (
                  <li key={t.id}>
                    <Link href={`/dashboard/diklat/${encodeURIComponent(t.id)}`} className="underline underline-offset-2">
                      {t.name}
                    </Link>{" "}
                    · mulai {fmtTanggal(t.startDate)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Kartu judul="Pelatihan">
            <div className="grid grid-cols-3 gap-2">
              <Angka nilai={d.pelatihan.terjadwal} label="Terjadwal" />
              <Angka nilai={d.pelatihan.berjalan} label="Berjalan" nada="success" />
              <Angka nilai={d.pelatihan.selesai} label="Selesai" nada="muted" />
            </div>
            <p className="text-xs text-muted-foreground">
              Peserta pada pelatihan aktif: <span className="font-mono text-foreground">{d.pelatihan.totalPesertaAktif}</span> orang
            </p>
          </Kartu>
          <Kartu judul="Penugasan Widyaiswara" tautan={{ href: "/dashboard/jadwal", label: "Buka Jadwal Diklat" }}>
            <div className="grid grid-cols-3 gap-2">
              <Angka nilai={d.penugasanWi.menunggu} label="Pengajuan lama" nada="warning" />
              <Angka nilai={d.penugasanWi.disetujui} label="Pengampu" nada="success" />
              <Angka nilai={d.penugasanWi.ditolak} label="Ditolak (lama)" nada="danger" />
            </div>
          </Kartu>
          <Kartu judul="Beban JP Widyaiswara" tautan={{ href: "/dashboard/wi", label: "Lihat grafik beban JP" }}>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{wi.total}</span> Widyaiswara · JP bulan ini <span className="font-mono text-foreground">{wi.totalJpTerpakai}</span>
            </p>
            {persenJp !== null ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", persenJp > 100 ? "bg-destructive" : persenJp >= 80 ? "bg-warning" : "bg-success")}
                    style={{ width: `${Math.min(persenJp, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{wi.jpTerpakaiBerKapasitas}</span> dari <span className="font-mono">{wi.totalJpMaksimal}</span> JP batas bulan ini (
                  <span className="font-mono">{persenJp}%</span>)
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Persentase belum bisa dihitung: batas JP Widyaiswara belum diatur (admin: Aturan JP).</p>
            )}
            {wi.jumlahBelumAdaJpMaksimal > 0 ? <p className="text-xs text-muted-foreground">Kapasitas JP belum diisi untuk {wi.jumlahBelumAdaJpMaksimal} Widyaiswara.</p> : null}
          </Kartu>
          <Kartu judul="Kepegawaian" tautan={{ href: "/dashboard/pegawai", label: "Buka data pegawai" }}>
            <div className="grid grid-cols-2 gap-2">
              <Angka nilai={d.pegawai.total} label="Total pegawai" />
              <Angka nilai={d.pegawai.aktif} label="Aktif" nada="success" />
            </div>
          </Kartu>
          {d.tugasKeluar ? (
            <Kartu judul="Tugas keluar tahun ini" tautan={{ href: "/dashboard/persuratan/spd", label: "Buka SPD" }}>
              <div className="grid grid-cols-3 gap-2">
                <Angka nilai={d.tugasKeluar.pegawaiUnik} label="Orang ditugaskan" />
                <Angka nilai={d.tugasKeluar.suratUmum} label="Surat tugas umum" />
                <Angka nilai={d.tugasKeluar.suratTerkaitDiklat} label="Terkait diklat" />
              </div>
              <p className="text-xs text-muted-foreground">
                Surat tugas mengajar: <span className="font-mono text-foreground">{d.tugasKeluar.suratMengajar}</span> · SPD belum dibuat:{" "}
                <span className={cn("font-mono", d.tugasKeluar.spdBelumDibuat > 0 ? "text-warning" : "text-foreground")}>{d.tugasKeluar.spdBelumDibuat}</span>
              </p>
            </Kartu>
          ) : null}
        </div>
      </div>
    </HalamanDasbor>
  );
}
