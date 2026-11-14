import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { wajibBacaSuratId } from "@/lib/server/akses-dokumen";
import { getSuratTugas } from "@/lib/server/repositories/dokumen";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { SuratTugasCetak } from "@/components/cetak/surat";

export const metadata: Metadata = { title: "Surat Tugas" };

/** Cetak / PDF surat tugas mengajar (konsep tanpa tanda tangan, untuk TTE). */
export default async function CetakSuratTugas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await wajibBacaSuratId(id);
    const s = await getSuratTugas(id);
    return (
      <KertasCetak ukuran="surat-tugas" judul={`Surat Tugas — ${s.trainingName}`}>
        <SuratTugasCetak s={s} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
