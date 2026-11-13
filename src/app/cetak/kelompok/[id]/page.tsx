import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { getKelompok } from "@/lib/server/repositories/kelompok";
import { JENIS_KELOMPOK_BAWAAN, isJenisKelompok } from "@/lib/kelompok";
import { namaProgram } from "@/lib/kurikulum";
import { KOP_SURAT } from "@/lib/aplikasi";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Daftar Kelompok" };

const JUDUL: Record<string, string> = {
  ELEARNING: "KELOMPOK e-LEARNING",
  SEMINAR: "KELOMPOK PEMBIMBINGAN DAN SEMINAR AKSI PERUBAHAN",
  STULA: "KELOMPOK STUDI LAPANGAN",
  MANDIRI: "KELOMPOK BELAJAR MANDIRI",
};

/** "Kepala Bidang X pada Dinas Y" seperti kolom Jabatan/Dinas/Instansi di lembar kelompok. */
function jabatanInstansi(jabatan: string | null, instansi: string | null) {
  if (!jabatan) return instansi ?? "";
  if (!instansi || jabatan.toLowerCase().includes(instansi.toLowerCase())) return jabatan;
  return `${jabatan} pada ${instansi}`;
}

/**
 * Cetak daftar kelompok satu jenis (mengikuti lembar "K e-Learning / K Stula / K Bimbing" berkas kelompok balai):
 * kop, judul, ketua dan coach/lokus/kelas, tabel peserta; satu kelompok per halaman.
 * Dibuka Ketua Diklat, admin, Kepala Balai, dan Kabag TU (sama dengan tab Kelompok).
 */
export default async function CetakKelompok({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const [{ id }, { jenis }] = await Promise.all([params, searchParams]);
  const p = await wajibPengguna();
  if (!["admin", "ketua-diklat", "kepala-balai", "kabag-tu"].includes(p.role)) {
    return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>Daftar kelompok dibuka Ketua Diklat, Kepala Balai, dan Kabag TU.</p>;
  }
  try {
    const d = await getKelompok(id, false, isJenisKelompok(jenis) ? jenis : JENIS_KELOMPOK_BAWAAN);
    const program = (namaProgram(d.training.jenisPelatihan, d.training.angkatan) || d.training.name).toUpperCase();
    const tahun = d.training.startDate.slice(0, 4);
    const sel = { border: "1px solid #000", padding: "4px 6px", verticalAlign: "top" as const };
    return (
      <KertasCetak ukuran="naskah" judul={`${JUDUL[d.jenis]} — ${d.training.name}`}>
        {d.kelompok.map((k, i) => {
          const info: [string, string | null][] = [
            [`KETUA KELOMPOK ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][k.nomor - 1] ?? k.nomor}`, k.ketuaNama ?? "…………………"],
            ...(d.pakaiCoach ? ([["PEMBIMBING/COACH", k.coachNama ?? "…………………"]] as [string, string][]) : []),
            ...(d.pakaiCoach && k.kelas ? ([["KELAS", k.kelas]] as [string, string][]) : []),
            ...(d.jenis === "STULA" ? ([["LOKUS", k.lokus ?? "…………………"]] as [string, string][]) : []),
          ];
          return (
            <section key={k.id} className="kertas-halaman" style={{ breakAfter: i < d.kelompok.length - 1 ? "page" : "auto", fontSize: "11pt" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "3px double #000", paddingBottom: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={KOP_SURAT.logo} alt="" style={{ width: 70, height: "auto" }} />
                <div style={{ flex: 1, textAlign: "center", lineHeight: 1.2 }}>
                  {KOP_SURAT.baris.map((b) => (
                    <div key={b} style={{ fontWeight: 700, fontSize: "11pt" }}>
                      {b}
                    </div>
                  ))}
                  {KOP_SURAT.alamat.map((b) => (
                    <div key={b} style={{ fontSize: "8pt" }}>
                      {b}
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ textAlign: "center", fontWeight: 700, margin: "14px 0 0" }}>{JUDUL[d.jenis]}</p>
              <p style={{ textAlign: "center", fontWeight: 700, margin: "2px 0 14px" }}>
                {program} TA. {tahun}
              </p>
              <table style={{ marginBottom: 10 }}>
                <tbody>
                  {info.map(([l, v]) => (
                    <tr key={l}>
                      <td style={{ fontWeight: 700, paddingRight: 8 }}>{l}</td>
                      <td style={{ paddingRight: 6 }}>:</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["NO.", "NAMA PESERTA", "JABATAN/DINAS/INSTANSI"].map((h) => (
                      <th key={h} style={{ ...sel, textAlign: "center", background: "#e5e7eb" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {k.anggota
                    .filter((a) => a.status === "AKTIF")
                    .map((a, j) => (
                      <tr key={a.id}>
                        <td style={{ ...sel, textAlign: "center", width: "1cm" }}>{j + 1}</td>
                        <td style={{ ...sel, width: "6cm" }}>{a.nama}</td>
                        <td style={sel}>{jabatanInstansi(a.jabatan, a.instansi)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          );
        })}
        {d.kelompok.length === 0 ? <p>Belum ada kelompok.</p> : null}
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
