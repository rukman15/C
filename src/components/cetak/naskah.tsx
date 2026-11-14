import { KOP_SURAT } from "@/lib/aplikasi";
import { blokPenandatangan, tempatTanggal, type Penandatangan } from "@/lib/tata-naskah";

/** Kop naskah dinas UPT (Permendagri 18/2024 Lampiran I): Kementerian, RI, Eselon I, UPT, alamat; 2 spasi di bawahnya. */
export function KopNaskah() {
  return (
    <>
      <table style={{ borderCollapse: "collapse", width: "100%", borderBottom: "3px double #000" }}>
        <tbody>
          <tr>
            <td style={{ width: "2.4cm", verticalAlign: "middle", padding: "1px 3px 4px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={KOP_SURAT.logo} alt="Logo Kementerian Dalam Negeri" style={{ width: "2cm" }} />
            </td>
            <td style={{ textAlign: "center", verticalAlign: "middle", padding: "1px 3px 4px" }}>
              {KOP_SURAT.baris.map((b, i) => (
                <div key={b} style={{ fontWeight: 700, fontSize: i < 2 ? "14pt" : "13pt" }}>
                  {b}
                </div>
              ))}
              {KOP_SURAT.alamat.map((a) => (
                <div key={a} style={{ fontSize: "8pt" }}>
                  {a}
                </div>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ height: "2.3em" }} />
    </>
  );
}

/** Tempat-tanggal + blok tanda tangan (Permendagri 18/2024 Ps. 35 ayat 2) dengan ruang kode QR TTE (±2 cm). */
export function TtdNaskah({ tempat, tanggal, ttd }: { tempat: string; tanggal: string; ttd: Penandatangan }) {
  const blok = blokPenandatangan(ttd);
  return (
    <div style={{ margin: "0.9em 0 0 8.5cm", breakInside: "avoid" }}>
      <div>{tempatTanggal(tempat, tanggal)}</div>
      {blok.atas.map((b, i) => (
        <div key={`a${i}`}>{b}</div>
      ))}
      <div style={{ height: "2.2cm" }} />
      {blok.bawah.map((b, i) => (
        <div key={`b${i}`}>{b}</div>
      ))}
    </div>
  );
}
