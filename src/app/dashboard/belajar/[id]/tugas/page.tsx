import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { getTugasPeserta } from "@/lib/server/repositories/tugas";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TugasPeserta } from "@/components/peserta/tugas-peserta";

export const metadata: Metadata = { title: "Tugas" };

/** Tugas milik peserta sendiri (EB-038), sama dengan aplikasi lama: hanya peran peserta. */
export default async function HalamanTugas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  if (p.role !== "peserta") return <EmptyState title="Khusus peserta" description="Tugas diunggah dan dikirim oleh pesertanya sendiri. Peninjau membukanya di Tinjau Tugas." />;
  try {
    return <TugasPeserta pesertaId={id} awal={await getTugasPeserta(id, p.email)} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Tugas tidak ditemukan" description={e.message} />;
    throw e;
  }
}
