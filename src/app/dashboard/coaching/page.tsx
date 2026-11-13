import type { Metadata } from "next";
import Link from "next/link";
import { Library, MessageCircleQuestion } from "lucide-react";
import { wajibPengguna } from "@/lib/server/halaman";
import { identitasAkun } from "@/lib/server/akses-coaching";
import { listRuang } from "@/lib/server/repositories/coaching";
import { periodeSurat, tanggalPanjang } from "@/lib/dokumen";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ButtonLink } from "@/components/ui/button";
import type { PeranCoaching } from "@/lib/coaching";

export const metadata: Metadata = { title: "Ruang Coaching" };

const LABEL_PERAN: Record<PeranCoaching, string> = { coach: "Coach", penyelenggara: "Penyelenggara", peserta: "Anggota", pembaca: "Lihat saja" };

/**
 * Ruang Coaching: kelompok e-learning & pembimbingan coach yang boleh dibuka akun ini (dibimbing, diselenggarakan,
 * kelompok sendiri, atau semua untuk pimpinan). Sama dengan aplikasi lama.
 */
export default async function HalamanCoaching() {
  const p = await wajibPengguna();
  const daftar = await listRuang(await identitasAkun(), isoTanggal(awalHariWib()));
  const punyaPustaka = !!p.pegawaiId && ["widyaiswara", "ketua-diklat", "admin"].includes(p.role);
  const bagian = [
    { judul: "Berjalan dan akan datang", isi: daftar.filter((r) => r.training.status !== "Selesai") },
    { judul: "Diklat selesai", isi: daftar.filter((r) => r.training.status === "Selesai") },
  ];
  return (
    <HalamanDasbor judul="Ruang Coaching" keterangan="Video, jadwal sesi, catatan coach, dan forum tanya-jawab tiap kelompok pembimbingan aksi perubahan.">
      {punyaPustaka ? (
        <ButtonLink variant="secondary" size="sm" className="-mt-4 mb-6" href="/dashboard/coaching/video">
          <Library size={14} /> Pustaka Video Saya
        </ButtonLink>
      ) : null}
      {daftar.length === 0 ? (
        <EmptyState
          title="Belum ada ruang coaching untuk Anda"
          description="Ruang dibuat otomatis untuk setiap kelompok E-learning & pembimbingan coach di tab Kelompok jadwal PKA/PKP. Coach melihat ruangnya setelah ditetapkan sebagai coach kelompok."
        />
      ) : (
        bagian
          .filter((b) => b.isi.length)
          .map((b) => (
            <section key={b.judul} className="mb-8">
              <h2 className="mb-3 text-sm text-muted-foreground">{b.judul}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {b.isi.map((r) => (
                  <Link
                    key={r.kelompokId}
                    href={`/dashboard/coaching/${r.kelompokId}`}
                    className="flex flex-col gap-2 rounded-2xl border border-border p-4 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{r.label}</p>
                        <p className="text-sm text-muted-foreground">{r.training.name}</p>
                      </div>
                      <Badge size="sm">{LABEL_PERAN[r.peran]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {periodeSurat(r.training.startDate, r.training.endDate)} · Coach: {r.coachNama ?? "belum ditetapkan"} · <span className="font-mono">{r.anggota}</span> peserta
                    </p>
                    {r.belumDibaca || (r.topikBelumTerjawab && r.peran !== "peserta") ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.belumDibaca ? (
                          <Badge size="sm" tone="info" dot>
                            {r.belumDibaca} tulisan baru
                          </Badge>
                        ) : null}
                        {r.topikBelumTerjawab && r.peran !== "peserta" ? (
                          <Badge size="sm" tone="warning" icon={<MessageCircleQuestion size={12} />}>
                            {r.topikBelumTerjawab} belum terjawab
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                    {r.sesiBerikutnya ? (
                      <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
                        Sesi berikutnya: <span className="text-foreground">{r.sesiBerikutnya.judul}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {tanggalPanjang(r.sesiBerikutnya.tanggal)}
                          {r.sesiBerikutnya.jamMulai ? `, ${r.sesiBerikutnya.jamMulai} WIB` : ""}
                        </span>
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))
      )}
    </HalamanDasbor>
  );
}
