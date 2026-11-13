/**
 * Kurikulum Pelatihan Struktural Kepemimpinan: PKA dan PKP — data MURNI (tanpa
 * import), dipakai server dan halaman.
 *
 * Sumber:
 *   - KepKa LAN No. 1/K.1/PDP.07/2023 (Kurikulum)  -> agenda, mata pelatihan, sebaran JP
 *   - KepKa LAN No. 2/K.1/PDP.07/2023 (Pedoman)    -> tahapan, hari, aspek & bobot penilaian
 *
 * Kurikulum SENGAJA disimpan sebagai kode, bukan tabel database: isinya ketetapan
 * LAN yang hanya berubah kalau ada keputusan baru, tidak ada yang menyuntingnya
 * dari aplikasi, dan dengan begini tidak perlu langkah seed. Database cukup
 * menyimpan KODE-nya (`Training.jenisPelatihan`, `Training.modePelatihan`,
 * `PenugasanApproval.mataPelatihan`). Kalau LAN menerbitkan kurikulum baru,
 * tambahkan sebagai versi baru di sini — jangan mengubah kode yang sudah dipakai.
 *
 * Angka di file ini diuji di `uji/murni.test.ts` (jumlah JP per tahap = total
 * program, jumlah bobot penilaian = 100).
 */

export const VERSI_KURIKULUM = "LAN-2023";

export type Mode = "BLENDED" | "KLASIKAL" | "DISTANCE";
export type TipeTahap =
  | "KLASIKAL"
  | "MANDIRI"
  | "ELEARNING"
  | "KOMITMEN_BERSAMA"
  | "STUDI_LAPANGAN"
  | "AKTUALISASI";
export type JenisEvaluasi =
  | "AKADEMIK"
  | "PEMBELAJARAN_LAPANGAN"
  | "AKTUALISASI_RANCANGAN"
  | "AKTUALISASI_IMPLEMENTASI"
  | "SIKAP_PERILAKU";
export type Penilai =
  | "PENGAMPU"
  | "PENGUJI"
  | "PENYELENGGARA"
  | "MENTOR"
  | "COACH"
  | "PESERTA"
  | "PEMBIMBING"
  | "SISTEM";

export interface KegiatanData {
  nama: string;
  jp: number;
  jpSync?: number;
  jpAsync?: number;
  dinilai?: boolean;
}

export interface TahapData {
  nama: string;
  tipe: TipeTahap;
  jp: number;
  jpSync?: number;
  jpAsync?: number;
  hari?: number;
  hariKalender?: boolean;
  kegiatan?: KegiatanData[];
}

export interface AspekData {
  jenisEvaluasi: JenisEvaluasi;
  nama: string;
  bobot: number;
  penilai?: Penilai;
}

export interface MataPelatihanData {
  kode: string;
  nama: string;
}

export interface AgendaData {
  nama: string;
  mataPelatihan: MataPelatihanData[];
}

export interface JenjangData {
  kode: "PKA" | "PKP";
  nama: string;
  urutanJenjang: number;
  totalJp: Record<"BLENDED" | "KLASIKAL" | "DISTANCE", number>;
  totalHari: Record<"BLENDED" | "KLASIKAL" | "DISTANCE", number>;
  agenda: AgendaData[];
  mpDasar: MataPelatihanData[];
  tahap: Partial<Record<Mode, TahapData[]>>;
  aspek: Partial<Record<Mode, AspekData[]>>;
}

// ---------------------------------------------------------------------
// Aspek penilaian yang sama untuk PKA dan PKP (Pedoman BAB III.E)
// ---------------------------------------------------------------------

const akademikBlended: AspekData[] = [
  { jenisEvaluasi: "AKADEMIK", nama: "Penugasan Individu (esai isu aktual Agenda I, II, III)", bobot: 4, penilai: "PENGAMPU" },
  { jenisEvaluasi: "AKADEMIK", nama: "Quiz Smart Governance", bobot: 2, penilai: "SISTEM" },
  { jenisEvaluasi: "AKADEMIK", nama: "Penugasan Kelompok (bahan tayang dan sharing session)", bobot: 3, penilai: "PENGAMPU" },
  { jenisEvaluasi: "AKADEMIK", nama: "Evaluasi Substansi Agenda II dan III", bobot: 6, penilai: "PENGAMPU" }
];

const lapangan: AspekData[] = [
  { jenisEvaluasi: "PEMBELAJARAN_LAPANGAN", nama: "Kualitas dokumentasi lesson learnt Studi Lapangan (laporan kelompok)", bobot: 10, penilai: "PEMBIMBING" },
  { jenisEvaluasi: "PEMBELAJARAN_LAPANGAN", nama: "Kualitas lesson learnt adopsi dan adaptasi hasil Studi Lapangan (laporan individu)", bobot: 10, penilai: "PEMBIMBING" }
];

// Penilai aspek aktualisasi: Penguji (rekap Formulir 7B/7D PKA, 8B/8D PKP).
const rancangan = (aspekTahapan: string): AspekData[] => [
  { jenisEvaluasi: "AKTUALISASI_RANCANGAN", nama: "Ketepatan rencana aksi perubahan", bobot: 4, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_RANCANGAN", nama: "Terobosan inovatif", bobot: 4, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_RANCANGAN", nama: aspekTahapan, bobot: 4, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_RANCANGAN", nama: "Kejelasan peta dan pemanfaatan sumber daya organisasi", bobot: 4, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_RANCANGAN", nama: "Rencana strategi pengembangan kompetensi dalam aksi perubahan", bobot: 4, penilai: "PENGUJI" }
];

