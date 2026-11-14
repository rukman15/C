import "server-only";
import { AlignmentType, BorderStyle, Document, Header, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, type ISectionOptions } from "docx";
import { nipBerspasi, tanggalPanjang, terbilang } from "@/lib/dokumen";
import {
  BINGKAI,
  CM,
  FONT,
  HALAMAN_NASKAH,
  ISI_NASKAH,
  PT,
  TANPA_BINGKAI,
  blokTandaTangan,
  docxSuratTugas,
  kop,
  lebarTetap,
  p,
  sel,
} from "@/lib/server/docx-dokumen";
import { NASKAH, barisNomor, blokPenandatangan, type Penandatangan } from "@/lib/tata-naskah";
import { PERHATIAN_SPD, PERNYATAAN_SPD, jabatanSatuBaris, jenisNaskah, pembukaBeritaAcara, romawi, teksNotaDinasCuti, teksSuratIzinCuti, type PihakNaskah } from "@/lib/persuratan";
import type { NaskahRecord } from "@/lib/server/repositories/persuratan";
import type { SuratCutiRecord } from "@/lib/server/repositories/cuti";
import type { SetSpdRecord, SpdRecord } from "@/lib/server/repositories/spd";

/**
 * Word (.docx) naskah dinas modul persuratan — format Permendagri 18/2024 (A4, Arial 12, tepi
 * 3/2/2,5 cm; kop UPT; blok tanda tangan Ps. 35 ayat 2). Tanpa tanda tangan: TTE di luar aplikasi.
 */

const J = AlignmentType.JUSTIFIED;
const TENGAH = AlignmentType.CENTER;
const KANAN = AlignmentType.RIGHT;
const SATU_CM = CM(1);

/** Paragraf isi surat: rata kiri-kanan, baris pertama menjorok. */
const paragrafIsi = (t: string) => p(t, { align: J, after: 120, indentPertama: SATU_CM });

/** Tabel label : isi tanpa garis (Nomor/Sifat/Lampiran/Hal, Yth./Dari/…). */
function tabelLabel(rows: [string, string | string[]][], lebarLabel = CM(2.6)): Table {
  const kolom = [lebarLabel, CM(0.5), ISI_NASKAH - lebarLabel - CM(0.5)];
  return new Table({
    ...lebarTetap(kolom),
    borders: TANPA_BINGKAI,
    rows: rows.map(([l, v]) => {
      const isi = Array.isArray(v) ? (v.length ? v : ["-"]) : [v || "-"];
      const par = isi.map((x, i) => p(isi.length > 1 ? `${i + 1}. ${x}` : x));
      return new TableRow({ children: [sel(l, { lebar: kolom[0] }), sel(":", { lebar: kolom[1] }), sel(par, { lebar: kolom[2] })] });
    }),
  });
}

/** Rincian acara (hari/tanggal, waktu, tempat, acara) menjorok di bawah paragraf pembuka. */
function tabelAcara(a: NonNullable<NaskahRecord["isi"]["acara"]>): Table {
  const kolom = [CM(1), CM(3.4), CM(0.5), ISI_NASKAH - CM(4.9)];
  const isi: [string, string][] = [
    ["Hari/tanggal", a.hari],
    ["Waktu", a.waktu],
    ["Tempat", a.tempat],
    ["Acara", a.acara],
  ];
  return new Table({
    ...lebarTetap(kolom),
    borders: TANPA_BINGKAI,
    rows: isi.map(([l, v]) => new TableRow({ children: ["", l, ":", v || "-"].map((t, j) => sel(t, { lebar: kolom[j] })) })),
  });
}

/** Tembusan di kiri bawah (Ps. 27 ayat 5). */
function blokTembusan(daftar: string[]): Paragraph[] {
  if (!daftar.length) return [];
  return [
    p("Tembusan:", { before: 360 }),
    ...daftar.map((t, i) => p(daftar.length > 1 ? `${i + 1}. ${t};` : `${t}.`, { indentKiri: CM(0.3) })),
  ];
}

