import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { getEvaluasiSaya } from "@/lib/server/repositories/evaluasi";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EvaluasiSaya } from "@/components/menu/evaluasi-saya";

export const metadata: Metadata = { title: "Evaluasi Saya" };

/** Evaluasi Saya (Widyaiswara), sama dengan aplikasi lama. */
export default async function HalamanEvaluasiSaya() {
  const p = await wajibPengguna();
  const data = await getEvaluasiSaya(p.pegawaiId ?? null);
  return (
    <HalamanDasbor
      judul="Evaluasi Saya"
      keterangan={`Hasil evaluasi peserta terhadap Anda sebagai pengampu, coach, atau penguji (Formulir 17, 19, 20). Ditampilkan bila sedikitnya ${data.minResponden} peserta mengisi; saran tanpa nama.`}
    >
      <EvaluasiSaya data={data} />
    </HalamanDasbor>
  );
}