const implementasi = (aspekKepemimpinan: string): AspekData[] => [
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Capaian perubahan terhadap rencana perubahan", bobot: 5, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: aspekKepemimpinan, bobot: 5, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Kemanfaatan aksi perubahan", bobot: 6, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Keberlanjutan aksi perubahan", bobot: 3, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Pelaksanaan strategi pengembangan kompetensi dalam aksi perubahan", bobot: 5, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Keterkaitan mata pelatihan pilihan dengan aksi perubahan", bobot: 3, penilai: "PENGUJI" },
  { jenisEvaluasi: "AKTUALISASI_IMPLEMENTASI", nama: "Diseminasi dan publikasi aksi perubahan", bobot: 3, penilai: "PENGUJI" }
];

// Blended & Distance: total 15%. Klasikal: total 20%.
const sikap = (b: [number, number, number, number, number, number, number]): AspekData[] => [
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Kerja sama dan prakarsa (oleh Pengampu Materi)", bobot: b[0], penilai: "PENGAMPU" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Kerja sama, kedisiplinan, dan kepemimpinan (sosiometri oleh Peserta)", bobot: b[1], penilai: "PESERTA" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Kepemimpinan (oleh Pengampu Materi)", bobot: b[2], penilai: "PENGAMPU" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Kedisiplinan (oleh Pengampu Materi)", bobot: b[3], penilai: "PENGAMPU" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Kedisiplinan (oleh Penyelenggara)", bobot: b[4], penilai: "PENYELENGGARA" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Pengembangan potensi diri (oleh Mentor)", bobot: b[5], penilai: "MENTOR" },
  { jenisEvaluasi: "SIKAP_PERILAKU", nama: "Pengembangan potensi diri (oleh Coach)", bobot: b[6], penilai: "COACH" }
];
const sikapBlended = sikap([3, 2, 3, 2, 2, 2, 1]);
const sikapKlasikal = sikap([4, 3, 3, 3, 3, 3, 1]);

const akademikKlasikal = (agendaII: string, agendaIII: string): AspekData[] => [
  { jenisEvaluasi: "AKADEMIK", nama: `Kemampuan menganalisis konsep dalam agenda ${agendaII}`, bobot: 4, penilai: "PENGAMPU" },
  { jenisEvaluasi: "AKADEMIK", nama: `Kemampuan menganalisis konsep dalam agenda ${agendaIII}`, bobot: 4, penilai: "PENGAMPU" },
  { jenisEvaluasi: "AKADEMIK", nama: "Quiz Smart Governance", bobot: 2, penilai: "SISTEM" }
];

// ---------------------------------------------------------------------
// Tahapan blended (Kurikulum BAB III; hari dari Pedoman BAB III.C)
// ---------------------------------------------------------------------

/** Kegiatan klasikal yang menghasilkan nilai (evaluasi akademik, seminar, sosiometri, stula, sikap perilaku). */
function kegiatanDinilai(nama: string): boolean {
  return /Evaluasi Akademik|^Seminar|Sosiometri|Berbagi Pengalaman|Penilaian Sikap Perilaku/.test(nama);
}

// Kurikulum BAB III: 540 JP = 60 menit / 45 menit x 8 jam kerja x 60 hari kalender.
const KEGIATAN_AKTUALISASI: KegiatanData[] = [
  { nama: "Pelaksanaan aktualisasi di tempat kerja, e-coaching, pembelajaran asynchronous, catatan dan rancangan laporan aktualisasi", jp: 540 }
];