/** Lampiran tabel (Ps. 28): halaman baru, halaman berikutnya bernomor di tengah atas. */
function sectionLampiranTabel(n: NaskahRecord): ISectionOptions | null {
  const l = n.isi.lampiran;
  if (!l || !l.baris.length) return null;
  // Kolom "No." 1 cm, "NIP" 4,6 cm (18 angka satu baris); kolom lain berbagi sisa lebar sama rata.
  const tetap = l.kolom.map((k, i) => (i === 0 && /^no/i.test(k) ? CM(1) : /^nip$/i.test(k.trim()) ? CM(4.6) : 0));
  const bebas = tetap.filter((x) => x === 0).length;
  const sisa = bebas ? Math.floor((ISI_NASKAH - tetap.reduce((a, b) => a + b, 0)) / bebas) : 0;
  const lebar = tetap.map((x) => x || sisa);
  const kepala = new TableRow({ tableHeader: true, children: l.kolom.map((k, j) => sel(k, { lebar: lebar[j], bold: true, align: TENGAH })) });
  const isi = l.baris.map((b) => new TableRow({ cantSplit: true, children: b.map((t, j) => sel(t || "-", { lebar: lebar[j], align: j === 0 ? TENGAH : undefined })) }));
  return {
    properties: { titlePage: true, page: { ...HALAMAN_NASKAH, pageNumbers: { start: 1 } } },
    headers: {
      first: new Header({ children: [p("")] }),
      default: new Header({ children: [new Paragraph({ alignment: TENGAH, children: [new TextRun({ font: FONT, children: [PageNumber.CURRENT] })] })] }),
    },
    children: [
      ...["LAMPIRAN", `${n.label.toUpperCase()}`, barisNomor(n.nomor), `TANGGAL ${tanggalPanjang(n.tanggal).toUpperCase()}`].map((b) => p(b, { indentKiri: CM(9) })),
      p(""),
      p(l.judul || "DAFTAR", { bold: true, align: TENGAH, after: 120 }),
      new Table({ ...lebarTetap(lebar), borders: BINGKAI, rows: [kepala, ...isi] }),
      ...blokTandaTangan(null, n.tanggal, n.ttd),
    ],
  };
}

// ------------------------------------------------------------------ BENTUK

/** Nota dinas (Lampiran: Yth., Dari, Tembusan, Tanggal, Nomor, Sifat, Lampiran, Hal). */
export function isiNotaDinas(d: {
  kepada: string[];
  dari: string;
  tembusan: string[];
  tanggal: string;
  nomor: string | null;
  sifat: string;
  lampiran: string;
  hal: string;
  paragraf: string[];
  ttd: Penandatangan;
}): (Paragraph | Table)[] {
  return [
    ...kop(),
    p("NOTA DINAS", { bold: true, align: TENGAH, after: 240 }),
    tabelLabel([
      ["Yth.", d.kepada],
      ["Dari", d.dari],
      ["Tembusan", d.tembusan],
      ["Tanggal", tanggalPanjang(d.tanggal)],
      ["Nomor", d.nomor?.trim() || "…………………"],
      ["Sifat", d.sifat],
      ["Lampiran", d.lampiran || "-"],
      ["Hal", d.hal],
    ]),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } }, spacing: { after: 240 }, children: [] }),
    ...d.paragraf.map(paragrafIsi),
    ...blokTandaTangan(null, d.tanggal, d.ttd),
  ];
}

function isiSuratDinas(n: NaskahRecord): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    ...kop(),
    p(tanggalPanjang(n.tanggal), { align: KANAN, after: 120 }),
    tabelLabel([
      ["Nomor", n.nomor?.trim() || "…………………"],
      ["Sifat", n.sifat],
      ["Lampiran", n.lampiranTeks || "-"],
      ["Hal", n.hal],
    ]),
    p("", { after: 120 }),
    ...n.kepada.map((k, i) => p(i === 0 ? `Yth. ${k}` : k, { indentKiri: i === 0 ? 0 : CM(0.9) })),
    p("", { after: 120 }),
  ];
  const par = n.isi.paragraf;
  par.forEach((t, i) => {
    out.push(paragrafIsi(t));
    if (i === 0 && n.isi.acara) out.push(tabelAcara(n.isi.acara), p("", { after: 120 }));
  });
  if (!par.length && n.isi.acara) out.push(tabelAcara(n.isi.acara));
  out.push(...blokTandaTangan(null, n.tanggal, n.ttd), ...blokTembusan(n.tembusan));
  return out;
}

