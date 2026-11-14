import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError, ForbiddenError } from "@/lib/server/errors";
import { hakPenugasan } from "@/lib/server/hak-penugasan";
import { getPenugasanAngkatan } from "@/lib/server/repositories/penugasan-angkatan";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabPenugasan } from "@/components/penugasan/tab-penugasan";

export const metadata: Metadata = { title: "Penugasan" };

/** Tab Penugasan per angkatan (EB-035): pengelola & Admin Penyelenggara "atur-penugasan" mengelola; pimpinan membaca. */
export default async function HalamanPenugasan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    const hak = await hakPenugasan(id);
    if (!hak.baca) throw new ForbiddenError("Penugasan dibuka penyelenggara diklat dan pimpinan.");
    return <TabPenugasan awal={await getPenugasanAngkatan(id, hak.kelola)} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Penugasan tidak tersedia" description={e.message} />;
    throw e;
  }
}
