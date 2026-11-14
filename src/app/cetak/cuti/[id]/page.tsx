import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { pengguna } from "@/lib/server/akses-persuratan";
import { suratCuti } from "@/lib/server/repositories/cuti";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { CutiCetak } from "@/components/cetak/surat-lain";

export const metadata: Metadata = { title: "Surat Cuti" };

/** Cetak / PDF nota dinas + surat izin cuti. */
export default async function CetakCuti({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const s = await suratCuti(id, await pengguna());
    return (
      <KertasCetak ukuran="naskah" judul={`${s.cuti.label} — ${s.cuti.pegawaiNama}`}>
        <CutiCetak s={s} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