/** Blok tanda tangan satu pihak berita acara (di dalam sel tabel). */
function selPihak(ph: PihakNaskah, lebar: number): TableCell {
  const b = blokPenandatangan({ jabatan: [ph.sebutan ? `${ph.sebutan},` : "", ph.jabatan].filter(Boolean), nama: ph.nama, nip: ph.nip, pangkat: "" });
  return new TableCell({
    width: { size: lebar, type: WidthType.DXA },
    children: [...b.atas.map((x) => p(x, { align: TENGAH })), p("", { after: 1000 }), ...b.bawah.map((x) => p(x, { align: TENGAH }))],
  });
}

function isiBeritaAcara(n: NaskahRecord): (Paragraph | Table)[] {
  const kolom = [CM(1), CM(2.6), CM(0.5), ISI_NASKAH - CM(4.1)];
  const pihak = n.isi.pihak;
  const out: (Paragraph | Table)[] = [
    ...kop(),
    p("BERITA ACARA", { bold: true, align: TENGAH }),
    ...(n.hal ? [p(n.hal.toUpperCase(), { bold: true, align: TENGAH })] : []),
    p(barisNomor(n.nomor), { align: TENGAH, after: 240 }),
    p(`${pembukaBeritaAcara(n.tanggal)} kami yang bertanda tangan di bawah ini:`, { align: J, after: 120 }),
    new Table({
      ...lebarTetap(kolom),
      borders: TANPA_BINGKAI,
      rows: pihak.flatMap((ph, i) =>
        (
          [
            ["Nama", ph.nama || "…………"],
            ["NIP", ph.nip || "-"],
            ["Jabatan", ph.jabatan || "…………"],
          ] as [string, string][]
        )
          .map(([l, v], j) => new TableRow({ children: [j === 0 ? `${i + 1}.` : "", l, ":", v].map((t, k) => sel(t, { lebar: kolom[k] })) }))
          .concat(ph.sebutan ? [new TableRow({ children: ["", `selanjutnya disebut ${ph.sebutan}.`].map((t, k) => sel(t, { lebar: k === 0 ? kolom[0] : ISI_NASKAH - kolom[0], span: k === 1 ? 3 : undefined })) })] : []),
      ),
    }),
    p("", { after: 120 }),
    ...n.isi.paragraf.map(paragrafIsi),
    p("", { after: 240 }),
  ];
  // Tanda tangan para pihak: dua per baris, urutan Lampiran (Pihak Kedua di kiri, Pihak Pertama di kanan).
  const urut = pihak.length === 2 ? [pihak[1], pihak[0]] : pihak;
  const lebar = Math.floor(ISI_NASKAH / 2);
  for (let i = 0; i < urut.length; i += 2) {
    const kiri = urut[i];
    const kanan = urut[i + 1];
    out.push(
      new Table({
        ...lebarTetap([lebar, lebar]),
        borders: TANPA_BINGKAI,
        rows: [new TableRow({ cantSplit: true, children: [selPihak(kiri, lebar), kanan ? selPihak(kanan, lebar) : new TableCell({ width: { size: lebar, type: WidthType.DXA }, children: [p("")] })] })],
      }),
    );
  }
  if (n.isi.mengetahui) {
    const m = n.isi.mengetahui;
    const b = blokPenandatangan({ jabatan: [m.jabatan], nama: m.nama, nip: m.nip, pangkat: "" });
    out.push(
      p("Mengetahui/Mengesahkan,", { align: TENGAH, before: 240, satukan: true }),
      ...b.atas.map((x) => p(x, { align: TENGAH, satukan: true })),
      p("", { after: 1000, satukan: true }),
      ...b.bawah.map((x, i) => p(x, { align: TENGAH, satukan: i < b.bawah.length - 1 })),
    );
  }
  return out;
}

function isiLaporan(n: NaskahRecord): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [p("LAPORAN", { bold: true, align: TENGAH }), p((n.hal || n.label).toUpperCase(), { bold: true, align: TENGAH, after: 360 })];
  n.isi.bagian.forEach((b, i) => {
    out.push(p(`${romawi(i + 1)}. ${b.judul}`, { bold: true, before: 240, after: 120, satukan: true }));
    b.isi.forEach((t) => out.push(p(t, { align: J, after: 120, indentKiri: CM(0.8), indentPertama: CM(0.8) })));
  });
  out.push(...blokTandaTangan(n.tempat, n.tanggal, n.ttd));
  return out;
}

