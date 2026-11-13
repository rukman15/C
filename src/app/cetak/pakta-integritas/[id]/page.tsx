import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { wajibBacaFormulir } from "@/lib/server/akses";
import { AppError } from "@/lib/server/errors";
import { getPakta, pesertaMilikAkun, trainingPeserta } from "@/lib/server/repositories/pakta";
import { tanggalPanjang } from "@/lib/dokumen";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Pakta Integritas" };

/**
 * Cetak Formulir 1 (Pakta Integritas), `id` = peserta. Identitas terisi; peserta menandatangani di atas materai lalu
 * mengunggahnya kembali sebagai berkas "Pakta integritas". Dibuka peserta sendiri atau penyelenggara/pimpinan jadwalnya.
 */
export default async function CetakPakta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  try {
    const sendiri = p.role === "peserta" && (await pesertaMilikAkun(id, p.email));
    if (!sendiri) await wajibBacaFormulir(await trainingPeserta(id));
    const r = await getPakta(id);
    const hariIni = isoTanggal(awalHariWib());
    return (
      <KertasCetak ukuran="naskah" judul={`Pakta Integritas — ${r.isi.tandaTangan.nama}`}>
        <p style={{ textAlign: "right", fontStyle: "italic", margin: 0 }}>Formulir 1</p>
        <p style={{ textAlign: "center", fontWeight: 700, margin: "10px 0 18px" }}>{r.isi.judul}</p>
        <p>Yang bertanda tangan di bawah ini:</p>
        <table style={{ borderCollapse: "collapse", margin: "6px 0 12px 1cm" }}>
          <tbody>
            {r.isi.identitas.map(([l, v]) => (
              <tr key={l}>
                <td style={{ padding: "2px 4px", verticalAlign: "top", width: "3.5cm" }}>{l}</td>
                <td style={{ padding: "2px 4px", verticalAlign: "top", width: "0.4cm" }}>:</td>
                <td style={{ padding: "2px 4px", verticalAlign: "top" }}>{v || "……………………………………"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.isi.paragraf.map((t, i) => (
          <p key={i} style={{ textAlign: "justify", margin: "8px 0" }}>
            {t}
          </p>
        ))}
        <div style={{ margin: "1.5em 0 0 9cm" }}>
          <p style={{ margin: 0 }}>
            {r.tempat}, {tanggalPanjang(hariIni)}
          </p>
          <p style={{ margin: 0 }}>Yang membuat pernyataan,</p>
          <div
            style={{
              margin: "0.6em 0",
              width: "3cm",
              height: "2cm",
              border: "1px dashed #777",
              color: "#777",
              fontSize: "9pt",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {r.isi.tandaTangan.materai}
          </div>
          <p style={{ margin: 0, fontWeight: 700 }}>{r.isi.tandaTangan.nama}</p>
          <p style={{ margin: 0 }}>NIP {r.isi.tandaTangan.nip || "……………………"}</p>
        </div>
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
