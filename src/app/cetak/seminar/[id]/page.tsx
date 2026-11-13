import type { Metadata } from "next";
import { prisma } from "@/lib/server/prisma";
import { AppError } from "@/lib/server/errors";
import { aksesSeminar, getSeminar } from "@/lib/server/repositories/seminar";
import { isJenisSeminar, jamSelesai } from "@/lib/seminar";
import { formatTanggalId } from "@/lib/sesi";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { namaProgram } from "@/lib/kurikulum";
import { KOP_SURAT } from "@/lib/aplikasi";
import { KertasCetak } from "@/components/cetak/kertas-cetak";

export const metadata: Metadata = { title: "Jadwal Seminar" };

const JUDUL = { RAP: "SEMINAR PERANCANGAN AKSI PERUBAHAN", LAP: "SEMINAR IMPLEMENTASI AKSI PERUBAHAN" } as const;
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const hariTanggal = (iso: string) => `${HARI[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${formatTanggalId(iso)}`;
const jam = (j: string) => j.replace(":", ".");
/** "198703212009121001" → "19870321 200912 1 001" seperti di lembar balai. */
const nipRapi = (n: string | null | undefined) => (n && /^\d{18}$/.test(n) ? `${n.slice(0, 8)} ${n.slice(8, 14)} ${n.slice(14, 15)} ${n.slice(15)}` : (n ?? ""));

/**
 * Cetak jadwal seminar RAP/LAP per kelompok (mengikuti lembar "K RAP/K LAP" balai, EB-055): kop, kelompok & kelas,
 * waktu pelaksanaan, tabel No–Waktu–Peserta–Mentor–Jabatan mentor–Judul–Kehadiran mentor dengan baris istirahat,
 * lalu penguji (+NIP), coach, evaluator kelas. Satu kelompok per halaman. Hak sama dengan tab Seminar.
 */