const gaya = { default: { document: { run: { font: FONT, size: PT(NASKAH.huruf.ukuran) } } } };

async function jadikan(sections: ISectionOptions[]): Promise<Buffer> {
  return Buffer.from(await Packer.toBuffer(new Document({ styles: gaya, sections })));
}

/** Word satu naskah dinas sesuai bentuknya. */
export async function docxNaskah(n: NaskahRecord): Promise<Buffer> {
  const bentuk = jenisNaskah(n.jenis)?.bentuk ?? "surat-dinas";
  if (bentuk === "surat-tugas") {
    return docxSuratTugas({ nomor: n.nomor, tanggal: n.tanggal, tempat: n.tempat, dasar: n.isi.dasar, untuk: n.isi.untuk, penerima: n.penerima, ttd: n.ttd });
  }
  let isi: (Paragraph | Table)[];
  switch (bentuk) {
    case "nota-dinas":
      isi = isiNotaDinas({
        kepada: n.kepada,
        dari: jabatanSatuBaris(n.ttdJabatan),
        tembusan: n.tembusan,
        tanggal: n.tanggal,
        nomor: n.nomor,
        sifat: n.sifat,
        lampiran: n.lampiranTeks,
        hal: n.hal,
        paragraf: n.isi.paragraf,
        ttd: n.ttd,
      });
      break;
    case "berita-acara":
      isi = isiBeritaAcara(n);
      break;
    case "laporan":
      isi = isiLaporan(n);
      break;
    default:
      isi = isiSuratDinas(n);
  }
  const lamp = sectionLampiranTabel(n);
  return jadikan([{ properties: { page: HALAMAN_NASKAH }, children: isi }, ...(lamp ? [lamp] : [])]);
}

// ------------------------------------------------------------------ CUTI

/** Isi Surat Izin Cuti (judul, nomor, identitas, ketentuan, tanda tangan Kepala Balai). */
function isiSuratIzin(s: SuratCutiRecord, ttd: Penandatangan): (Paragraph | Table)[] {
  const t = teksSuratIzinCuti(s.data);
  const kolom = [CM(1), CM(4), CM(0.5), ISI_NASKAH - CM(5.5)];
  return [
    ...kop(),
    p(t.judul, { bold: true, align: TENGAH }),
    p(barisNomor(s.cuti.nomorSuratIzin), { align: TENGAH, after: 240 }),
    p(t.pembuka, { after: 120 }),
    new Table({
      ...lebarTetap(kolom),
      borders: TANPA_BINGKAI,
      rows: t.identitas.map(([l, v]) => new TableRow({ children: ["", l, ":", v].map((x, j) => sel(x, { lebar: kolom[j] })) })),
    }),
    p(t.isi, { align: J, before: 120, after: 120 }),
    p(t.penutup, { align: J }),
    ...blokTandaTangan(s.tempat, s.tanggal, ttd),
  ];
}

/** Word cuti: halaman 1 Nota Dinas permohonan, halaman 2 Surat Izin Cuti bila izin diberikan balai (satu nomor urut). */
export async function docxCuti(s: SuratCutiRecord): Promise<Buffer> {
  const nd = teksNotaDinasCuti(s.data, s.pemberiIzin, s.kepadaPemberi);
  const nota = isiNotaDinas({
    kepada: [s.notaDinas.yth],
    dari: s.notaDinas.dari,
    tembusan: s.notaDinas.tembusan,
    tanggal: s.tanggal,
    nomor: s.cuti.nomorNotaDinas,
    sifat: s.notaDinas.sifat,
    lampiran: s.notaDinas.lampiran,
    hal: nd.hal,
    paragraf: nd.paragraf,
    ttd: s.ttdNotaDinas,
  });
  return jadikan([
    { properties: { page: HALAMAN_NASKAH }, children: nota },
    ...(s.ttdIzin ? [{ properties: { page: HALAMAN_NASKAH }, children: isiSuratIzin(s, s.ttdIzin) }] : []),
  ]);
}

