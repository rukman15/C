import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { getPengguna } from "@/lib/server/pengguna";
import { AppError } from "@/lib/server/errors";
import { getKelompok } from "@/lib/server/repositories/kelompok";
import { JENIS_KELOMPOK_BAWAAN, isJenisKelompok } from "@/lib/kelompok";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabKelompok } from "@/components/kelompok/tab-kelompok";

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
    const data = await getKelompok(id, role === "admin" || role === "ketua-diklat", isJenisKelompok(jenis) ? jenis : JENIS_KELOMPOK_BAWAAN);
    return <TabKelompok data={data} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Kelompok tidak tersedia" description={e.message} />;
    throw e;
  }
}
