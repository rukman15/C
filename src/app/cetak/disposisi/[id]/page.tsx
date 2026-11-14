import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { pengguna } from "@/lib/server/akses-persuratan";
import { getSuratMasuk } from "@/lib/server/repositories/surat-masuk";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { DisposisiCetak } from "@/components/cetak/surat-lain";

export const metadata: Metadata = { title: "Lembar Disposisi" };

/** Cetak lembar disposisi surat masuk (kertas A5). */
export default async function CetakDisposisi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const s = await getSuratMasuk(id, await pengguna());
    return (
      <KertasCetak ukuran="A5" judul={`Lembar Disposisi — ${s.hal}`}>
        <DisposisiCetak s={s} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
