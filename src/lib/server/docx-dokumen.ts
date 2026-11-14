import "server-only";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  LineRuleType,
  TabStopType,
} from "docx";
import { KOP_SURAT } from "@/lib/aplikasi";
import {
  KATA_PERINTAH,
  KOLOM_LAMPIRAN,
  LABEL_PENERIMA,
  NASKAH,
  TEKS_DAFTAR_TERLAMPIR,
  barisNomor,
  blokPenandatangan,
  kepalaLampiran,
  KERTAS_SURAT_TUGAS,
  pakaiLampiran,
  tempatTanggal,
  type Penandatangan,
} from "@/lib/tata-naskah";
import type { SuratTugasRecord } from "@/lib/server/repositories/dokumen";
import type { SuratKeteranganRecord } from "@/lib/server/repositories/surat-keterangan";
import { nilaiSurat } from "@/lib/surat-keterangan";

/**
 * Konsep Word (.docx) surat tugas dan surat keterangan. Surat (naskah dinas) mengikuti
 * Permendagri 18/2024 — A4, Arial 12, tepi kiri 3 / kanan 2 / bawah 2,5 cm (src/lib/tata-naskah.ts).
 * Tanpa tanda tangan: TTE di luar aplikasi (ruang kosong disediakan).
 */

export const FONT = "Arial";
export const PT = (n: number) => n * 2; // ukuran huruf docx dalam setengah-poin
export const CM = (n: number) => Math.round((n / 2.54) * 1440); // twip

// Lebar isi halaman (twip). A4 = 11906 × 16838.
const A4 = { width: 11906, height: 16838 };
/** Naskah dinas: A4 − tepi kiri 3 cm − kanan 2 cm. */
export const ISI_NASKAH = A4.width - CM(NASKAH.tepi.kiri) - CM(NASKAH.tepi.kanan);
export const HALAMAN_NASKAH = {
  size: A4,
  margin: { top: CM(NASKAH.tepi.atas), bottom: CM(NASKAH.tepi.bawah), left: CM(NASKAH.tepi.kiri), right: CM(NASKAH.tepi.kanan) },
};
/** Surat tugas: kertas F4 (21,5 × 33 cm), tepi sama dengan naskah lain. */
export const HALAMAN_SURAT_TUGAS = { ...HALAMAN_NASKAH, size: { width: CM(KERTAS_SURAT_TUGAS.lebar), height: CM(KERTAS_SURAT_TUGAS.tinggi) } };

/** Tabel berlebar tetap — tanpa ini LibreOffice/Word membagi kolom sama rata. */
export function lebarTetap(kolom: number[]) {
  return {
    width: { size: kolom.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: kolom,
    layout: TableLayoutType.FIXED,
  };
}

const TANPA: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const TANPA_BINGKAI = { top: TANPA, bottom: TANPA, left: TANPA, right: TANPA, insideHorizontal: TANPA, insideVertical: TANPA };
const GARIS: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
export const BINGKAI = { top: GARIS, bottom: GARIS, left: GARIS, right: GARIS, insideHorizontal: GARIS, insideVertical: GARIS };

export function teks(t: string, o: { bold?: boolean; size?: number; underline?: boolean } = {}) {
  // Tanpa `size`: ikut ukuran bawaan dokumen (naskah 12).
  return new TextRun({ text: t, font: FONT, size: o.size ? PT(o.size) : undefined, bold: o.bold, underline: o.underline ? {} : undefined });
}

export function p(t: string | TextRun[], o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number; indentKiri?: number; indentPertama?: number; underline?: boolean; satukan?: boolean; gantung?: number } = {}) {
  return new Paragraph({
    alignment: o.align,
    // `satukan`: jangan dipisah dari paragraf berikutnya (blok tanda tangan tidak terbelah halaman).
    keepNext: o.satukan,
    keepLines: o.satukan,
    spacing: { after: o.after ?? 0, before: o.before ?? 0 },
    // `gantung`: indentasi menggantung (nomor butir di kiri, baris lanjutan rata dengan awal teks; tab di posisi itu).
    indent: o.gantung ? { left: o.gantung, hanging: o.gantung } : o.indentKiri || o.indentPertama ? { left: o.indentKiri, firstLine: o.indentPertama } : undefined,
    tabStops: o.gantung ? [{ type: TabStopType.LEFT, position: o.gantung }] : undefined,
    children: typeof t === "string" ? [teks(t, o)] : t,
  });
}

