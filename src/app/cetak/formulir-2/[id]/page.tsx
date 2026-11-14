import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { wajibBacaFormulir } from "@/lib/server/akses";
import { getPemantauan } from "@/lib/server/repositories/formulir-penyelenggaraan";
import { periodeSurat } from "@/lib/dokumen";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Formulir 2" };

/** Cetak / PDF Formulir 2 — Daftar Pemantauan Persiapan Pelaksanaan Pelatihan (sama dengan aplikasi lama). */
export default async function CetakFormulir2({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await wajibBacaFormulir(id);
    const r = await getPemantauan(id);
    const sel = { border: "1px solid #000", padding: "2px 4px", verticalAlign: "top" as const };
    return (
      <KertasCetak ukuran="naskah" judul={`Formulir 2 — ${r.diklat.nama}`}>
        <div style={{ fontSize: "11pt" }}>
          <p style={{ textAlign: "right", fontStyle: "italic", margin: 0 }}>Formulir 2</p>
          <p style={{ textAlign: "center", fontWeight: 700, margin: "6px 0 12px" }}>DAFTAR PEMANTAUAN PERSIAPAN PELAKSANAAN PELATIHAN</p>
          <table style={{ marginBottom: 10 }}>
            <tbody>
              <tr>
                <td style={{ width: "3.5cm" }}>Nama Pelatihan</td>
                <td style={{ width: "0.4cm" }}>:</td>
                <td>{r.diklat.program}</td>
              </tr>
              <tr>
                <td>Waktu</td>
                <td>:</td>
                <td>{periodeSurat(r.diklat.mulai, r.diklat.selesai)}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["No", "Kegiatan", "Jangka Waktu", "Penanggung Jawab", "Keterangan (Selesai/Belum)"].map((h) => (
                  <th key={h} style={{ ...sel, textAlign: "center" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.bagian.flatMap((s) => [
                <tr key={s.kode}>
                  <td colSpan={5} style={{ ...sel, fontWeight: 700 }}>
                    {s.kode}. {s.judul}
                  </td>
                </tr>,
                ...s.butir.map((b) => (
                  <tr key={b.kode} style={{ breakInside: "avoid" }}>
                    <td style={{ ...sel, textAlign: "center", width: "1.1cm" }}>{b.kode.split(".").at(-1)}.</td>
                    <td style={sel}>{b.teks}</td>
                    <td style={{ ...sel, width: "3cm" }}>{b.jangkaWaktu}</td>
                    <td style={{ ...sel, width: "3.4cm" }}>{b.penanggungJawab}</td>
                    <td style={{ ...sel, textAlign: "center", width: "2.4cm" }}>{b.selesai ? "Selesai" : "Belum"}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
