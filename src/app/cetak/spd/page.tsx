import type { Metadata } from "next";
import { AppError, ValidationError } from "@/lib/server/errors";
import { PEMBACA_SPD, pengguna } from "@/lib/server/akses-persuratan";
import { setSpd } from "@/lib/server/repositories/spd";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { SpdCetak } from "@/components/cetak/surat-lain";

export const metadata: Metadata = { title: "SPD" };

/** Cetak / PDF SPD satu surat tugas (?sumber=naskah|surat-tugas&sumberId=…). Ditandatangani PPK di luar aplikasi. */
export default async function CetakSpd({ searchParams }: { searchParams: Promise<{ sumber?: string; sumberId?: string }> }) {
  const { sumber, sumberId } = await searchParams;
  try {
    await pengguna(PEMBACA_SPD);
    if ((sumber !== "naskah" && sumber !== "surat-tugas") || !sumberId) throw new ValidationError("Pilih surat tugas");
    const set = await setSpd(sumber, sumberId);
    return (
      <KertasCetak ukuran="naskah" judul={`SPD — ${set.surat.nomor ?? set.surat.tanggal}`}>
        <SpdCetak set={set} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
