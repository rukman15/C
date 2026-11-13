import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { aksesSeminar, getSeminar } from "@/lib/server/repositories/seminar";
import { isJenisSeminar } from "@/lib/seminar";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabSeminar } from "@/components/seminar/tab-seminar";

export const metadata: Metadata = { title: "Seminar" };

/** Tab Seminar: penyelenggara pemegang diklat mengelola, pimpinan membaca, penguji melihat yang ia uji (aplikasi lama + EB-055). */
export default async function HalamanSeminar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const [{ id }, { jenis }] = await Promise.all([params, searchParams]);
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    const a = await aksesSeminar(id);
    const data = await getSeminar(id, isJenisSeminar(jenis) ? jenis : "RAP", a, isoTanggal(awalHariWib()));
    return <TabSeminar data={data} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Seminar tidak tersedia" description={e.message} />;
    throw e;
  }
}
