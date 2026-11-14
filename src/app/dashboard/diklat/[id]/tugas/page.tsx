import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { getTugasDiklat } from "@/lib/server/repositories/tugas";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabTugas } from "@/components/tugas/tab-tugas";

export const metadata: Metadata = { title: "Tugas" };

/** Tab Tugas (EB-038): pengelola & pengampu membuat tugas; pimpinan membaca. Hak dijaga repository, sama dengan aplikasi lama. */
export default async function HalamanTugas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    return <TabTugas awal={await getTugasDiklat(await penggunaTugas(), id)} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Tugas tidak tersedia" description={e.message} />;
    throw e;
  }
}