export default async function CetakSeminar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const [{ id }, { jenis: j }] = await Promise.all([params, searchParams]);
  const jenis = isJenisSeminar(j) ? j : "RAP";
  try {
    const a = await aksesSeminar(id);
    const d = await getSeminar(id, jenis, a, isoTanggal(awalHariWib()));
    const t = await prisma.training.findUnique({ where: { id }, select: { jenisPelatihan: true, angkatan: true, startDate: true } });
    const ids = [...new Set([...d.kelompok.map((k) => k.pengujiPegawaiId), ...d.baris.map((b) => b.pengujiPegawaiId)].filter((x): x is string => !!x))];
    const nip = new Map((ids.length ? await prisma.pegawai.findMany({ where: { id: { in: ids } }, select: { id: true, nip: true } }) : []).map((p) => [p.id, p.nip]));
    const program = (namaProgram(t?.jenisPelatihan ?? null, t?.angkatan ?? null) || d.training.name).toUpperCase();
    const tahun = t?.startDate ? isoTanggal(t.startDate).slice(0, 4) : "";
    const sel = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top" as const };
    const kel = d.kelompok.filter((k) => d.baris.some((b) => b.kelompokId === k.kelompokId));
    if (!kel.length) return <p style={{ padding: 24, fontFamily: "Arial" }}>Belum ada kelompok bimbingan & seminar.</p>;
    return (
      <KertasCetak ukuran="lanskap" judul={`${JUDUL[jenis]} — ${d.training.name}`}>
        {kel.map((k, i) => {
          const baris = d.baris.filter((b) => b.kelompokId === k.kelompokId);
          const tanggal = k.tanggal ?? baris.find((b) => b.tanggal)?.tanggal ?? null;
          const ist = k.istirahatMulai && k.istirahatSelesai ? k.istirahatMulai : null;
          const sisip = ist ? baris.findIndex((b) => !!b.jamMulai && b.jamMulai >= (k.istirahatSelesai ?? "")) : -1;
          // 1 peserta 1 penguji (EB-018): biasanya satu penguji per kelas; bila ada peserta diuji orang lain, semua dicantumkan.
          const daftar = new Map<string, { nama: string; pegawaiId: string | null }>();
          for (const b of baris) if (b.pengujiNama) daftar.set(b.pengujiPegawaiId ?? b.pengujiNama, { nama: b.pengujiNama, pegawaiId: b.pengujiPegawaiId });
          if (!daftar.size && k.pengujiNama) daftar.set(k.pengujiPegawaiId ?? k.pengujiNama, { nama: k.pengujiNama, pegawaiId: k.pengujiPegawaiId });
          const penguji: [string, string | null, string | null][] = daftar.size
            ? [...daftar.values()].map((p, n) => [daftar.size > 1 ? `PENGUJI ${ROMAWI[n]}` : "PENGUJI", p.nama, nipRapi(p.pegawaiId ? nip.get(p.pegawaiId) : null)])
            : [["PENGUJI", null, null]];
          // Lebih dari satu penguji di kelas ini: tabel diberi kolom penguji per peserta.
          const banyak = daftar.size > 1;
          return (
            <section key={k.kelompokId} className="kertas-halaman" style={{ breakAfter: i < kel.length - 1 ? "page" : "auto", fontSize: "10pt" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "3px double #000", paddingBottom: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={KOP_SURAT.logo} alt="" style={{ width: 60, height: "auto" }} />
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
              <p style={{ textAlign: "center", fontWeight: 700, margin: "10px 0 0" }}>KELOMPOK {ROMAWI[k.nomor - 1] ?? k.nomor}</p>
              <p style={{ textAlign: "center", fontWeight: 700, margin: 0 }}>
                {program} TA. {tahun}
              </p>
              <p style={{ textAlign: "center", fontWeight: 700, margin: "0 0 8px" }}>{JUDUL[jenis]}</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Waktu Pelaksanaan : {tanggal ? hariTanggal(tanggal) : "…………………"}</span>
                <span style={{ fontWeight: 700 }}>KELAS : {k.ruang ?? k.kelas ?? "…"}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "center", fontWeight: 700 }}>
                    {[
                      "NO.",
                      "WAKTU PELAKSANAAN",
                      "NAMA PESERTA",
                      ...(banyak ? ["PENGUJI"] : []),
                      "NAMA MENTOR",
                      "JABATAN/INSTANSI MENTOR",
                      "JUDUL AKSI PERUBAHAN",
                      "KEHADIRAN MENTOR",
                    ].map((h) => (
                      <th key={h} style={sel}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b, n) => (
                    <FragmenBaris key={b.pesertaId} istirahat={n === sisip && ist ? `${jam(ist)} - ${jam(k.istirahatSelesai!)}` : null} kolom={banyak ? 6 : 5} sel={sel}>
                      <td style={{ ...sel, textAlign: "center" }}>{n + 1}</td>
                      <td style={{ ...sel, whiteSpace: "nowrap" }}>{b.jamMulai ? `${jam(b.jamMulai)} - ${jam(jamSelesai(b.jamMulai, k.durasiMenit)!)}` : ""}</td>
                      <td style={sel}>{b.nama}</td>
                      {banyak ? <td style={sel}>{b.pengujiNama ?? ""}</td> : null}
                      <td style={sel}>{b.mentorNama ?? ""}</td>
                      <td style={sel}>{b.mentorJabatan ?? ""}</td>
                      <td style={sel}>{b.judulAksiPerubahan ?? ""}</td>
                      <td style={sel}>{b.mentorHadir === "DARING" ? "Online/Daring" : b.mentorHadir === "LANGSUNG" ? "Hadir/Datang Langsung" : ""}</td>
                    </FragmenBaris>
                  ))}
                </tbody>
              </table>
              <p style={{ fontStyle: "italic", fontSize: "9pt", margin: "4px 0 10px" }}>Catatan : Jadwal tentatif/sewaktu-waktu dapat berubah.</p>
              <table>
                <tbody>
                  {penguji.flatMap(([l, n, nipP]) => [<Info key={l} label={l} isi={n ?? "…………………"} />, <Info key={`${l}-nip`} label="NIP" isi={nipP || "…………………"} />])}
                  <Info label="KETUA KELOMPOK" isi={k.ketuaNama ?? "…………………"} />
                  <Info label="COACH" isi={k.coachNama ?? "…………………"} />
                  <Info label="EVALUATOR KELAS" isi={k.evaluatorNama ?? "…………………"} />
                </tbody>
              </table>
            </section>
          );
        })}
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}

function Info({ label, isi }: { label: string; isi: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 700, paddingRight: 8 }}>{label}</td>
      <td style={{ paddingRight: 6 }}>:</td>
      <td>{isi}</td>
    </tr>
  );
}

function FragmenBaris({ istirahat, kolom, sel, children }: { istirahat: string | null; kolom: number; sel: React.CSSProperties; children: React.ReactNode }) {
  return (
    <>
      {istirahat ? (
        <tr>
          <td style={sel} />
          <td style={{ ...sel, whiteSpace: "nowrap" }}>{istirahat}</td>
          <td colSpan={kolom} style={{ ...sel, textAlign: "center", fontWeight: 700, letterSpacing: "0.4em" }}>
            ISTIRAHAT
          </td>
        </tr>
      ) : null}
      <tr>{children}</tr>
    </>
  );
}
