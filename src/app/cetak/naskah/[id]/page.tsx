import type { Metadata } from "next";
import { AppError, ForbiddenError } from "@/lib/server/errors";
import { PENOMOR, PENYUSUN_NASKAH, pengguna, termasuk } from "@/lib/server/akses-persuratan";
import { getNaskah } from "@/lib/server/repositories/persuratan";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { NaskahCetak } from "@/components/cetak/surat";

export const metadata: Metadata = { title: "Naskah Dinas" };

/** Cetak / PDF naskah dinas (konsep tanpa tanda tangan, untuk TTE). Hak sama dengan GET /api/persuratan/naskah/[id]. */
export default async function CetakNaskah({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = await pengguna();
    const n = await getNaskah(id);
    // Penerima surat tugas boleh membaca/mencetak surat tugasnya sendiri setelah bernomor (Surat Tugas Saya).
    const penerima = n.jenis === "SURAT_TUGAS" && !!n.nomor && !!p.pegawaiId && n.pegawaiIds.includes(p.pegawaiId);
    if (!penerima && !termasuk(p, [...PENYUSUN_NASKAH, ...PENOMOR])) throw new ForbiddenError();
    return (
      <KertasCetak ukuran={n.jenis === "SURAT_TUGAS" ? "surat-tugas" : "naskah"} judul={`${n.label} — ${n.hal || n.tanggal}`}>
        <NaskahCetak n={n} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
