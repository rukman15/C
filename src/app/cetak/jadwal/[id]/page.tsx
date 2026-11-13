import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { listSesiPembelajaran } from "@/lib/server/repositories/pembelajaran";
import { getTrainingByIdOrThrow } from "@/lib/server/repositories/training";
import { labelMode, namaProgram } from "@/lib/kurikulum";
import { KOTA_SURAT, LEMBAGA_SINGKAT, NAMA_LEMBAGA } from "@/lib/aplikasi";
import { tambahHariIso, akhirPekanIso } from "@/lib/tanggal";
import { KertasCetak } from "@/components/cetak/kertas-cetak";
import type { SesiPembelajaran } from "@/lib/data-pembelajaran";

export const metadata: Metadata = { title: "Jadwal Pembelajaran" };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const KET: Record<string, string> = { SINKRON: "Sync", ASINKRON: "Async", MANDIRI: "Mandiri", KLASIKAL: "", LAPANGAN: "Studi lapangan" };
const tgl = (iso: string) => `${iso.slice(8)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const tglPanjang = (iso: string) => `${Number(iso.slice(8))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const hari = (iso: string) => HARI[new Date(`${iso}T00:00:00Z`).getUTCDay()];

function pengajar(s: SesiPembelajaran): string[] {
  if (s.perKelompok.some((k) => k.pengajarNama)) return s.perKelompok.filter((k) => k.pengajarNama).map((k, i) => `${i === 0 ? "Kel. " : ""}${k.nomor}. ${k.pengajarNama}`);
  return s.pengampu ?? [];
}

type Blok =
  | { jenis: "hari"; tanggal: string; sesi: SesiPembelajaran[] }
  | { jenis: "mandiri"; mulai: string; selesai: string; sesi: SesiPembelajaran[] }
  | { jenis: "libur"; tanggal: string };

/** Susun hari demi hari dalam periode; hari yang isinya hanya belajar mandiri dan berurutan digabung jadi satu blok. */
function susun(sesi: SesiPembelajaran[], mulai: string, selesai: string): Blok[] {
  const perHari = new Map<string, SesiPembelajaran[]>();
  for (const s of sesi) perHari.set(s.tanggal, [...(perHari.get(s.tanggal) ?? []), s]);
  const awal = [mulai, ...sesi.map((s) => s.tanggal)].sort()[0];
  const akhir = [selesai, ...sesi.map((s) => s.tanggal)].sort().at(-1)!;
  const out: Blok[] = [];
  for (let t = awal; t <= akhir; t = tambahHariIso(t, 1)) {
    const isi = perHari.get(t) ?? [];
    if (!isi.length) {
      if (akhirPekanIso(t) && new Date(`${t}T00:00:00Z`).getUTCDay() === 0) out.push({ jenis: "libur", tanggal: t });
      continue;
    }
    const prev = out.at(-1);
    if (isi.every((s) => s.bentuk === "MANDIRI")) {
      if (prev?.jenis === "mandiri" && tambahHariIso(prev.selesai, 1) === t) {
        prev.selesai = t;
        for (const s of isi) if (!prev.sesi.some((x) => x.kegiatan === s.kegiatan && x.jp === s.jp)) prev.sesi.push(s);
      } else out.push({ jenis: "mandiri", mulai: t, selesai: t, sesi: [...isi] });
    } else out.push({ jenis: "hari", tanggal: t, sesi: isi });
  }
  return out;
}

/**
 * Cetak jadwal pembelajaran (mengikuti "Jadwal Pembelajaran PKA … Pola Blended Learning" balai): pengajar per kelompok
 * e-learning (EB-052), keterangan Sync/Async/Mandiri, Minggu ditandai, tanda tangan Ketua Tim.
 * Dibuka Ketua Diklat, Kepala Balai, dan admin (sama dengan jadwal pembelajaran).
 */
export default async function CetakJadwal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await wajibPengguna();
  if (!["admin", "ketua-diklat", "kepala-balai"].includes(p.role)) {
    return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>Jadwal pembelajaran dibuka Ketua Diklat dan Kepala Balai.</p>;
  }
  try {
    const [d, t] = await Promise.all([listSesiPembelajaran(id), getTrainingByIdOrThrow(id)]);
    const program = (namaProgram(t.jenisPelatihan, t.angkatan) || t.name).toUpperCase();
    const tahun = d.training.startDate.slice(0, 4);
    const blok = susun(d.sesi, d.training.startDate, d.training.endDate ?? d.training.startDate);
    const sel = { border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" as const };
    const libur = { ...sel, background: "#f2c4c4" };
    let nomor = 0;
    return (
      <KertasCetak ukuran="lanskap" judul={`Jadwal — ${d.training.name}`}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "12pt", lineHeight: 1.35, marginBottom: 12 }}>
          <div>JADWAL PEMBELAJARAN {program}</div>
          <div>
            {t.modePelatihan ? `POLA ${labelMode(t.modePelatihan).toUpperCase()} ` : ""}TAHUN {tahun}
          </div>
          <div style={{ textDecoration: "underline" }}>{NAMA_LEMBAGA.toUpperCase()}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr style={{ background: "#92d050" }}>
              {["No", "Hari / Tanggal / Waktu", "Mata Diklat", "JP", "Pengajar", "Keterangan"].map((h) => (
                <th key={h} style={{ ...sel, textAlign: "center" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blok.map((b) => {
              if (b.jenis === "libur")
                return (
                  <tr key={b.tanggal}>
                    <td style={libur} />
                    <td style={libur}>
                      {hari(b.tanggal)}, {tgl(b.tanggal)}
                    </td>
                    <td style={libur} colSpan={4} />
                  </tr>
                );
              if (b.jenis === "mandiri")
                return b.sesi.map((s, i) => (
                  <tr key={`${b.mulai}-${s.id}`}>
                    {i === 0 ? <td style={{ ...sel, background: "#4bacc6" }} rowSpan={b.sesi.length} /> : null}
                    {i === 0 ? (
                      <td style={{ ...sel, background: "#4bacc6", textAlign: "center", fontWeight: 700, verticalAlign: "middle" }} rowSpan={b.sesi.length}>
                        {b.mulai === b.selesai ? tglPanjang(b.mulai) : `${tglPanjang(b.mulai)} s.d. ${tglPanjang(b.selesai)}`} (Pembelajaran Mandiri)
                      </td>
                    ) : null}
                    <td style={sel}>{s.kegiatan}</td>
                    <td style={{ ...sel, textAlign: "center" }}>{s.jp}</td>
                    <td style={sel} />
                    <td style={sel}>Mandiri</td>
                  </tr>
                ));
              const tatapMuka = b.sesi.some((s) => s.bentuk === "KLASIKAL" || s.bentuk === "LAPANGAN");
              if (tatapMuka) nomor++;
              return b.sesi.map((s, i) => (
                <tr key={s.id}>
                  {i === 0 ? (
                    <td style={{ ...sel, textAlign: "center" }} rowSpan={b.sesi.length}>
                      {tatapMuka ? nomor : ""}
                    </td>
                  ) : null}
                  <td style={sel}>
                    {i === 0 ? (
                      <div style={{ fontWeight: 700 }}>
                        {hari(b.tanggal)}, {tgl(b.tanggal)}
                      </div>
                    ) : null}
                    {s.jamMulai ? <div style={{ paddingLeft: 12 }}>{s.jamMulai}</div> : null}
                  </td>
                  <td style={{ ...sel, fontWeight: i > 0 && b.sesi[i - 1].kegiatan === s.kegiatan ? 400 : 700 }}>
                    {i > 0 && b.sesi[i - 1].kegiatan === s.kegiatan ? <div style={{ textAlign: "center" }}>- Lanjutan -</div> : s.kegiatan}
                  </td>
                  <td style={{ ...sel, textAlign: "center" }}>{s.jp}</td>
                  <td style={sel}>
                    {pengajar(s).map((x) => (
                      <div key={x}>{x}</div>
                    ))}
                  </td>
                  <td style={sel}>{[KET[s.bentuk], s.ruang, s.keterangan].filter(Boolean).join(" · ")}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
        <div style={{ fontSize: "8.5pt", marginTop: 6 }}>
          <div style={{ fontWeight: 700 }}>Keterangan: jadwal bersifat tentatif (bisa berubah sewaktu-waktu)</div>
          <div>Sync = tatap muka dengan pengajar (daring); Async = tidak tatap muka (mandiri).</div>
        </div>
        <div style={{ margin: "18px 0 0 auto", width: "8cm", textAlign: "center", fontSize: "10pt", lineHeight: 1.3, breakInside: "avoid" }}>
          <div>
            {KOTA_SURAT}, {BULAN[Number(d.training.startDate.slice(5, 7)) - 1]} {tahun}
          </div>
          <div style={{ fontWeight: 700 }}>
            KETUA TIM {(t.jenisPelatihan ?? "").toUpperCase()} {t.angkatan ? `ANGKATAN ${t.angkatan.toUpperCase()}` : ""}
          </div>
          <div style={{ fontWeight: 700 }}>{LEMBAGA_SINGKAT.toUpperCase()}</div>
          <div style={{ height: "1.8cm" }} />
          <div style={{ fontWeight: 700 }}>……………………………………</div>
          <div>NIP ……………………………</div>
        </div>
      </KertasCetak>
    );
  } catch (e) {
    if (e instanceof AppError) return <p style={{ padding: 24, color: "#b91c1c", fontFamily: "Arial" }}>{e.message}</p>;
    throw e;
  }
}
