import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { wajibPengguna } from "@/lib/server/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PengerjaanTes } from "@/components/peserta/pengerjaan-tes";

export const metadata: Metadata = { title: "Pre/Post Test" };

/** Pengerjaan pre-test / post-test oleh peserta sendiri (admin tidak bisa mengerjakan atas nama peserta). */
export default async function HalamanTes({ params }: { params: Promise<{ id: string; jenis: string }> }) {
  const { id, jenis } = await params;
  const j = jenis.toLowerCase();
  if (j !== "pre" && j !== "post") notFound();
  const p = await wajibPengguna();
  if (p.role !== "peserta")
    return <EmptyState title="Khusus peserta" description="Hanya peserta yang mengerjakan tes. Penyelenggara mengelola tes di tab Pre/Post Test pada Rincian Diklat." />;
  return <PengerjaanTes pesertaId={id} jenis={j} />;
}
