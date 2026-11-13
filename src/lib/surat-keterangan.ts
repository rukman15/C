/**
 * Surat keterangan peserta "ditunda kelulusannya" / "tidak lulus" PKA/PKP —
 * KepKa LAN 2/K.1/PDP.07/2023 BAB III.E (ketentuan kelulusan & remedial) dan III.F.5–6
 * (surat keterangan ditandatangani pimpinan lembaga penyelenggara). Bentuk surat
 * belum dibakukan LAN ("mengacu pada kebijakan Kepala LAN") — ini konsep balai.
 * Logika murni — diuji di uji/murni.test.ts. Dipakai bersama oleh Word & halaman cetak.
 */
import { NAMA_LEMBAGA } from "@/lib/aplikasi";
import { nipBerspasi, periodeSurat, tanggalPanjang } from "@/lib/dokumen";
import type { JenisEvaluasi } from "@/lib/kurikulum";

export const JENIS_SURAT_KETERANGAN = ["DITUNDA", "TIDAK_LULUS"] as const;
export type JenisSuratKeterangan = (typeof JENIS_SURAT_KETERANGAN)[number];
export const isJenisSuratKeterangan = (v: unknown): v is JenisSuratKeterangan =>
  typeof v === "string" && (JENIS_SURAT_KETERANGAN as readonly string[]).includes(v);

export const LABEL_SURAT_KETERANGAN: Record<JenisSuratKeterangan, string> = {
  DITUNDA: "Ditunda kelulusannya",
  TIDAK_LULUS: "Tidak lulus",
};

/** Batas remedial dari Pedoman. */
export const HARI_KERJA_REMEDIAL_AKADEMIK = 14;
export const HARI_REMEDIAL_IMPLEMENTASI = 60;

/** Tanggal ISO + n hari kalender. */
export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DataSuratKeterangan = {
  jenis: JenisSuratKeterangan;
  program: string; // "Pelatihan Kepemimpinan Administrator (PKA) Angkatan IV"
  mulai: string;
  selesai: string | null;
  peserta: { nama: string; nip: string | null; jabatan: string | null; instansi: string | null };
  /** Evaluasi yang belum memenuhi syarat kelulusan. */
  aspek: { kode: JenisEvaluasi; label: string; nilai: number | null; kualifikasi: string }[];
  /** Hanya DITUNDA: jenis evaluasi yang boleh diremedial; sikap perilaku diputus Tim. */
  perluRemedial: JenisEvaluasi[];
  perluKeputusanTim: boolean;
};

export type IsiSuratKeterangan = {
  judulStatus: string;
  pembuka: string;
  identitas: [string, string][];
  pernyataan: string;
  aspek: DataSuratKeterangan["aspek"];
  ketentuan: string[];
  penutup: string;
};

const angka = (n: number | null) => (n == null ? "-" : n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const nilaiSurat = angka;

function ketentuanRemedial(d: DataSuratKeterangan): string[] {
  const selesai = d.selesai ?? d.mulai;
  const out: string[] = [];
  for (const k of d.perluRemedial) {
    const label = d.aspek.find((a) => a.kode === k)?.label ?? k;
    if (k === "AKADEMIK")
      out.push(`Perbaikan ${label} dilaksanakan paling lama ${HARI_KERJA_REMEDIAL_AKADEMIK} (empat belas) hari kerja setelah pelatihan berakhir.`);
    else if (k === "AKTUALISASI_IMPLEMENTASI")
      out.push(
        `Perbaikan ${label} diberikan waktu paling lama ${HARI_REMEDIAL_IMPLEMENTASI} (enam puluh) hari kalender setelah pelatihan berakhir, yaitu sampai dengan ${tanggalPanjang(tambahHari(selesai, HARI_REMEDIAL_IMPLEMENTASI))}.`,
      );
    else out.push(`Perbaikan ${label} dilaksanakan dalam masa remedial yang ditetapkan penyelenggara.`);
  }
  if (d.perluKeputusanTim)
    out.push("Remedial tidak diberlakukan untuk Evaluasi Sikap Perilaku; status kelulusan atas evaluasi tersebut diputuskan oleh Tim Evaluasi Akhir.");
  out.push("Kesempatan remedial diberikan 1 (satu) kali. Berdasarkan hasil remedial, Tim Evaluasi Akhir melakukan evaluasi akhir kedua untuk menetapkan kelulusan.");
  return out;
}

export function susunSuratKeterangan(d: DataSuratKeterangan): IsiSuratKeterangan {
  const ditunda = d.jenis === "DITUNDA";
  const singkat = /\(([A-Z]+)\)/.exec(d.program)?.[1] ?? "pelatihan";
  return {
    judulStatus: ditunda ? "DITUNDA KELULUSANNYA" : "TIDAK LULUS",
    pembuka: `Yang bertanda tangan di bawah ini, Kepala ${NAMA_LEMBAGA}, menerangkan bahwa:`,
    identitas: [
      ["Nama", d.peserta.nama],
      ["NIP", d.peserta.nip ? nipBerspasi(d.peserta.nip) : "-"],
      ["Jabatan", d.peserta.jabatan?.trim() || "-"],
      ["Instansi", d.peserta.instansi?.trim() || "-"],
    ],
    pernyataan:
      `adalah peserta ${d.program} yang diselenggarakan oleh ${NAMA_LEMBAGA} pada tanggal ${periodeSurat(d.mulai, d.selesai)}, ` +
      `dan berdasarkan hasil evaluasi akhir oleh Tim Evaluasi Akhir dinyatakan ${ditunda ? "DITUNDA KELULUSANNYA" : "TIDAK LULUS"}` +
      (d.aspek.length ? ` dengan aspek evaluasi yang belum memenuhi syarat kelulusan sebagai berikut:` : "."),
    aspek: d.aspek,
    ketentuan: ditunda
      ? ketentuanRemedial(d)
      : [`Yang bersangkutan dapat diusulkan kembali menjadi peserta ${singkat} pada kesempatan berikutnya paling banyak 1 (satu) kali.`],
    penutup: "Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.",
  };
}
