import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { getPengguna } from "@/lib/server/pengguna";
import { listSesiPembelajaran } from "@/lib/server/repositories/pembelajaran";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabAbsensi } from "@/components/absensi/tab-absensi";

export const metadata: Metadata = { title: "Jadwal & Absensi" };

/** Tab Jadwal & Absensi: dibaca Ketua Diklat dan Kepala Balai, diubah Ketua Diklat (admin selalu boleh), sama dengan aplikasi lama. */
export default async function HalamanAbsensi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  const role = (await getPengguna())?.role;
  if (role !== "admin" && role !== "ketua-diklat" && role !== "kepala-balai") {
    return <EmptyState title="Tidak berwenang" description="Jadwal pembelajaran dan absensi dibuka Ketua Diklat dan Kepala Balai." />;
  }
  const data = await listSesiPembelajaran(id);
  return <TabAbsensi data={data} bolehAtur={role === "admin" || role === "ketua-diklat"} />;
}
