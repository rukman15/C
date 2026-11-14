import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { aksesDiklat, wajibKelolaTraining } from "@/lib/server/akses";
import { getDokumenJadwal } from "@/lib/server/repositories/dokumen-peserta";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabDokumen } from "@/components/dokumen/tab-dokumen";

export const metadata: Metadata = { title: "Dokumen" };

/** Tab Dokumen: hanya penyelenggara pemegang diklat (data sensitif; pimpinan tidak), sama dengan aplikasi lama. */
export default async function HalamanDokumen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    await wajibKelolaTraining(await aksesDiklat(), id);
    return <TabDokumen awal={await getDokumenJadwal(id)} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Dokumen tidak tersedia" description={e.message} />;
    throw e;
  }
}
