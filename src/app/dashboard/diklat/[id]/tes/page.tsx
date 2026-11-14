import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { pelakuTes } from "@/lib/server/pelaku-tes";
import { getKelolaTes } from "@/lib/server/repositories/tes";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabTes } from "@/components/tes/tab-tes";

export const metadata: Metadata = { title: "Pre/Post Test" };

/** Tab Pre/Post Test: Ketua Diklat & admin mengelola; Kepala Balai & Kabag TU melihat hasil (sama dengan aplikasi lama). */
export default async function HalamanTes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    return <TabTes awal={await getKelolaTes(id, await pelakuTes(["ketua-diklat", "kepala-balai", "kabag-tu"]))} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Pre/Post Test tidak tersedia" description={e.message} />;
    throw e;
  }
}