function tahapBlended(o: {
  agenda: [string, string, string, string];
  mpDasarMandiri: string;
  elearning: { jpSync: number; jpAsync: number; hari: number; rows: [string, number, number][] };
  klasikalI: { rows: [string, number][] };
  aksi: string; // "Kinerja Organisasi" | "Kualitas Pelayanan Publik"
}): TahapData[] {
  const [a1, a2, a3, a4] = o.agenda;
  const elJp = o.elearning.jpSync + o.elearning.jpAsync;
  const k1Jp = o.klasikalI.rows.reduce((s, r) => s + r[1], 0);
  return [
    {
      nama: "Pembelajaran Mandiri",
      tipe: "MANDIRI",
      jp: 66,
      jpAsync: 66,
      hari: 11,
      kegiatan: [
        { nama: "Kebijakan Blended Learning", jp: 3, jpAsync: 3 },
        { nama: `Pembelajaran Agenda I: ${a1}`, jp: 5, jpAsync: 5 },
        { nama: `Pembuatan Esai Isu-Isu Agenda I: ${a1}`, jp: 2, jpAsync: 2, dinilai: true },
        { nama: `Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Dasar: ${o.mpDasarMandiri}`, jp: 6, jpAsync: 6, dinilai: true },
        { nama: `Pembelajaran Agenda II: ${a2}`, jp: 8, jpAsync: 8 },
        { nama: `Pembuatan Esai Isu-Isu Agenda II: ${a2}`, jp: 2, jpAsync: 2, dinilai: true },
        { nama: `Pembelajaran Agenda III: ${a3}`, jp: 14, jpAsync: 14 },
        { nama: `Pembuatan Esai Isu-Isu Agenda III: ${a3}`, jp: 2, jpAsync: 2, dinilai: true },
        { nama: "Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Dasar: Digital Skill dalam Pembuatan Kebijakan", jp: 3, jpAsync: 3, dinilai: true },
        { nama: `Pembelajaran Agenda IV: ${a4}`, jp: 3, jpAsync: 3 },
        { nama: `Pembelajaran Mata Pelatihan Pilihan Penunjang ${a4}`, jp: 12, jpAsync: 12 },
        { nama: "Pemetaan Sikap Perilaku Kepemimpinan dan Pengembangan Potensi Diri", jp: 6, jpAsync: 6 }
      ]
    },
    {
      nama: "E-Learning",
      tipe: "ELEARNING",
      jp: elJp,
      jpSync: o.elearning.jpSync,
      jpAsync: o.elearning.jpAsync,
      hari: o.elearning.hari,
      kegiatan: o.elearning.rows.map(([nama, jpAsync, jpSync]) => ({
        nama,
        jp: jpAsync + jpSync,
        jpAsync,
        jpSync
      }))
    },
    {
      nama: "Pembangunan Komitmen Bersama",
      tipe: "KOMITMEN_BERSAMA",
      jp: 27,
      hari: 3,
      hariKalender: true,
      kegiatan: [{ nama: "Diagnosa permasalahan dan membangun komitmen dengan stakeholders di instansi asal", jp: 27 }]
    },
    {
      nama: "Pembelajaran Klasikal Tahap I",
      tipe: "KLASIKAL",
      jp: k1Jp,
      hari: 15,
      kegiatan: o.klasikalI.rows.map(([nama, jp]) => ({ nama, jp, dinilai: kegiatanDinilai(nama) }))
    },
    {
      nama: `Aktualisasi ${a4.replace("Aktualisasi ", "")}`,
      tipe: "AKTUALISASI",
      jp: 540,
      hari: 60,
      hariKalender: true,
      kegiatan: KEGIATAN_AKTUALISASI
    },
    {
      nama: "Pembelajaran Klasikal Tahap II",
      tipe: "KLASIKAL",
      jp: 22,
      hari: 3,
      kegiatan: [
        { nama: `Pembimbingan Aksi Perubahan ${o.aksi}`, jp: 9 },
        { nama: `Seminar Aksi Perubahan ${o.aksi}`, jp: 10, dinilai: true },
        { nama: "Ceramah Kebijakan dan Tindak Lanjut Hasil Pelatihan", jp: 3 },
        { nama: "Penutupan", jp: 0 }
      ]
    }
  ];
}

// ---------------------------------------------------------------------
// Tahapan distance learning (Pedoman BAB III.C.3, keadaan darurat/tertentu).
// Enam tahap: mandiri, e-learning I (sinkron + asinkron), komitmen bersama,
// e-learning II, aktualisasi, e-learning III. Pedoman tidak merinci sebaran
// kegiatan maupun pembagian sinkron/asinkron untuk e-learning II dan III.
// ---------------------------------------------------------------------

function tahapDistance(o: {
  aktualisasi: string;
  mandiriHari: number;
  el1: { jpSync: number; jpAsync: number; hari: number };
  el2: { jp: number; hari: number };
  el3: { jp: number; hari: number };
}): TahapData[] {
  return [
    { nama: "Pembelajaran Mandiri", tipe: "MANDIRI", jp: 66, jpAsync: 66, hari: o.mandiriHari },
    {
      nama: "E-Learning Tahap I",
      tipe: "ELEARNING",
      jp: o.el1.jpSync + o.el1.jpAsync,
      jpSync: o.el1.jpSync,
      jpAsync: o.el1.jpAsync,
      hari: o.el1.hari
    },
    { nama: "Pembangunan Komitmen Bersama", tipe: "KOMITMEN_BERSAMA", jp: 27, hari: 3, hariKalender: true },
    { nama: "E-Learning Tahap II", tipe: "ELEARNING", jp: o.el2.jp, hari: o.el2.hari },
    { nama: o.aktualisasi, tipe: "AKTUALISASI", jp: 540, hari: 60, hariKalender: true },
    { nama: "E-Learning Tahap III", tipe: "ELEARNING", jp: o.el3.jp, hari: o.el3.hari }
  ];
}

// ---------------------------------------------------------------------
// Tahapan klasikal (Kurikulum BAB III bagian "Klasikal"; hari dari Pedoman BAB III.C)
// Klasikal I = pembelajaran kelas + e-learning mandiri (dikerjakan peserta di luar
// sesi kelas, paling lambat sebelum Klasikal II). Baris kegiatan: [nama, JP kelas]
// atau [nama, 0, JP e-learning].
// ---------------------------------------------------------------------

function tahapKlasikal(o: {
  hari: number;
  aktualisasi: string;
  klasikalI: [string, number, number?][];
  klasikalII: [string, number][];
}): TahapData[] {
  const jpKelas = o.klasikalI.reduce((s, r) => s + r[1], 0);
  const jpEl = o.klasikalI.reduce((s, r) => s + (r[2] ?? 0), 0);
  return [
    {
      nama: "Pelatihan Klasikal Tahap I",
      tipe: "KLASIKAL",
      jp: jpKelas + jpEl,
      jpAsync: jpEl,
      hari: o.hari,
      kegiatan: o.klasikalI.map(([nama, kelas, el]) =>
        el ? { nama, jp: el, jpAsync: el, dinilai: kegiatanDinilai(nama) } : { nama, jp: kelas, dinilai: kegiatanDinilai(nama) }
      )
    },
    { nama: o.aktualisasi, tipe: "AKTUALISASI", jp: 540, hari: 60, hariKalender: true, kegiatan: KEGIATAN_AKTUALISASI },
    {
      nama: "Pelatihan Klasikal Tahap II",
      tipe: "KLASIKAL",
      jp: o.klasikalII.reduce((s, r) => s + r[1], 0),
      hari: 3,
      kegiatan: o.klasikalII.map(([nama, jp]) => ({ nama, jp, dinilai: kegiatanDinilai(nama) }))
    }
  ];
}

