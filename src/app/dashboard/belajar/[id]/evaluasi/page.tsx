import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { getEvaluasiPeserta } from "@/lib/server/repositories/evaluasi";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { EvaluasiPeserta } from "@/components/peserta/evaluasi-peserta";

export const metadata: Metadata = { title: "Evaluasi" };

/** Evaluasi pengajar & penyelenggaraan oleh peserta; Ketua Diklat, Kepala Balai, admin melihat sebagai pratinjau. */
export default async function HalamanEvaluasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  if (!["peserta", "ketua-diklat", "kepala-balai", "admin"].includes(p.role)) return <EmptyState title="Tidak berwenang" description="Evaluasi diisi oleh peserta." />;
  try {
    const data = await getEvaluasiPeserta(id, p.role === "peserta" ? { pratinjau: false, email: p.email } : { pratinjau: true });
    return <EvaluasiPeserta pesertaId={id} data={data} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Evaluasi tidak bisa dibuka" description={e.message} />;
    throw e;
  }
}
