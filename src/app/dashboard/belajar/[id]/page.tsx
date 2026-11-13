import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { getRuangBelajar } from "@/lib/server/repositories/belajar";
import { listTesPeserta } from "@/lib/server/repositories/tes";
import { getEvaluasiPeserta } from "@/lib/server/repositories/evaluasi";
import { getMentorSaya } from "@/lib/server/repositories/penugasan-angkatan";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { RuangBelajar } from "@/components/peserta/ruang-belajar";
import { getFolderBerkas } from "@/lib/server/repositories/berkas-peserta";
import { getTugasPeserta } from "@/lib/server/repositories/tugas";
import type { RingkasTugasWi } from "@/components/peserta/folder-peserta";

export const metadata: Metadata = { title: "Ruang Belajar" };

/**
 * Ruang belajar satu peserta (sama dengan aplikasi lama): peserta hanya membuka miliknya sendiri;
 * Ketua Diklat, Kepala Balai, dan admin membukanya sebagai pratinjau.
 */
export default async function HalamanRuangBelajar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  if (!["peserta", "ketua-diklat", "kepala-balai", "admin"].includes(p.role)) {
    return <EmptyState title="Tidak berwenang" description="Ruang belajar dibuka oleh pesertanya sendiri, atau oleh Ketua Diklat dan Kepala Balai sebagai pratinjau." />;
  }
  const pembaca = p.role === "peserta" ? ({ pratinjau: false, email: p.email } as const) : ({ pratinjau: true } as const);
  try {
    const [data, tes, evaluasi, mentor, folder, tugas] = await Promise.all([
      getRuangBelajar(id, pembaca),
      listTesPeserta(id, pembaca).catch(() => []),
      getEvaluasiPeserta(id, pembaca).catch(() => null),
      p.role === "peserta" ? getMentorSaya(id, p.email).catch(() => null) : Promise.resolve(null),
      getFolderBerkas(id, pembaca).catch(() => []),
      p.role === "peserta" ? getTugasPeserta(id, p.email).catch(() => null) : Promise.resolve(null),
    ]);
    // Folder "Tugas dari WI" (EB-051): tugas pembelajaran dari pengampu, dengan keadaan kiriman peserta.
    const wi = tugas?.tugas.filter((x) => x.jenis === "TUGAS_PEMBELAJARAN") ?? [];
    const tugasWi: RingkasTugasWi = tugas
      ? {
          jumlah: wi.length,
          perlu: wi.filter((x) => !x.kiriman || x.kiriman.status === "DRAF" || x.kiriman.status === "PERLU_REVISI").length,
          diterima: wi.filter((x) => x.kiriman?.status === "DITERIMA").length,
        }
      : null;
    return <RuangBelajar data={data} tes={tes} evaluasi={evaluasi} mentor={mentor} folder={folder} tugasWi={tugasWi} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Ruang belajar tidak ditemukan" description={e.message} />;
    throw e;
  }
}
