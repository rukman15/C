"use client";

import { useEffect, useState } from "react";
import { NASKAH, KERTAS_SURAT_TUGAS } from "@/lib/tata-naskah";

/**
 * Bingkai halaman cetak dokumen resmi (sama dengan KertasCetak aplikasi lama): naskah dinas = A4 bertepi Permendagri,
 * surat tugas = F4. Kertas hitam di atas putih apa pun temanya (pengecualian token warna). Tombol tidak ikut tercetak.
 * Dialog cetak dibuka otomatis sekali saat halaman siap.
 */
export type UkuranKertas = "A4" | "naskah" | "surat-tugas" | "A5" | "lanskap";

const T = NASKAH.tepi;
const F4 = KERTAS_SURAT_TUGAS;
const ATURAN: Record<UkuranKertas, string> = {
  naskah: `@page { size: A4; margin: ${T.atas}cm ${T.kanan}cm ${T.bawah}cm ${T.kiri}cm; }`,
  "surat-tugas": `@page { size: ${F4.lebar}cm ${F4.tinggi}cm; margin: ${T.atas}cm ${T.kanan}cm ${T.bawah}cm ${T.kiri}cm; }`,
  A5: "@page { size: A5; margin: 1cm; }",
  lanskap: "@page { size: A4 landscape; margin: 1.5cm; }",
  A4: "@page { size: A4; margin: 0; }",
};
const KERTAS: Record<UkuranKertas, React.CSSProperties> = {
  A4: { width: "21cm", minHeight: "29.7cm", padding: "1.5cm", fontSize: "10pt" },
  A5: { width: "14.8cm", minHeight: "21cm", padding: "1cm" },
  lanskap: { width: "29.7cm", minHeight: "21cm", padding: "1.5cm", fontSize: "10pt" },
  naskah: { width: "21cm", minHeight: "29.7cm", padding: "1.5cm 2cm 2.5cm 3cm", fontSize: "12pt", lineHeight: 1.15 },
  "surat-tugas": { width: "21.5cm", minHeight: "33cm", padding: "1.5cm 2cm 2.5cm 3cm", fontSize: "12pt", lineHeight: 1.15 },
};

export function KertasCetak({ ukuran = "A4", judul, children }: { ukuran?: UkuranKertas; judul: string; children: React.ReactNode }) {
  // Di layar sempit (HP) kertas diperkecil utuh, bukan dipersempit, supaya tata letaknya sama dengan hasil cetak.
  const [skala, setSkala] = useState(1);
  useEffect(() => {
    const lebar = parseFloat(String(KERTAS[ukuran].width)) * 37.795; // cm -> px CSS
    const hitung = () => setSkala(Math.min(1, (Math.min(window.innerWidth, window.screen.width) - 32) / lebar));
    hitung();
    window.addEventListener("resize", hitung);
    return () => window.removeEventListener("resize", hitung);
  }, [ukuran]);
  useEffect(() => {
    document.title = judul;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [judul]);
  return (
    <div className="kertas-layar">
      <style>{`${ATURAN[ukuran]}
        .kertas-layar { min-height: 100vh; background: #e5e7eb; padding: 16px 16px 48px; font-family: Arial, Helvetica, sans-serif; color: #000; }
        .kertas-alat { max-width: 29.7cm; margin: 0 auto 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; }
        .kertas-alat span { flex: 1; font-weight: 600; }
        .kertas-alat button { border: 1px solid #94a3b8; background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; color: #000; }
        .kertas-alat button:first-of-type { background: #0b4fb3; color: #fff; border-color: #0b4fb3; }
        .kertas { background: #fff; margin: 0 auto; font-size: 11pt; line-height: 1.3; overflow-x: auto; color: #000; }
        .kertas-halaman + .kertas-halaman { border-top: 1px dashed #9ca3af; margin-top: 1.5cm; padding-top: 1.2cm; }
        @media print {
          .kertas-halaman + .kertas-halaman { border-top: 0; margin-top: 0; padding-top: 0; }
          .kertas-layar { background: #fff; padding: 0; }
          .kertas-alat { display: none; }
          .kertas { margin: 0; overflow: visible; zoom: 1 !important; }
          .kertas:not(.A4) { width: auto !important; min-height: 0 !important; padding: 0 !important; }
        }`}</style>
      <div className="kertas-alat">
        <span>{judul}</span>
        <button type="button" onClick={() => window.print()}>
          Cetak / Simpan PDF
        </button>
        <button type="button" onClick={() => window.close()}>
          Tutup
        </button>
      </div>
      <div className={`kertas ${ukuran}`} style={{ ...KERTAS[ukuran], zoom: skala }}>
        {children}
      </div>
    </div>
  );
}
