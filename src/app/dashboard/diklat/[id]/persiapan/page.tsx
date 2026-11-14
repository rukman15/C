import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { AppError } from "@/lib/server/errors";
import { wajibBacaFormulir, wajibKelolaFormulir } from "@/lib/server/akses";
import { getPemantauan } from "@/lib/server/repositories/formulir-penyelenggaraan";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabPersiapan } from "@/components/persiapan/tab-persiapan";

export const metadata: Metadata = { title: "Persiapan" };

/** Tab Persiapan (Formulir 2): penyelenggara pemegang diklat mengisi, pimpinan melihat — sama dengan aplikasi lama. */
export default async function HalamanPersiapan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  try {
    await wajibBacaFormulir(id);
    const bolehUbah = await wajibKelolaFormulir(id).then(
      () => true,
      () => false,
    );
    return <TabPersiapan awal={await getPemantauan(id)} bolehUbah={bolehUbah} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Persiapan tidak tersedia" description={e.message} />;
    throw e;
  }
}
