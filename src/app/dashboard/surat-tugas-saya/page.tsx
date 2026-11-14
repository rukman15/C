import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { wajibPengguna } from "@/lib/server/halaman";
import { suratTugasSaya, type SuratTugasSayaRecord } from "@/lib/server/repositories/saya";
import { teksTanggalTugas } from "@/lib/persuratan";
import { tanggalPanjang } from "@/lib/dokumen";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Surat Tugas Saya" };

/** Surat Tugas Saya: surat tugas mengajar dan kedinasan yang menyebut akun ini (sama dengan aplikasi lama). */
export default async function HalamanSuratTugasSaya() {
  const p = await wajibPengguna();
  const daftar = p.pegawaiId ? await suratTugasSaya(p.pegawaiId, { umum: true }) : [];
  const hariIni = isoTanggal(awalHariWib());
  const akhir = (s: SuratTugasSayaRecord) => s.tanggalTugas.at(-1)?.selesai ?? s.tanggal;
  const bagian = [
    { judul: "Akan datang dan berjalan", isi: daftar.filter((s) => akhir(s) >= hariIni).reverse() },
    { judul: "Selesai", isi: daftar.filter((s) => akhir(s) < hariIni) },
  ];
  return (
    <HalamanDasbor judul="Surat Tugas Saya" keterangan="Surat tugas mengajar dan surat tugas kedinasan yang ditujukan kepada Anda.">
      {!p.pegawaiId ? (
        <EmptyState title="Belum tertaut" description="Akun ini belum tertaut ke data pegawai." />
      ) : !daftar.length ? (
        <EmptyState title="Belum ada surat tugas" description="Surat tugas untuk Anda akan tampil di sini." />
      ) : (
        bagian
          .filter((b) => b.isi.length)
          .map((b) => (
            <section key={b.judul} className="mb-6">
              <h2 className="mb-2 text-sm text-muted-foreground">{b.judul}</h2>
              <div className="flex flex-col gap-2">
                {b.isi.map((s) => (
                  <article key={s.sumber + s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge size="sm" tone="info">
                          {s.sumber === "mengajar" ? "Mengajar" : "Kedinasan"}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">{s.nomor ?? "Belum bernomor"}</span>
                      </div>
                      <p className="mt-1 font-medium">{s.hal}</p>
                      <p className="text-sm text-muted-foreground">{s.tanggalTugas.length ? teksTanggalTugas(s.tanggalTugas) : "-"}</p>
                      <p className="text-xs text-muted-foreground">Tanggal surat {tanggalPanjang(s.tanggal)}</p>
                    </div>
                    <ButtonLink size="sm" variant="secondary" href={s.cetak} target="_blank" rel="noopener">
                      <FileText size={14} /> PDF
                    </ButtonLink>
                  </article>
                ))}
              </div>
            </section>
          ))
      )}
    </HalamanDasbor>
  );
}