// ---------------------------------------------------------------------
// PKA
// ---------------------------------------------------------------------

const PKA: JenjangData = {
  kode: "PKA",
  nama: "Pelatihan Kepemimpinan Administrator",
  urutanJenjang: 2,
  totalJp: { BLENDED: 908, KLASIKAL: 818, DISTANCE: 908 },
  totalHari: { BLENDED: 105, KLASIKAL: 91, DISTANCE: 105 },
  agenda: [
    {
      nama: "Kepemimpinan Pancasila dan Nasionalisme",
      mataPelatihan: [
        { kode: "PKA-A1-01", nama: "Wawasan Kebangsaan Kepemimpinan Pancasila dan Integritas" },
        { kode: "PKA-A1-02", nama: "Bela Negara Kepemimpinan Pancasila" }
      ]
    },
    {
      nama: "Kepemimpinan Kinerja",
      mataPelatihan: [
        { kode: "PKA-A2-01", nama: "Kepemimpinan Transformasional" },
        { kode: "PKA-A2-02", nama: "Jejaring Kerja" },
        { kode: "PKA-A2-03", nama: "Strategi Komunikasi Organisasi Sektor Publik" },
        { kode: "PKA-A2-04", nama: "Manajemen Perubahan Sektor Publik" }
      ]
    },
    {
      nama: "Manajemen Kinerja",
      mataPelatihan: [
        { kode: "PKA-A3-01", nama: "Akuntabilitas Kinerja" },
        { kode: "PKA-A3-02", nama: "Hubungan Kelembagaan" },
        { kode: "PKA-A3-03", nama: "Organisasi Digital" },
        { kode: "PKA-A3-04", nama: "Manajemen Kinerja" },
        { kode: "PKA-A3-05", nama: "Standar Kinerja Pelayanan" },
        { kode: "PKA-A3-06", nama: "Manajemen Keuangan Negara" },
        { kode: "PKA-A3-07", nama: "Manajemen Risiko" }
      ]
    },
    {
      nama: "Aktualisasi Kepemimpinan Kinerja",
      mataPelatihan: [
        { kode: "PKA-A4-01", nama: "Studi Lapangan Kinerja Organisasi" },
        { kode: "PKA-A4-02", nama: "Aksi Perubahan Kinerja Organisasi" }
      ]
    }
  ],
  mpDasar: [
    { kode: "PKA-DASAR-RESILIENSI", nama: "Resiliensi Diri (Self Resilience)" },
    { kode: "PKA-DASAR-BERPIKIR-KRITIS", nama: "Berpikir Kritis" },
    { kode: "PKA-DASAR-DIGITAL", nama: "Keterampilan Digital (Digital Skill) dalam Penyusunan Kebijakan" }
  ],
  tahap: {
    DISTANCE: tahapDistance({
      aktualisasi: "Aktualisasi Kepemimpinan Kinerja",
      mandiriHari: 11,
      el1: { jpSync: 32, jpAsync: 72, hari: 13 },
      el2: { jp: 149, hari: 15 },
      el3: { jp: 22, hari: 3 }
    }),
    BLENDED: tahapBlended({
      agenda: [
        "Kepemimpinan Pancasila dan Nasionalisme",
        "Kepemimpinan Kinerja",
        "Manajemen Kinerja",
        "Aktualisasi Kepemimpinan Kinerja Organisasi"
      ],
      mpDasarMandiri: "Self Resilience dan Berpikir Kritis",
      elearning: {
        jpSync: 32,
        jpAsync: 72,
        hari: 13,
        rows: [
          ["Overview Kebijakan Pelatihan & Penjelasan Pemetaan Sikap Perilaku Kepemimpinan dan Strategi Pengembangan Potensi Diri", 0, 2],
          ["Agenda I: Kepemimpinan Pancasila dan Nasionalisme", 10, 4],
          ["Agenda II: Kepemimpinan Kinerja", 18, 6],
          ["Agenda III: Manajemen Kinerja", 20, 9],
          ["Agenda IV: Aktualisasi Kepemimpinan Kinerja", 24, 11]
        ]
      },
      klasikalI: {
        rows: [
          ["Pembukaan", 0],
          ["Ceramah Isu Strategis dan Kepemimpinan Kinerja Organisasi", 3],
          ["Dinamika Kelompok", 3],
          ["Ceramah Wawasan Kebangsaan Kepemimpinan Pancasila dan Integritas", 3],
          ["Overview Kebijakan Pelatihan & Pengecekan Kegiatan Pemetaan Sikap Perilaku Kepemimpinan dan Strategi Pengembangan Potensi Diri", 1],
          ["Pembelajaran Agenda I: Kepemimpinan Pancasila dan Nasionalisme", 12],
          ["Ceramah Manajemen Perubahan Sektor Publik", 3],
          ["Pembelajaran Agenda II: Kepemimpinan Kinerja", 21],
          ["Ceramah Manajemen Kinerja", 3],
          ["Pembelajaran Agenda III: Manajemen Kinerja", 33],
          ["Pembekalan Studi Lapangan Kinerja Organisasi", 3],
          ["Studi Lapangan Kinerja Organisasi", 22],
          ["Berbagi Pengalaman Hasil Studi Lapangan Kinerja Organisasi", 9],
          ["Ceramah Studi Lapangan Kinerja Organisasi", 2],
          ["Penyusunan Rancangan Aksi Perubahan Kinerja Organisasi (Mandiri)", 6],
          ["Evaluasi Akademik", 3],
          ["Pembimbingan Merancang Aksi Perubahan Kinerja Organisasi", 9],
          ["Pembekalan Implementasi Aksi Perubahan Kinerja Organisasi", 3],
          ["Seminar Rancangan Aksi Perubahan Kinerja Organisasi", 10],
          ["Sosiometri", 0]
        ]
      },
      aksi: "Kinerja Organisasi"
    }),
    KLASIKAL: tahapKlasikal({
      hari: 28,
      aktualisasi: "Aktualisasi Kepemimpinan Kinerja",
      klasikalI: [
        ["Pembukaan", 0],
        ["Ceramah Isu Strategis dan Kepemimpinan Kinerja Organisasi", 3],
        ["Overview Kebijakan Pelatihan", 3],
        ["Dinamika Kelompok", 3],
        ["Ceramah Wawasan Kebangsaan Kepemimpinan Pancasila dan Integritas", 3],
        ["Pembelajaran Agenda I Kepemimpinan Pancasila dan Nasionalisme: Wawasan Kebangsaan Kepemimpinan Pancasila dan Integritas", 9],
        ["Pemetaan Sikap Perilaku Kepemimpinan dan Strategi Pengembangan Potensi Diri", 6],
        ["Pembelajaran Agenda I Kepemimpinan Pancasila dan Nasionalisme: Bela Negara Kepemimpinan Pancasila", 18],
        ["Konsepsi Pembelajaran Aksi Perubahan Kinerja Organisasi", 3],
        ["Pembelajaran Agenda II Kepemimpinan Kinerja: Kepemimpinan Transformasional", 9],
        ["Pembelajaran Agenda II Kepemimpinan Kinerja: Jejaring Kerja", 9],
        ["Pembelajaran Agenda II Kepemimpinan Kinerja: Strategi Komunikasi Organisasi Sektor Publik", 9],
        ["Pembelajaran Agenda II Kepemimpinan Kinerja: Manajemen Perubahan Sektor Publik", 9],
        ["Pembelajaran Agenda III Manajemen Kinerja: Akuntabilitas Kinerja", 9],
        ["Pembelajaran Agenda III Manajemen Kinerja: Hubungan Kelembagaan", 9],
        ["Pembelajaran Agenda III Manajemen Kinerja: Organisasi Digital", 9],
        ["Ceramah Manajemen Kinerja", 3],
        ["Pembelajaran Agenda III Manajemen Kinerja: Manajemen Kinerja", 12],
        ["Pembekalan Studi Lapangan Kinerja Organisasi", 3],
        ["Pembelajaran Agenda III Manajemen Kinerja: Standar Kinerja Pelayanan", 9],
        ["Pembelajaran Agenda III Manajemen Kinerja: Manajemen Keuangan Negara", 9],
        ["Pembelajaran Agenda III Manajemen Kinerja: Manajemen Risiko", 9],
        ["Ceramah Studi Lapangan Kinerja Organisasi", 2],
        ["Studi Lapangan Kinerja Organisasi", 22],
        ["Berbagi Pengalaman Hasil Studi Lapangan Kinerja Organisasi", 6],
        ["Merancang Aksi Perubahan Kinerja Organisasi", 15],
        ["Pembimbingan Aksi Perubahan Kinerja Organisasi", 18],
        ["Seminar Rancangan Aksi Perubahan Kinerja Organisasi", 10],
        ["Evaluasi Akademik", 3],
        ["Pembekalan Implementasi Aksi Perubahan Kinerja Organisasi", 3],
        ["Sosiometri", 0],
        ["Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Dasar Self Resilience dan Berpikir Kritis", 0, 6],
        ["Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Digital Skill dalam Pembuatan Kebijakan", 0, 3],
        ["Pembelajaran Penunjang Aktualisasi Kepemimpinan Kinerja Organisasi", 0, 12]
      ],
      klasikalII: [
        ["Pembimbingan Aksi Perubahan", 9],
        ["Seminar Aksi Perubahan", 10],
        ["Ceramah Kebijakan dan Tindak Lanjut Hasil Pelatihan", 3],
        ["Penutupan", 0]
      ]
    })
  },
  aspek: {
    BLENDED: [...akademikBlended, ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian risiko"), ...implementasi("Kepemimpinan kinerja"), ...sikapBlended],
    DISTANCE: [...akademikBlended, ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian risiko"), ...implementasi("Kepemimpinan kinerja"), ...sikapBlended],
    KLASIKAL: [...akademikKlasikal("kepemimpinan kinerja", "manajemen kinerja"), ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian risiko"), ...implementasi("Kepemimpinan kinerja"), ...sikapKlasikal]
  }
};

// ---------------------------------------------------------------------
// PKP
// ---------------------------------------------------------------------

const PKP: JenjangData = {
  kode: "PKP",
  nama: "Pelatihan Kepemimpinan Pengawas",
  urutanJenjang: 1,
  totalJp: { BLENDED: 905, KLASIKAL: 851, DISTANCE: 905 },
  // Pedoman menulis 96 hari untuk klasikal, padahal rinciannya 32 + 60 + 3 = 95 (perlu konfirmasi).
  // Distance: rincian per tahap 12+12+3+15+60+3 = 105, tetapi Pedoman menulis 104 (perlu konfirmasi).
  totalHari: { BLENDED: 104, KLASIKAL: 96, DISTANCE: 104 },
  agenda: [
    {
      nama: "Kepemimpinan Pancasila dan Bela Negara",
      mataPelatihan: [
        { kode: "PKP-A1-01", nama: "Etika dan Integritas Kepemimpinan Pancasila" },
        { kode: "PKP-A1-02", nama: "Bela Negara Kepemimpinan Pancasila" }
      ]
    },
    {
      nama: "Kepemimpinan Pelayanan",
      mataPelatihan: [
        { kode: "PKP-A2-01", nama: "Diagnosa Organisasi" },
        { kode: "PKP-A2-02", nama: "Berpikir Kreatif dalam Pelayanan" },
        { kode: "PKP-A2-03", nama: "Membangun Tim Efektif di Era New Normal" },
        { kode: "PKP-A2-04", nama: "Kepemimpinan dalam Pelaksanaan Pekerjaan" }
      ]
    },
    {
      nama: "Pengendalian Pekerjaan",
      mataPelatihan: [
        { kode: "PKP-A3-01", nama: "Komunikasi dalam Pelayanan Publik" },
        { kode: "PKP-A3-02", nama: "Perencanaan Kegiatan Pelayanan Publik" },
        { kode: "PKP-A3-03", nama: "Penyusunan RKA Pelayanan Publik" },
        { kode: "PKP-A3-04", nama: "Pelayanan Publik Digital" },
        { kode: "PKP-A3-05", nama: "Manajemen Mutu" },
        { kode: "PKP-A3-06", nama: "Manajemen Pengawasan" },
        { kode: "PKP-A3-07", nama: "Pengendalian Pelaksanaan Kegiatan" }
      ]
    },
    {
      nama: "Aktualisasi Kepemimpinan Pelayanan",
      mataPelatihan: [
        { kode: "PKP-A4-01", nama: "Studi Lapangan Pelayanan Publik" },
        { kode: "PKP-A4-02", nama: "Aksi Perubahan Kualitas Pelayanan Publik" }
      ]
    }
  ],
  mpDasar: [
    { kode: "PKP-DASAR-RESILIENSI", nama: "Resiliensi Diri (Self Resilience)" },
    { kode: "PKP-DASAR-GEDSI", nama: "Gender Equality, Disability, and Social Inclusion (GEDSI)" },
    { kode: "PKP-DASAR-DIGITAL", nama: "Keterampilan Digital (Digital Skill) dalam Penyusunan Kebijakan" }
  ],
  tahap: {
    DISTANCE: tahapDistance({
      aktualisasi: "Aktualisasi Kepemimpinan Pelayanan",
      mandiriHari: 12,
      el1: { jpSync: 30, jpAsync: 66, hari: 12 },
      el2: { jp: 154, hari: 15 },
      el3: { jp: 22, hari: 3 }
    }),
    BLENDED: tahapBlended({
      agenda: [
        "Kepemimpinan Pancasila dan Bela Negara",
        "Kepemimpinan Pelayanan",
        "Pengendalian Pekerjaan",
        "Aktualisasi Kepemimpinan Pelayanan"
      ],
      mpDasarMandiri: "Self Resilience dan GEDSI",
      elearning: {
        jpSync: 30,
        jpAsync: 66,
        hari: 12,
        rows: [
          ["Overview Kebijakan Pelatihan & Penjelasan Pemetaan Sikap Perilaku Kepemimpinan dan Strategi Pengembangan Potensi Diri", 0, 2],
          ["Pembelajaran Agenda I: Kepemimpinan Pancasila dan Bela Negara", 10, 4],
          ["Pembelajaran Agenda II: Kepemimpinan Pelayanan", 14, 6],
          ["Pembelajaran Agenda III: Pengendalian Pekerjaan", 18, 9],
          ["Pembelajaran Agenda IV: Aktualisasi Kepemimpinan Pelayanan", 24, 9]
        ]
      },
      klasikalI: {
        rows: [
          ["Pembukaan", 0],
          ["Ceramah Isu Strategis dan Kepemimpinan Pelayanan Publik", 3],
          ["Ceramah Etika dan Integritas Kepemimpinan Pancasila", 3],
          ["Overview Kebijakan Pelatihan & Pengecekan Pemetaan Sikap Perilaku dan Strategi Pengembangan Potensi Diri", 1],
          ["Dinamika Kelompok", 3],
          ["Pembelajaran Agenda I: Kepemimpinan Pancasila dan Bela Negara", 12],
          ["Ceramah Berpikir Kreatif dalam Pelayanan", 3],
          ["Pembelajaran Agenda II: Kepemimpinan Pelayanan", 26],
          ["Ceramah Manajemen Mutu", 3],
          ["Pembelajaran Agenda III: Pengendalian Pekerjaan", 33],
          ["Pembekalan Studi Lapangan Pelayanan Publik", 3],
          ["Studi Lapangan Pelayanan Publik", 22],
          ["Berbagi Pengalaman Hasil Studi Lapangan Pelayanan Publik", 9],
          ["Ceramah Studi Lapangan Pelayanan Publik", 2],
          ["Evaluasi Akademik", 3],
          ["Penyusunan Rancangan Aksi Perubahan Kualitas Pelayanan Publik (Mandiri)", 6],
          ["Pembimbingan Merancang Aksi Perubahan Kualitas Pelayanan Publik", 9],
          ["Pembekalan Implementasi Aksi Perubahan Kualitas Pelayanan Publik", 3],
          ["Seminar Rancangan Aksi Perubahan Kualitas Pelayanan Publik", 10],
          ["Sosiometri", 0]
        ]
      },
      aksi: "Kualitas Pelayanan Publik"
    }),
    KLASIKAL: tahapKlasikal({
      hari: 32,
      aktualisasi: "Aktualisasi Kepemimpinan Pelayanan",
      klasikalI: [
        ["Pembukaan", 0],
        ["Ceramah Isu Strategis dan Kepemimpinan Pelayanan Publik", 3],
        ["Overview Kebijakan Pelatihan", 3],
        ["Dinamika Kelompok", 3],
        ["Ceramah Etika dan Integritas Kepemimpinan Pancasila", 3],
        ["Pembelajaran Agenda I Kepemimpinan Pancasila dan Bela Negara: Etika dan Integritas Kepemimpinan Pancasila", 9],
        ["Pemetaan Sikap Perilaku Kepemimpinan & Strategi Pengembangan Potensi Diri", 6],
        ["Pembelajaran Agenda I Kepemimpinan Pancasila dan Bela Negara: Bela Negara Kepemimpinan Pancasila", 18],
        ["Konsepsi Pembelajaran Aksi Perubahan", 3],
        ["Pembelajaran Agenda II Kepemimpinan Pelayanan: Diagnosa Organisasi", 18],
        ["Ceramah Berpikir Kreatif dalam Pelayanan", 3],
        ["Pembelajaran Agenda II Kepemimpinan Pelayanan: Berpikir Kreatif dalam Pelayanan", 15],
        ["Ceramah Membangun Tim Efektif di Era New Normal", 3],
        ["Pembelajaran Agenda II Kepemimpinan Pelayanan: Membangun Tim Efektif di Era New Normal", 15],
        ["Pembelajaran Agenda II Kepemimpinan Pelayanan: Kepemimpinan dalam Pelaksanaan Pekerjaan", 9],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Komunikasi dalam Pelayanan Publik", 9],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Perencanaan Kegiatan Pelayanan Publik", 9],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Penyusunan RKA Pelayanan Publik", 9],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Pelayanan Publik Digital", 9],
        ["Pembekalan Studi Lapangan Pelayanan Publik", 3],
        ["Ceramah Manajemen Mutu", 3],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Manajemen Mutu", 15],
        ["Ceramah Manajemen Pengawasan", 3],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Manajemen Pengawasan", 9],
        ["Pembelajaran Agenda III Pengendalian Pekerjaan: Pengendalian Pelaksanaan Kegiatan", 9],
        ["Ceramah Studi Lapangan Pelayanan Publik", 2],
        ["Studi Lapangan Pelayanan Publik", 22],
        ["Berbagi Pengalaman Hasil Studi Lapangan Pelayanan Publik", 6],
        ["Merancang Aksi Perubahan", 15],
        ["Pembimbingan Merancang Aksi Perubahan", 18],
        ["Persiapan Seminar (Mandiri)", 0],
        ["Seminar Rancangan Aksi Perubahan", 10],
        ["Evaluasi Akademik", 3],
        ["Pembekalan Implementasi Aksi Perubahan", 3],
        ["Sosiometri", 0],
        ["Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Dasar Self Resilience dan GEDSI", 0, 6],
        ["Pembelajaran dan Penilaian Sikap Perilaku Mata Pelatihan Digital Skill dalam Pembuatan Kebijakan", 0, 3],
        ["Pembelajaran Penunjang Aktualisasi Kepemimpinan Pelayanan", 0, 12]
      ],
      klasikalII: [
        ["Pembimbingan Aksi Perubahan", 9],
        ["Persiapan Seminar (Mandiri)", 0],
        ["Seminar Aksi Perubahan", 10],
        ["Ceramah Kebijakan dan Tindak Lanjut Hasil Pelatihan", 3],
        ["Penutupan", 0]
      ]
    })
  },
  aspek: {
    BLENDED: [...akademikBlended, ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian mutu pekerjaan"), ...implementasi("Kepemimpinan pelayanan"), ...sikapBlended],
    DISTANCE: [...akademikBlended, ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian mutu pekerjaan"), ...implementasi("Kepemimpinan pelayanan"), ...sikapBlended],
    KLASIKAL: [...akademikKlasikal("kepemimpinan pelayanan", "pengendalian pekerjaan"), ...lapangan, ...rancangan("Tahapan rencana perubahan dan pengendalian mutu pekerjaan"), ...implementasi("Kepemimpinan pelayanan"), ...sikapKlasikal]
  }
};

export const JENJANG: JenjangData[] = [PKP, PKA];

// Mata pelatihan pilihan yang tersedia di LMS (berlaku semua jenjang).
// Peserta wajib memilih 3, boleh dari luar LMS atas persetujuan.
export const MP_PILIHAN: MataPelatihanData[] = [
  { kode: "PILIHAN-MANAJEMEN-PEMERINTAHAN", nama: "Manajemen Pemerintahan" },
  { kode: "PILIHAN-HAM", nama: "Hak Asasi Manusia (HAM)" },
  { kode: "PILIHAN-PBJ", nama: "Pengadaan Barang dan Jasa" },
  { kode: "PILIHAN-EKONOMI-HIJAU", nama: "Pertumbuhan Ekonomi Hijau" },
  { kode: "PILIHAN-PENGAWASAN-RISIKO", nama: "Pengawasan Berbasis Risiko" }
];

// Aturan evaluasi akhir (Pedoman BAB III.E) - dipakai modul penilaian
export const KUALIFIKASI = [
  { kode: "SANGAT_MEMUASKAN", min: 90.01, max: 100 },
  { kode: "MEMUASKAN", min: 80.01, max: 90 },
  { kode: "BAIK", min: 70.01, max: 80 },
  { kode: "KURANG_BAIK", min: 60.01, max: 70 },
  { kode: "TIDAK_MEMENUHI", min: 0, max: 60 }
] as const;

export const ATURAN = {
  ketidakhadiranMaksJp: 27, // akumulatif; berlaku pada sesi sinkron & klasikal
  ketidakhadiranMaksHari: 3,
  forceMajeureMaksHari: 6, // pengecualian dengan persetujuan tertulis LAN
  remedial: {
    kesempatan: 1,
    akademikHariKerja: 14,
    implementasiHariKalender: 60,
    sikapPerilaku: false,
    nilaiMaksSetelahRemedial: 85
  },
  ikutUlangTidakLulusMaks: 1,
  jumlahPeringkatTerbaik: 3, // PKA & PKP
  timEvaluasiAkhirMinAnggota: 5 // ganjil
} as const;

// ---------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------

export type KodeJenis = JenjangData["kode"];
/** Mode yang rincian tahapannya sudah tersedia di sini. */
export type ModePelatihan = "BLENDED" | "KLASIKAL";

export const MODE_PELATIHAN: { value: ModePelatihan; label: string }[] = [
  { value: "BLENDED", label: "Blended learning" },
  { value: "KLASIKAL", label: "Klasikal" },
];

export function isKodeJenis(v: unknown): v is KodeJenis {
  return typeof v === "string" && JENJANG.some((j) => j.kode === v);
}

export function isModePelatihan(v: unknown): v is ModePelatihan {
  return v === "BLENDED" || v === "KLASIKAL";
}

export function getJenjang(kode: string | null | undefined): JenjangData | undefined {
  return kode ? JENJANG.find((j) => j.kode === kode) : undefined;
}

export function labelMode(mode: string | null | undefined): string {
  return MODE_PELATIHAN.find((m) => m.value === mode)?.label ?? "";
}

/** Tahapan pembelajaran satu program pada satu mode ([] kalau tidak dikenal). */
export function tahapKurikulum(kode: string | null | undefined, mode: string | null | undefined): TahapData[] {
  const j = getJenjang(kode);
  if (!j || !isModePelatihan(mode)) return [];
  return j.tahap[mode] ?? [];
}

/** Total JP dan hari program menurut Pedoman; null kalau program/mode tidak dikenal. */
export function ringkasanKurikulum(
  kode: string | null | undefined,
  mode: string | null | undefined,
): { totalJp: number; totalHari: number } | null {
  const j = getJenjang(kode);
  if (!j || !isModePelatihan(mode)) return null;
  return { totalJp: j.totalJp[mode], totalHari: j.totalHari[mode] };
}

/**
 * JP tatap muka (yang butuh pengajar hadir): sesi sinkron e-learning + klasikal,
 * tanpa bagian mandiri/asinkron, komitmen bersama, dan aktualisasi di tempat kerja.
 * Dipakai sebagai SARAN isian "JP dibutuhkan" pada jadwal diklat — bukan ketetapan.
 */
export function jpTatapMuka(kode: string | null | undefined, mode: string | null | undefined): number {
  return tahapKurikulum(kode, mode).reduce((jumlah, t) => {
    if (t.tipe === "ELEARNING") return jumlah + (t.jpSync ?? 0);
    if (t.tipe === "KLASIKAL") return jumlah + t.jp - (t.jpAsync ?? 0);
    return jumlah;
  }, 0);
}

const LABEL_TIPE_TAHAP: Record<TipeTahap, string> = {
  KLASIKAL: "Klasikal",
  MANDIRI: "Mandiri",
  ELEARNING: "E-learning",
  KOMITMEN_BERSAMA: "Di instansi asal",
  STUDI_LAPANGAN: "Studi lapangan",
  AKTUALISASI: "Di tempat kerja",
};

export function labelTipeTahap(tipe: TipeTahap): string {
  return LABEL_TIPE_TAHAP[tipe];
}

export type MataPelatihanPilihan = MataPelatihanData & { kelompok: string };

const ROMAWI = ["I", "II", "III", "IV", "V", "VI"];

/** Semua mata pelatihan satu program, berurutan: Agenda I–IV, dasar, lalu pilihan. */
export function daftarMataPelatihan(kode: string | null | undefined): MataPelatihanPilihan[] {
  const j = getJenjang(kode);
  if (!j) return [];
  return [
    ...j.agenda.flatMap((a, i) =>
      a.mataPelatihan.map((mp) => ({ ...mp, kelompok: `Agenda ${ROMAWI[i] ?? i + 1}: ${a.nama}` })),
    ),
    ...j.mpDasar.map((mp) => ({ ...mp, kelompok: "Mata pelatihan dasar" })),
    ...MP_PILIHAN.map((mp) => ({ ...mp, kelompok: "Mata pelatihan pilihan" })),
  ];
}

/** Nama mata pelatihan dari kodenya (di program mana pun); null kalau tidak dikenal. */
export function namaMataPelatihan(kodeMp: string | null | undefined): string | null {
  if (!kodeMp) return null;
  for (const j of JENJANG) {
    const mp = daftarMataPelatihan(j.kode).find((m) => m.kode === kodeMp);
    if (mp) return mp.nama;
  }
  return null;
}

/** true kalau `kodeMp` memang mata pelatihan program `kode`. */
export function isMataPelatihanProgram(kode: string | null | undefined, kodeMp: string): boolean {
  return daftarMataPelatihan(kode).some((m) => m.kode === kodeMp);
}

/** "Pelatihan Kepemimpinan Administrator (PKA) Angkatan IV" */
export function namaProgram(kode: string | null | undefined, angkatan?: string | null): string {
  const j = getJenjang(kode);
  if (!j) return "";
  const a = angkatan?.trim();
  return `${j.nama} (${j.kode})${a ? ` Angkatan ${a}` : ""}`;
}
