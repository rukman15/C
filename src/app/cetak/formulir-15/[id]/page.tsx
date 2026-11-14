import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { wajibBacaFormulir } from "@/lib/server/akses";
import { getRemedialJadwal } from "@/lib/server/repositories/formulir-penyelenggaraan";
import { periodeSurat, tanggalPanjang } from "@/lib/dokumen";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Formulir 15" };

/**
 * Cetak / PDF Formulir 15 — Laporan Hasil Evaluasi Remedial (sama dengan aplikasi lama). `?peserta=…` mencetak satu
 * peserta; tanpa itu semua peserta yang ditunda, satu peserta per halaman.
 */
export default async function CetakFormulir15({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ peserta?: string }> }) {
  const [{ id }, { peserta }] = await Promise.all([params, searchParams]);
  const pesan = (t: string) => <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{t}</p>;
  try {
    const a = await wajibBacaFormulir(id);
    const r = await getRemedialJadwal(id, a.email);
    const daftar = r.peserta.filter((p) => !peserta || p.pesertaId === peserta);
    if (!daftar.length) return pesan("Tidak ada peserta yang perlu remedial.");
    const angka = (n: number | null) => (n == null ? "" : n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const kotak = { border: "1px solid #000", padding: "2px 4px", verticalAlign: "top" as const };
    const c = { ...kotak, textAlign: "center" as const };
    return (
      <KertasCetak ukuran="naskah" judul={`Formulir 15 — ${r.diklat.nama}`}>
        {daftar.map((p, i) => (
          <section key={p.pesertaId} className="kertas-halaman" style={{ fontSize: "11pt", breakBefore: i > 0 ? "page" : "auto" }}>
            <p style={{ textAlign: "right", fontStyle: "italic", margin: 0 }}>Formulir 15</p>
            <p style={{ textAlign: "center", fontWeight: 700, margin: "4px 0 10px" }}>LAPORAN HASIL EVALUASI REMEDIAL</p>
            <table style={{ marginBottom: 8 }}>
              <tbody>
                {(
                  [
                    ["Nama Pelatihan", r.diklat.program],
                    ["Waktu Pelatihan", periodeSurat(r.diklat.mulai, r.diklat.selesai)],
                    ["Nama Peserta", p.nama],
                    ["NIP", p.nip ?? "-"],
                    ["Instansi", p.instansi ?? "-"],
                  ] as const
                ).map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ width: "3.6cm", verticalAlign: "top" }}>{l}</td>
                    <td style={{ width: "0.4cm", verticalAlign: "top" }}>:</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["No", "Jenis Evaluasi", "Bentuk Tindak Lanjut", "Waktu dan Tanggal", "Teknis Pelaksanaan", "Nilai", "Catatan"].map((h) => (
                    <th key={h} style={c}>
                      {h}
                    </th>
                  ))}
                </tr>
                <tr>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <th key={n} style={{ ...c, fontWeight: 400, fontSize: "9pt" }}>
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.baris.map((b) => (
                  <tr key={b.jenis}>
                    <td style={c}>{b.no}.</td>
                    <td style={kotak}>{b.jenisEvaluasi}</td>
                    <td style={c}>{b.bentukTindakLanjut}</td>
                    <td style={kotak}>{[b.waktu, b.tanggal ? tanggalPanjang(b.tanggal) : ""].filter(Boolean).join(", ")}</td>
                    <td style={kotak}>{b.teknisPelaksanaan ?? ""}</td>
                    <td style={c}>{angka(b.nilai)}</td>
                    <td style={kotak}>{b.catatan ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: "9pt", fontStyle: "italic", marginTop: 6 }}>
              Nilai remedial paling tinggi 85,00. Sikap perilaku tidak diremedial — ditindaklanjuti dengan konseling dan diputus Tim Evaluasi Akhir.
            </p>
          </section>
        ))}
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return pesan(e.message);
    throw e;
  }
}
