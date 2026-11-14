import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { pelakuEvaluasi } from "@/lib/server/pelaku-evaluasi";
import { getRekapEvaluasi } from "@/lib/server/repositories/evaluasi";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabEvaluasi } from "@/components/evaluasi/tab-evaluasi";

export const metadata: Metadata = { title: "Evaluasi" };

/** Tab Evaluasi: rekap Formulir 22 & 23B; Ketua Diklat & admin mengelola, Kepala Balai & Kabag TU melihat (sama dengan aplikasi lama). */
export default async function HalamanEvaluasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    return <TabEvaluasi awal={await getRekapEvaluasi(id, await pelakuEvaluasi(["ketua-diklat", "kepala-balai", "kabag-tu"]))} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Evaluasi tidak tersedia" description={e.message} />;
    throw e;
  }
}
