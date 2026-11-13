import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { penilaiSesi } from "@/lib/server/penilai";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabPenilaian } from "@/components/penilaian/tab-penilaian";

export const metadata: Metadata = { title: "Penilaian" };

/** Tab Penilaian: Ketua Diklat/admin mengisi & merekap, WI yang ditugaskan menilai aspek bagiannya, pimpinan melihat. */
export default async function HalamanPenilaian({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    const data = await getLembarPenilaian(id, await penilaiSesi("baca"));
    return <TabPenilaian awal={data} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Penilaian tidak tersedia" description={e.message} />;
    throw e;
  }
}