export function sel(isi: (Paragraph | Table)[] | string, o: { lebar?: number; bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number; size?: number } = {}) {
  return new TableCell({
    children: typeof isi === "string" ? [p(isi, { bold: o.bold, align: o.align, size: o.size })] : isi,
    width: o.lebar ? { size: o.lebar, type: WidthType.DXA } : undefined,
    columnSpan: o.span,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

let logoCache: Buffer | null | undefined;
function logo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  for (const dasar of ["public"]) {
    try {
      logoCache = readFileSync(resolve(dasar + KOP_SURAT.logo));
      return logoCache;
    } catch {
      // coba lokasi berikutnya
    }
  }
  logoCache = null;
  return null;
}

/**
 * Di Vercel folder public/ tidak ikut ke fungsi server, jadi logo kop diambil lewat
 * `fetch` milik permintaan (berkas statis aplikasi sendiri). Panggil sebelum membuat Word.
 */
export async function siapkanLogo(ambil: (url: string) => Promise<Response>): Promise<void> {
  if (logo()) return;
  try {
    const res = await ambil(KOP_SURAT.logo);
    if (res.ok) logoCache = Buffer.from(await res.arrayBuffer());
  } catch {
    // tanpa logo: surat tetap dibuat
  }
}

export function kop(): (Paragraph | Table)[] {
  const gambar = logo();
  const kiri = gambar
    ? [new Paragraph({ children: [new ImageRun({ type: "png", data: gambar, transformation: { width: 76, height: 90 } })] })]
    : [p("")];
  const kanan = [
    ...KOP_SURAT.baris.map((b, i) => p(b, { bold: true, size: i < 2 ? 14 : 13, align: AlignmentType.CENTER })),
    ...KOP_SURAT.alamat.map((b) => p(b, { size: 8, align: AlignmentType.CENTER })),
  ];
  return [
    new Table({
      ...lebarTetap([CM(2.4), ISI_NASKAH - CM(2.4)]),
      borders: { ...TANPA_BINGKAI, bottom: { style: BorderStyle.DOUBLE, size: 6, color: "000000" } },
      rows: [new TableRow({ children: [sel(kiri, { lebar: CM(2.4) }), sel(kanan, { lebar: ISI_NASKAH - CM(2.4) })] })],
    }),
    // Tepi atas isi: 2 spasi di bawah kop (Permendagri 18/2024 Ps. 25 ayat 2).
    p(""),
    p(""),
  ];
}

/** Tabel tanpa garis: label | ":" | isi (bernomor bila >1 butir atau `selaluNomor`). */
export function baris(label: string, butir: string[], selaluNomor = false, satukanAkhir = false): TableRow[] {
  const nomor = selaluNomor || butir.length > 1;
  const isi = butir.length === 0 ? ["-"] : butir;
  return isi.map((b, i) => {
    // Butir terakhir "Untuk" ikut ke halaman blok tanda tangan (tanda tangan tidak berdiri sendiri).
    const satukan = satukanAkhir && i === isi.length - 1;
    return new TableRow({
      cantSplit: satukan,
      children: [
        sel([p(i === 0 ? label : "", { satukan })], { lebar: KOLOM_ISI_SURAT[0] }),
        sel([p(i === 0 ? ":" : "", { satukan })], { lebar: KOLOM_ISI_SURAT[1] }),
        sel([p(nomor ? [teks(`${i + 1}.`), new TextRun({ text: "\t", font: FONT }), teks(b)] : b, { align: AlignmentType.JUSTIFIED, after: 20, satukan, gantung: nomor ? CM(0.6) : undefined })], { lebar: KOLOM_ISI_SURAT[2] }),
      ],
    });
  });
}

export const KOLOM_ISI_SURAT = [CM(2.4), CM(0.5), ISI_NASKAH - CM(2.9)];
/** Kepada : 1. Nama : … — label | ":" | no | label isian | ":" | nilai. */
const KOLOM_KEPADA = [CM(2.4), CM(0.5), CM(0.6), CM(2.8), CM(0.4), ISI_NASKAH - CM(6.7)];

/** Penerima di badan surat, bernomor (Lampiran B.2); lebih dari batas → "Daftar nama terlampir". */
function tabelKepada(daftar: DataSuratTugas["penerima"]): Table {
  if (pakaiLampiran(daftar.length))
    return new Table({
      ...lebarTetap(KOLOM_ISI_SURAT),
      borders: TANPA_BINGKAI,
      rows: [new TableRow({ children: ["Kepada", ":", TEKS_DAFTAR_TERLAMPIR].map((t, k) => sel(t, { lebar: KOLOM_ISI_SURAT[k] })) })],
    });
  const rows = daftar.length
    ? daftar.flatMap((r, i) =>
        [r.nama, r.pangkat, r.nip, r.jabatan].map(
          (v, j) =>
            new TableRow({
              cantSplit: true,
              children: [i === 0 && j === 0 ? "Kepada" : "", i === 0 && j === 0 ? ":" : "", j === 0 ? `${i + 1}.` : "", LABEL_PENERIMA[j], ":", v].map((t, k) =>
                sel([p(t, { before: j === 0 && i > 0 ? 40 : 0 })], { lebar: KOLOM_KEPADA[k] }),
              ),
            }),
        ),
      )
    : [new TableRow({ children: ["Kepada", ":", "", "-", "", ""].map((t, k) => sel(t, { lebar: KOLOM_KEPADA[k] })) })];
  return new Table({ ...lebarTetap(KOLOM_KEPADA), borders: TANPA_BINGKAI, rows });
}

/**
 * Tempat, tanggal + blok tanda tangan (Ps. 35 ayat 2), dengan ruang untuk TTE. `tempat` null =
 * tanpa baris tempat-tanggal (nota dinas, surat dinas: tanggal di bagian atas).
 */
export function blokTandaTangan(tempat: string | null, tanggal: string, ttd: Penandatangan, kiri = CM(8.5)): Paragraph[] {
  const blok = blokPenandatangan(ttd);
  const akhir = blok.bawah.length - 1;
  return [
    tempat === null ? p("", { before: 200, satukan: true }) : p(tempatTanggal(tempat, tanggal), { indentKiri: kiri, before: 240, satukan: true }),
    ...blok.atas.map((b) => p(b, { indentKiri: kiri, satukan: true })),
    // Ruang untuk tanda tangan elektronik (kode QR, ±2 cm termasuk baris kosong ini).
    p("", { after: 860, indentKiri: kiri, satukan: true }),
    ...blok.bawah.map((b, i) => p(b, { indentKiri: kiri, satukan: i < akhir })),
  ];
}

/** Lebar kolom tabel lampiran: No, Nama, Pangkat/Gol., NIP, Jabatan (total = lebar isi 16 cm). */
const KOLOM_TABEL_LAMPIRAN = [CM(1), CM(4), CM(3.2), CM(4.6), ISI_NASKAH - CM(12.8)];

/**
 * Lampiran daftar nama (Ps. 28): kepala lampiran di kanan atas, tabel bergaris, tanda tangan
 * pejabat yang sama. Section sendiri: halaman pertama lampiran tanpa nomor, halaman berikutnya
 * bernomor angka Arab di tengah atas (Ps. 26).
 */
function sectionLampiran(s: DataSuratTugas) {
  const kiri = CM(9);
  const kepala = new TableRow({
    tableHeader: true,
    children: KOLOM_LAMPIRAN.map((t, j) => sel(t, { lebar: KOLOM_TABEL_LAMPIRAN[j], bold: true, align: AlignmentType.CENTER })),
  });
  const baris = s.penerima.map(
    (r, i) =>
      new TableRow({
        cantSplit: true,
        children: [`${i + 1}.`, r.nama, r.pangkat, r.nip, r.jabatan].map((t, j) =>
          sel(t, { lebar: KOLOM_TABEL_LAMPIRAN[j], align: j === 0 ? AlignmentType.CENTER : undefined }),
        ),
      }),
  );
  return {
    properties: { titlePage: true, page: { ...HALAMAN_SURAT_TUGAS, pageNumbers: { start: 1 } } },
    headers: {
      first: new Header({ children: [p("")] }),
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: FONT, children: [PageNumber.CURRENT] })] })] }),
    },
    children: [
      ...kepalaLampiran(s.nomor, s.tanggal).map((b) => p(b, { indentKiri: kiri })),
      p(""),
      p("DAFTAR NAMA", { bold: true, align: AlignmentType.CENTER, after: 120 }),
      new Table({ ...lebarTetap(KOLOM_TABEL_LAMPIRAN), borders: BINGKAI, rows: [kepala, ...baris] }),
      ...blokTandaTangan(s.tempat, s.tanggal, s.ttd),
    ],
  };
}

