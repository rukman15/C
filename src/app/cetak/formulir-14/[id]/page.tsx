import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { penilaiSesi } from "@/lib/server/penilai";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import { namaProgram, type JenisEvaluasi } from "@/lib/kurikulum";
import { EVALUASI, LABEL_KELULUSAN, LABEL_KUALIFIKASI, formatNilai } from "@/lib/penilaian";
import { periodeSurat, tanggalPanjang } from "@/lib/dokumen";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { KOTA_SURAT } from "@/lib/aplikasi";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Formulir 14" };

/**
 * Cetak / PDF Formulir 14 — Rekapitulasi Nilai Akhir Peserta (sama dengan aplikasi lama dan tab Penilaian → Rekap &
 * Kelulusan): nilai × bobot per evaluasi, nilai akhir, kualifikasi, kelulusan, peringkat. Peserta aktif saja. Aplikasi
 * menghitung; penetapan oleh Tim Evaluasi Akhir (ruang tanda tangan). Penyelenggara dan pimpinan saja.
 */
export default async function CetakFormulir14({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pesan = (t: string) => <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{t}</p>;
  try {
    const r = await getLembarPenilaian(id, await penilaiSesi("baca"));
    if (r.peran === "WI") return pesan("Formulir 14 hanya untuk penyelenggara dan pimpinan.");
    const evaluasiAda = EVALUASI.filter((e) => r.aspek.some((a) => a.jenisEvaluasi === e.kode));
    const bobot = (j: JenisEvaluasi) => r.aspek.filter((a) => a.jenisEvaluasi === j).reduce((s, a) => s + a.bobot, 0);
    const aktif = r.peserta.filter((p) => p.status === "AKTIF");
    const program = namaProgram(r.training.jenisPelatihan, r.training.angkatan) || r.training.name;
    const nilai = (n: number | null | undefined) => (n == null ? "" : formatNilai(n));
    const sel = { border: "1px solid #000", padding: "2px 4px", verticalAlign: "top" as const };
    const th = { ...sel, textAlign: "center" as const, verticalAlign: "middle" as const };
    const c = { ...sel, textAlign: "center" as const };
    return (
      <KertasCetak ukuran="lanskap" judul={`Formulir 14 — ${r.training.name}`}>
        <p style={{ textAlign: "right", fontStyle: "italic", margin: 0 }}>Formulir 14</p>
        <p style={{ textAlign: "center", fontWeight: 700, margin: "4px 0 10px" }}>REKAPITULASI NILAI AKHIR PESERTA</p>
        <table style={{ marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: "3.5cm" }}>Nama Pelatihan</td>
              <td style={{ width: "0.4cm" }}>:</td>
              <td>{program}</td>
            </tr>
            <tr>
              <td>Waktu</td>
              <td>:</td>
              <td>{periodeSurat(r.training.startDate.slice(0, 10), r.training.endDate?.slice(0, 10))}</td>
            </tr>
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...th, width: "1.1cm" }}>
                No
              </th>
              <th rowSpan={2} style={th}>
                Nama / NIP
              </th>
              <th colSpan={evaluasiAda.length} style={th}>
                Nilai × Bobot
              </th>
              <th rowSpan={2} style={{ ...th, width: "1.8cm" }}>
                Nilai Akhir
              </th>
              <th rowSpan={2} style={th}>
                Kualifikasi
              </th>
              <th rowSpan={2} style={th}>
                Kelulusan
              </th>
              <th rowSpan={2} style={{ ...th, width: "1.1cm" }}>
                Peringkat
              </th>
            </tr>
            <tr>
              {evaluasiAda.map((e) => (
                <th key={e.kode} style={{ ...th, width: "2.1cm" }}>
                  {e.singkat}
                  <br />({bobot(e.kode)}%)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aktif.map((p) => (
              <tr key={p.id} style={{ breakInside: "avoid" }}>
                <td style={c}>{p.nomor}</td>
                <td style={sel}>
                  {p.nama}
                  {p.nip ? (
                    <>
                      <br />
                      <span style={{ fontSize: "9pt" }}>{p.nip}</span>
                    </>
                  ) : null}
                </td>
                {evaluasiAda.map((e) => (
                  <td key={e.kode} style={c}>
                    {nilai(p.hasil?.evaluasi.find((x) => x.kode === e.kode)?.kontribusi)}
                  </td>
                ))}
                <td style={{ ...c, fontWeight: 700 }}>{nilai(p.hasil?.nilaiAkhir)}</td>
                <td style={c}>{p.hasil?.kualifikasi ? LABEL_KUALIFIKASI[p.hasil.kualifikasi] : ""}</td>
                <td style={c}>{p.hasil ? LABEL_KELULUSAN[p.hasil.status] : ""}</td>
                <td style={c}>{p.peringkat ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ margin: "1.2em 0 0 auto", width: "8cm", breakInside: "avoid" }}>
          <p style={{ margin: 0 }}>
            {KOTA_SURAT}, {tanggalPanjang(isoTanggal(awalHariWib()))}
          </p>
          <p style={{ margin: 0 }}>Ketua Tim Evaluasi Akhir,</p>
          <div style={{ height: "2cm" }} />
          <p style={{ margin: 0 }}>(……………………………………)</p>
          <p style={{ margin: 0 }}>NIP ……………………</p>
        </div>
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return pesan(e.message);
    throw e;
  }
}
