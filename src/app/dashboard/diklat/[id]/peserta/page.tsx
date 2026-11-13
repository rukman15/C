import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { getPengguna } from "@/lib/server/pengguna";
import { listPeserta } from "@/lib/server/repositories/peserta";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabPeserta } from "@/components/rincian/tab-peserta";

export const metadata: Metadata = { title: "Peserta" };

/** Tab Peserta: dibaca Ketua Diklat dan Kepala Balai, dikelola Ketua Diklat (admin selalu boleh), sama dengan aplikasi lama. */
export default async function HalamanPeserta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null;
  const p = await getPengguna();
  const role = p?.role;
  if (role !== "admin" && role !== "ketua-diklat" && role !== "kepala-balai") {
    return <EmptyState title="Tidak berwenang" description="Daftar peserta dibuka Ketua Diklat dan Kepala Balai." />;
  }
  const data = await listPeserta(id);
  return <TabPeserta trainingId={id} data={data} bolehUbah={role === "admin" || role === "ketua-diklat"} />;
}