/** Isian surat tugas (mengajar atau umum dari modul persuratan). */
export type DataSuratTugas = Pick<SuratTugasRecord, "nomor" | "tanggal" | "tempat" | "dasar" | "untuk" | "penerima" | "ttd">;

export async function docxSuratTugas(s: DataSuratTugas): Promise<Buffer> {
  const isi: (Paragraph | Table)[] = [
    ...kop(),
    p("SURAT TUGAS", { bold: true, align: AlignmentType.CENTER }),
    p(barisNomor(s.nomor), { align: AlignmentType.CENTER, after: 180 }),
    new Table({ ...lebarTetap(KOLOM_ISI_SURAT), borders: TANPA_BINGKAI, rows: baris("Dasar", s.dasar) }),
    p(KATA_PERINTAH, { bold: true, align: AlignmentType.CENTER, before: 120, after: 120 }),
    tabelKepada(s.penerima),
    // Pemisah tabel Kepada & Untuk (tanpa paragraf, Word menggabungkan kedua tabel): tinggi tetap 6 pt.
    new Paragraph({ spacing: { line: 120, lineRule: LineRuleType.EXACT, before: 0, after: 0 } }),
    new Table({ ...lebarTetap(KOLOM_ISI_SURAT), borders: TANPA_BINGKAI, rows: baris("Untuk", s.untuk, true, true) }),
    ...blokTandaTangan(s.tempat, s.tanggal, s.ttd),
  ];
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: PT(NASKAH.huruf.ukuran) } } } },
    sections: [{ properties: { page: HALAMAN_SURAT_TUGAS }, children: isi }, ...(pakaiLampiran(s.penerima.length) ? [sectionLampiran(s)] : [])],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ------------------------------------------------------------------ SURAT KETERANGAN