// ------------------------------------------------------------------ SPD

const KECIL = 10;
const ps = (t: string, o: Parameters<typeof p>[1] = {}) => p(t, { size: KECIL, ...o });

/** Blok tanda tangan PPK (tanpa tempat/tanggal), rata tengah di dalam sel. */
function ttdPpk(ppk: SetSpdRecord["ppk"], ruang = 700): Paragraph[] {
  return [
    ps("Pejabat Pembuat Komitmen,", { align: TENGAH }),
    p("", { after: ruang }),
    ps(ppk.nama || "(……………………………)", { align: TENGAH }),
    ...(ppk.pangkat ? [ps(ppk.pangkat, { align: TENGAH })] : []),
    ps(`NIP ${ppk.nip ? nipBerspasi(ppk.nip) : "……………………"}`, { align: TENGAH }),
  ];
}

/** Lembar I SPD (Lampiran I PMK 113/PMK.05/2012): butir 1–10. */
function lembarSpd1(set: SetSpdRecord, d: SpdRecord): (Paragraph | Table)[] {
  const kol = [CM(1), CM(6.4), ISI_NASKAH - CM(7.4)];
  const baris = (no: string, kiri: string[], kanan: string[]) =>
    new TableRow({
      cantSplit: true,
      children: [
        sel([ps(no, { align: TENGAH })], { lebar: kol[0] }),
        sel(kiri.map((x) => ps(x)), { lebar: kol[1] }),
        sel(kanan.map((x) => ps(x || "-")), { lebar: kol[2] }),
      ],
    });
  const pengikut = new Table({
    ...lebarTetap([kol[1] - CM(0.4), Math.floor(kol[2] / 2), Math.floor(kol[2] / 2)]),
    borders: BINGKAI,
    rows: [
      new TableRow({ children: [sel([ps("Pengikut: Nama")]), sel([ps("Tanggal Lahir", { align: TENGAH })]), sel([ps("Keterangan", { align: TENGAH })])] }),
      ...[1, 2, 3].map((i) => new TableRow({ children: [sel([ps(`${i}.`)]), sel([ps("")]), sel([ps("")])] })),
    ],
  });
  return [
    ...kop(),
    new Table({
      ...lebarTetap([ISI_NASKAH - CM(7), CM(7)]),
      borders: TANPA_BINGKAI,
      rows: [
        new TableRow({
          children: [
            sel([ps("")]),
            sel([ps("Lembar ke : I"), ps("Kode No. : …………"), ps(`Nomor : ${d.nomor?.trim() || "…………………"}`)]),
          ],
        }),
      ],
    }),
    p("SURAT PERJALANAN DINAS (SPD)", { bold: true, underline: true, align: TENGAH, before: 120, after: 160 }),
    new Table({
      ...lebarTetap(kol),
      borders: BINGKAI,
      rows: [
        baris("1.", ["Pejabat Pembuat Komitmen"], [set.ppk.nama ? `${set.ppk.nama}` : ""]),
        baris("2.", ["Nama/NIP Pegawai yang melaksanakan perjalanan dinas"], [d.pegawai.nama, `NIP ${d.pegawai.nip}`]),
        baris("3.", ["a. Pangkat dan Golongan", "b. Jabatan/Instansi", "c. Tingkat Biaya Perjalanan Dinas"], [`a. ${d.pegawai.pangkat}`, `b. ${d.pegawai.jabatan} / ${set.instansi}`, `c. ${d.tingkatBiaya || "…"}`]),
        baris("4.", ["Maksud Perjalanan Dinas"], [d.maksud]),
        baris("5.", ["Alat angkutan yang dipergunakan"], [d.alatAngkut]),
        baris("6.", ["a. Tempat berangkat", "b. Tempat tujuan"], [`a. ${d.tempatBerangkat}`, `b. ${d.tempatTujuan}`]),
        baris("7.", ["a. Lamanya Perjalanan Dinas", "b. Tanggal berangkat", "c. Tanggal harus kembali/tiba di tempat baru *)"], [
          `a. ${d.lamaHari} (${terbilang(d.lamaHari)}) hari`,
          `b. ${tanggalPanjang(d.tanggalBerangkat)}`,
          `c. ${tanggalPanjang(d.tanggalKembali)}`,
        ]),
        new TableRow({ children: [sel([ps("8.", { align: TENGAH })], { lebar: kol[0] }), sel([pengikut], { lebar: kol[1] + kol[2], span: 2 })] }),
        baris("9.", ["Pembebanan Anggaran", "a. Instansi", "b. Akun"], ["", `a. ${set.instansi}`, `b. ${d.akun || "…"}`]),
        baris("10.", ["Keterangan lain-lain"], [d.keterangan]),
      ],
    }),
    ps("*) coret yang tidak perlu", { before: 60 }),
    ps(`Dikeluarkan di : ${set.tempatTerbit}`, { indentKiri: CM(9), before: 200 }),
    ps(`Tanggal : ${tanggalPanjang(d.tanggal)}`, { indentKiri: CM(9), after: 120 }),
    ...ttdPpk(set.ppk).map((x) => x),
  ];
}

