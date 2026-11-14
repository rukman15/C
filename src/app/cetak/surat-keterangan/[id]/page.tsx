import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { requireRole } from "@/lib/server/auth";
import { getSuratKeterangan } from "@/lib/server/repositories/surat-keterangan";
import { nilaiSurat } from "@/lib/surat-keterangan";
import { barisNomor } from "@/lib/tata-naskah";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import { KopNaskah, TtdNaskah } from "@/components/cetak/naskah";

export const metadata: Metadata = { title: "Surat Keterangan" };

/** Cetak / PDF surat keterangan ditunda/tidak lulus (konsep tanpa tanda tangan, untuk TTE), sama dengan aplikasi lama. */
export default async function CetakSuratKeterangan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const s = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    const r = await getSuratKeterangan(id, s.email);
    const isi = r.isi;
    const sel = { verticalAlign: "top" as const, padding: "1px 3px" };
    const kotak = { border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" as const };
    const j = { textAlign: "justify" as const, margin: "6px 0" };
    return (
      <KertasCetak ukuran="naskah" judul={`Surat Keterangan — ${r.pesertaNama}`}>
        <KopNaskah />
        <div style={{ textAlign: "center", fontWeight: 700, textDecoration: "underline", marginTop: 6 }}>SURAT KETERANGAN</div>
        <div style={{ textAlign: "center", marginBottom: 14 }}>{barisNomor(r.nomor)}</div>
        <p style={j}>{isi.pembuka}</p>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {isi.identitas.map(([l, v]) => (
              <tr key={l}>
                <td style={{ ...sel, width: "1cm" }} />
                <td style={{ ...sel, width: "3cm" }}>{l}</td>
                <td style={{ ...sel, width: "0.5cm" }}>:</td>
                <td style={{ ...sel, fontWeight: l === "Nama" ? 700 : 400 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={j}>{isi.pernyataan}</p>
        {isi.aspek.length ? (
          <table style={{ borderCollapse: "collapse", width: "100%", margin: "6px 0 10px" }}>
            <thead>
              <tr>
                {["No", "Aspek evaluasi", "Nilai", "Kualifikasi"].map((h) => (
                  <th key={h} style={kotak}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isi.aspek.map((a, i) => (
                <tr key={a.kode}>
                  <td style={{ ...kotak, textAlign: "center" }}>{i + 1}.</td>
                  <td style={kotak}>{a.label}</td>
                  <td style={{ ...kotak, textAlign: "center" }}>{nilaiSurat(a.nilai)}</td>
                  <td style={{ ...kotak, textAlign: "center" }}>{a.kualifikasi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {isi.ketentuan.length ? (
          <>
            <p style={{ margin: "6px 0 2px" }}>Ketentuan:</p>
            {isi.ketentuan.length > 1 ? (
              <ol style={{ margin: "0 0 6px", paddingLeft: "1.1cm" }}>
                {isi.ketentuan.map((k, i) => (
                  <li key={i} style={j}>
                    {k}
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ ...j, marginLeft: "0.5cm" }}>{isi.ketentuan[0]}</p>
            )}
          </>
        ) : null}
        <p style={j}>{isi.penutup}</p>
        <TtdNaskah tempat={r.kota} tanggal={r.tanggal} ttd={r.penandatangan} />
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
