import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { akunIdDariEmail, getDokumenPeserta } from "@/lib/server/repositories/dokumen-peserta";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DokumenPersyaratan } from "@/components/peserta/dokumen-persyaratan";

export const metadata: Metadata = { title: "Dokumen Persyaratan" };

/** Dokumen persyaratan milik peserta sendiri (sama dengan aplikasi lama: hanya peran peserta). */
export default async function HalamanDokumen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  if (p.role !== "peserta")
    return <EmptyState title="Khusus peserta" description="Dokumen persyaratan diunggah oleh pesertanya sendiri. Penyelenggara memeriksanya di tab Dokumen pada Rincian Diklat." />;
  try {
    const data = await getDokumenPeserta(id, { peran: "PESERTA", akunId: await akunIdDariEmail(p.email) });
    return <DokumenPersyaratan pesertaId={id} data={data} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Dokumen tidak ditemukan" description={e.message} />;
    throw e;
  }
}
