import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import { getDetailKiriman } from "@/lib/server/repositories/tugas";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DetailTinjauTugas } from "@/components/tugas/tinjau-tugas";

export const metadata: Metadata = { title: "Tinjau Tugas" };

/** Satu kiriman tugas: berkas, tinjauan, dan riwayat (EB-038). Hak dijaga repository (peserta pemilik, peninjau, pengelola). */
export default async function HalamanKiriman({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await wajibPengguna();
  const kembali = (
    <Link href="/dashboard/tinjau-tugas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft size={16} /> Tinjau Tugas
    </Link>
  );
  try {
    const data = await getDetailKiriman(await penggunaTugas(), id);
    return (
      <div className="mx-auto w-full max-w-3xl">
        {kembali}
        <HalamanDasbor judul={data.tugas.judul} keterangan={`${data.peserta.nama} · ${data.training.name}`}>
          <DetailTinjauTugas awal={data} />
        </HalamanDasbor>
      </div>
    );
  } catch (e) {
    if (e instanceof AppError)
      return (
        <div className="mx-auto w-full max-w-3xl">
          {kembali}
          <EmptyState title="Kiriman tidak tersedia" description={e.message} />
        </div>
      );
    throw e;
  }
}