/** Lembar II SPD: I–V (berangkat/tiba, pengesahan pejabat di tempat tujuan), VI catatan, VII perhatian. */
function lembarSpd2(set: SetSpdRecord, d: SpdRecord): (Paragraph | Table)[] {
  const setengah = Math.floor(ISI_NASKAH / 2);
  const kotak = (judul: string, isi: string[], ttd = true) => [
    ...(judul ? [ps(judul, { bold: true })] : []),
    ...isi.map((x) => ps(x)),
    ...(ttd ? [ps("Kepala/Pejabat,", { before: 60 }), p("", { after: 500 }), ps("(……………………………)"), ps("NIP")] : []),
  ];
  const baris = (kiri: Paragraph[], kanan: Paragraph[]) =>
    new TableRow({ cantSplit: true, children: [sel(kiri, { lebar: setengah }), sel(kanan, { lebar: ISI_NASKAH - setengah })] });
  return [
    new Table({
      ...lebarTetap([setengah, ISI_NASKAH - setengah]),
      borders: BINGKAI,
      rows: [
        baris([ps("")], [
          ps("I.", { bold: true }),
          ps(`Berangkat dari : ${d.tempatBerangkat} (tempat kedudukan)`),
          ps(`Ke : ${d.tempatTujuan}`),
          ps(`Pada tanggal : ${tanggalPanjang(d.tanggalBerangkat)}`),
          ...ttdPpk(set.ppk, 500),
        ]),
        baris(kotak("II.", ["Tiba di : " + d.tempatTujuan, "Pada tanggal :"]), kotak("", ["Berangkat dari : " + d.tempatTujuan, "Ke :", "Pada tanggal :"])),
        baris(kotak("III.", ["Tiba di :", "Pada tanggal :"]), kotak("", ["Berangkat dari :", "Ke :", "Pada tanggal :"])),
        baris(kotak("IV.", ["Tiba di :", "Pada tanggal :"]), kotak("", ["Berangkat dari :", "Ke :", "Pada tanggal :"])),
        baris(
          [ps("V.", { bold: true }), ps(`Tiba kembali di : ${d.tempatBerangkat} (tempat kedudukan)`), ps(`Pada tanggal : ${tanggalPanjang(d.tanggalKembali)}`)],
          [ps(PERNYATAAN_SPD, { align: J }), ...ttdPpk(set.ppk, 500)],
        ),
        new TableRow({ children: [sel([ps("VI. Catatan Lain-lain", { bold: true }), p("", { after: 400 })], { span: 2 })] }),
        new TableRow({ children: [sel([ps("VII. PERHATIAN", { bold: true }), ps(PERHATIAN_SPD, { align: J })], { span: 2 })] }),
      ],
    }),
  ];
}

/** Word SPD semua penerima satu surat tugas: per pegawai lembar I lalu lembar II. */
export async function docxSpd(set: SetSpdRecord): Promise<Buffer> {
  const halaman = { ...HALAMAN_NASKAH, margin: { ...HALAMAN_NASKAH.margin, top: CM(1), bottom: CM(1.5) } };
  return jadikan(
    set.spd.flatMap((d) => [
      { properties: { page: halaman }, children: lembarSpd1(set, d) },
      { properties: { page: halaman }, children: lembarSpd2(set, d) },
    ]),
  );
}
