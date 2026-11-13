import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { getPengguna } from "@/lib/server/pengguna";
import { AppError } from "@/lib/server/errors";
import { getKelompok } from "@/lib/server/repositories/kelompok";
import { JENIS_KELOMPOK_BAWAAN, isJenisKelompok } from "@/lib/kelompok";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabKelompok } from "@/components/kelompok/tab-kelompok";
import { PanelStula } from "@/components/kelompok/panel-stula";
import { getStula } from "@/lib/server/repositories/stula";

export const metadata: Metadata = { title: "Kelompok" };

/** Tab Kelompok: dikelola Ketua Diklat (admin selalu boleh), dibaca Kepala Balai dan Kabag TU, sama dengan aplikasi lama. */
export default async function HalamanKelompok({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const [{ id }, { jenis }] = await Promise.all([params, searchParams]);
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  const role = (await getPengguna())?.role;
  if (!role || !["admin", "ketua-diklat", "kepala-balai", "kabag-tu"].includes(role)) {
    return <EmptyState title="Tidak berwenang" description="Kelompok peserta dikelola Ketua Diklat dan dibaca Kepala Balai serta Kabag TU." />;
  }
  try {
    const kelola = role === "admin" || role === "ketua-diklat";
    const data = await getKelompok(id, kelola, isJenisKelompok(jenis) ? jenis : JENIS_KELOMPOK_BAWAAN);
    if (data.jenis !== "STULA") return <TabKelompok data={data} />;
    // Studi lapangan: kelompok + daftar lokasi, advance kunjungan, dan peringatan H-7 (EB-053).
    const stula = await getStula(id, kelola);
    return (
      <div className="flex flex-col gap-6">
        <TabKelompok data={data} />
        <PanelStula trainingId={id} data={stula} />
      </div>
    );
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Kelompok tidak tersedia" description={e.message} />;
    throw e;
  }
}
