import type { Metadata } from "next";
import { AppError } from "@/lib/server/errors";
import { pelakuTes } from "@/lib/server/pelaku-tes";
import { getKelolaTes } from "@/lib/server/repositories/tes";
import { periodeSurat } from "@/lib/dokumen";
import { LABEL_GAIN, lembarBacaTes, type JenisTes } from "@/lib/tes";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Hasil Tes" };

/**
 * Lembar baca hasil pre-test/post-test (`?jenis=pre|post`), sama dengan aplikasi lama: pre-test dibacakan Kepala Balai saat
 * pembukaan, post-test saat penutupan. Huruf besar untuk podium; nilai terendah tanpa nama. Hak = tab Pre/Post Test.
 */
export default async function CetakHasilTes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const [{ id }, { jenis: j }] = await Promise.all([params, searchParams]);
  const jenis: JenisTes = j === "post" ? "POST" : "PRE";
  const pesan = (t: string) => <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{t}</p>;
  try {
    const d = await getKelolaTes(id, await pelakuTes(["ketua-diklat", "kepala-balai", "kabag-tu"]));
    const l = lembarBacaTes(
      jenis,
      d.peserta.filter((p) => p.status === "AKTIF").map((p) => ({ nama: p.nama, pre: p.pre.skor, post: p.post.skor })),
    );
    const nama = jenis === "PRE" ? "Pre-test" : "Post-test";
    if (!l.jumlahIkut) return pesan(`Belum ada peserta yang menyelesaikan ${nama.toLowerCase()}.`);
    const angka = (n: number | null, dg = 2) => (n == null ? "-" : n.toLocaleString("id-ID", { minimumFractionDigits: dg, maximumFractionDigits: dg }));
    const kecil = { fontSize: "11pt", textAlign: "center" as const, margin: 0 };
    const sel = { border: "1px solid #000", padding: "4px 8px" };
    return (
      <KertasCetak ukuran="naskah" judul={`Hasil ${nama} — ${d.training.name}`}>
        <div style={{ fontSize: "14pt", lineHeight: 1.5 }}>
          <p style={kecil}>Bahan pembacaan {jenis === "PRE" ? "Pembukaan" : "Penutupan"} Pelatihan</p>
          <h1 style={{ textAlign: "center", fontSize: "18pt", margin: "6px 0 2px" }}>HASIL {nama.toUpperCase()}</h1>
          <p style={{ textAlign: "center", fontWeight: 700, margin: 0 }}>{d.training.name}</p>
          <p style={{ ...kecil, marginBottom: 14 }}>{periodeSurat(d.training.startDate, d.training.endDate)}</p>
          <p>
            {nama} diikuti oleh <strong>{l.jumlahIkut}</strong> dari {l.jumlahPeserta} peserta, dengan nilai rata-rata <strong>{angka(l.rata)}</strong>. Nilai tertinggi{" "}
            <strong>{angka(l.tertinggi)}</strong> dan nilai terendah <strong>{angka(l.terendah)}</strong>.
          </p>
          {l.banding ? (
            <p>
              Dibandingkan pre-test, rata-rata nilai {l.banding.jumlah} peserta yang mengikuti keduanya naik dari <strong>{angka(l.banding.rataPre)}</strong> menjadi{" "}
              <strong>{angka(l.banding.rataPost)}</strong> (kenaikan rata-rata <strong>{angka(l.banding.rataKenaikan)}</strong> poin).
              {l.banding.nGainKelas != null ? (
                <>
                  {" "}
                  Peningkatan pengetahuan kelas (N-gain) <strong>{angka(l.banding.nGainKelas)}</strong>
                  {l.banding.kategori ? (
                    <>
                      , kategori <strong>{LABEL_GAIN[l.banding.kategori].toLowerCase()}</strong>
                    </>
                  ) : null}
                  .
                </>
              ) : null}
            </p>
          ) : null}
          <table style={{ borderCollapse: "collapse", margin: "10px auto" }}>
            <thead>
              <tr>
                <th style={sel}>Rentang nilai</th>
                <th style={sel}>Jumlah peserta</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["80 ke atas", l.sebaran.atas80],
                  ["60 sampai di bawah 80", l.sebaran.antara],
                  ["di bawah 60", l.sebaran.bawah60],
                ] as const
              ).map(([r, n]) => (
                <tr key={r}>
                  <td style={sel}>{r}</td>
                  <td style={{ ...sel, textAlign: "center" }}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontWeight: 700, margin: "10px 0 2px" }}>Nilai {nama.toLowerCase()} tertinggi</p>
          <ol style={{ margin: 0 }}>
            {l.terbaik.map((t) => (
              <li key={t.nama}>
                {t.nama} — <strong>{angka(t.skor)}</strong>
              </li>
            ))}
          </ol>
          {l.banding && l.banding.kenaikanTerbaik.length ? (
            <>
              <p style={{ fontWeight: 700, margin: "10px 0 2px" }}>Kenaikan nilai tertinggi</p>
              <ol style={{ margin: 0 }}>
                {l.banding.kenaikanTerbaik.map((t) => (
                  <li key={t.nama}>
                    {t.nama} — naik <strong>{angka(t.kenaikan)}</strong> poin
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          <p style={{ fontSize: "11pt", fontStyle: "italic", marginTop: 14 }}>
            {jenis === "PRE"
              ? "Pre-test mengukur pengetahuan awal peserta sebagai titik pembanding; nilainya tidak memengaruhi kelulusan."
              : "Pre-test dan post-test mengukur kenaikan pengetahuan selama pelatihan (evaluasi program); nilainya tidak memengaruhi kelulusan."}
          </p>
        </div>
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return pesan(e.message);
    throw e;
  }
}