/** Surat keterangan ditunda/tidak lulus — naskah dinas khusus, format sama dengan surat tugas, tanpa tanda tangan (TTE). */
export async function docxSuratKeterangan(r: SuratKeteranganRecord): Promise<Buffer> {
  const isi = r.isi;
  const KOL_ID = [CM(1), CM(3), CM(0.5), ISI_NASKAH - CM(4.5)];
  const KOL_ASPEK = [CM(1), ISI_NASKAH - CM(8), CM(3), CM(4)];
  const anak: (Paragraph | Table)[] = [
    ...kop(),
    p("SURAT KETERANGAN", { bold: true, align: AlignmentType.CENTER, underline: true }),
    p(barisNomor(r.nomor), { align: AlignmentType.CENTER, after: 240 }),
    p(isi.pembuka, { align: AlignmentType.JUSTIFIED, after: 120 }),
    new Table({
      ...lebarTetap(KOL_ID),
      borders: TANPA_BINGKAI,
      rows: isi.identitas.map(([l, v]) => new TableRow({ children: ["", l, ":", v].map((t, j) => sel(t, { lebar: KOL_ID[j], bold: j === 3 && l === "Nama" })) })),
    }),
    p(isi.pernyataan, { align: AlignmentType.JUSTIFIED, before: 120, after: 120 }),
  ];
  if (isi.aspek.length)
    anak.push(
      new Table({
        ...lebarTetap(KOL_ASPEK),
        borders: BINGKAI,
        rows: [
          new TableRow({ children: ["No", "Aspek evaluasi", "Nilai", "Kualifikasi"].map((t, j) => sel(t, { lebar: KOL_ASPEK[j], bold: true, align: AlignmentType.CENTER })) }),
          ...isi.aspek.map(
            (a, i) =>
              new TableRow({
                children: [
                  sel(`${i + 1}.`, { lebar: KOL_ASPEK[0], align: AlignmentType.CENTER }),
                  sel(a.label, { lebar: KOL_ASPEK[1] }),
                  sel(nilaiSurat(a.nilai), { lebar: KOL_ASPEK[2], align: AlignmentType.CENTER }),
                  sel(a.kualifikasi, { lebar: KOL_ASPEK[3], align: AlignmentType.CENTER }),
                ],
              }),
          ),
        ],
      }),
      p("", { after: 120 }),
    );
  if (isi.ketentuan.length) {
    anak.push(p("Ketentuan:", { after: 60 }));
    isi.ketentuan.forEach((k, i) => anak.push(p(isi.ketentuan.length > 1 ? [teks(`${i + 1}.  `), teks(k)] : k, { align: AlignmentType.JUSTIFIED, after: 60, indentKiri: CM(0.5) })));
  }
  anak.push(
    p(isi.penutup, { align: AlignmentType.JUSTIFIED, before: 120 }),
    ...blokTandaTangan(r.kota, r.tanggal, r.penandatangan),
  );
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: PT(NASKAH.huruf.ukuran) } } } },
    sections: [{ properties: { page: HALAMAN_NASKAH }, children: anak }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** Nama berkas aman untuk unduhan. */
export function namaBerkas(...bagian: string[]): string {
  return bagian
    .join(" ")
    .replace(/[^\p{L}\p{N} ._-]+/gu, "")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}
