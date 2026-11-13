/**
 * Formulir penyelenggaraan PKA/PKP dari Pedoman (KepKa LAN 2/K.1/PDP.07/2023, Anak Lampiran 1):
 *   - Formulir 1  : Pakta Integritas (diunduh peserta, ditandatangani bermaterai, diunggah lagi
 *                   sebagai berkas PAKTA_INTEGRITAS — lihat src/lib/dokumen-peserta.ts);
 *   - Formulir 2  : Daftar Pemantauan Persiapan Pelaksanaan Pelatihan (diisi penyelenggara);
 *   - Formulir 15 : Laporan Hasil Evaluasi Remedial (dari hasil penilaian).
 * Keputusan 14 Okt 2026 (D.15–16): input data & rekap di web dulu; format cetak resmi menyusul.
 * Logika MURNI — diuji di uji/murni.test.ts.
 */

export type ProgramFormulir = "PKA" | "PKP";

const NAMA_PROGRAM: Record<ProgramFormulir, string> = {
  PKA: "Pelatihan Kepemimpinan Administrator (PKA)",
  PKP: "Pelatihan Kepemimpinan Pengawas (PKP)",
};

// --- Formulir 1: Pakta Integritas ---------------------------------------------------

export type IdentitasPakta = { nama: string; nip: string; pangkatGolongan: string; jabatan: string; instansi: string };

/** Isi Formulir 1 untuk satu program; pilihan "PKN Tingkat I/II/PKA/PKP*" sudah dipilihkan. */
export function teksPaktaIntegritas(program: ProgramFormulir, id: IdentitasPakta) {
  const p = NAMA_PROGRAM[program];
  return {
    judul: "PAKTA INTEGRITAS",
    identitas: [
      ["Nama", id.nama],
      ["NIP", id.nip],
      ["Pangkat (Gol)", id.pangkatGolongan],
      ["Jabatan", id.jabatan],
      ["Instansi", id.instansi],
    ] as [string, string][],
    paragraf: [
      `dalam rangka mengikuti ${p}, dengan ini menyatakan bahwa saya akan mematuhi peraturan dan ketentuan yang berlaku selama penyelenggaraan ${p} serta tidak sedang dalam masa pelarangan mengikuti ${p}.`,
      "Apabila saya melanggar hal-hal yang telah saya nyatakan dalam Pakta Integritas ini, saya bersedia dikenakan sanksi sesuai ketentuan peraturan perundang-undangan.",
    ],
    tandaTangan: { materai: "Materai 10.000", nama: id.nama, nip: id.nip },
  };
}

// --- Formulir 2: Daftar Pemantauan Persiapan Pelaksanaan Pelatihan ------------------

export type ButirPemantauan = { kode: string; teks: string };
export type BagianPemantauan = { kode: string; judul: string; butir: ButirPemantauan[] };

const b = (prefix: string, teks: string[]): ButirPemantauan[] => teks.map((t, i) => ({ kode: `${prefix}.${i + 1}`, teks: t }));

/**
 * Butir Formulir 2 sesuai Pedoman. Untuk PKA/PKP, butir "Visitasi Kepemimpinan Nasional/
 * Benchmarking/Studi Lapangan" ditulis "Studi Lapangan" saja; "Proyek/Aksi Perubahan" →
 * "Aksi Perubahan". Kode butir stabil — jangan diubah kalau sudah ada isian tersimpan.
 */
export const FORMULIR_2: BagianPemantauan[] = [
  {
    kode: "I",
    judul: "Persiapan",
    butir: b("I", [
      "Analisis kebutuhan pelatihan",
      "Seleksi calon peserta",
      "Pengajuan rencana penyelenggaraan ke LAN",
      "Penetapan peserta",
      "Persetujuan penyelenggaraan dari LAN",
      "Pemanggilan peserta",
      "Distribusi peserta",
      "Rapat koordinasi penyelenggaraan",
      "Penyiapan fasilitas pelatihan",
      "Penetapan jadwal dan pengampu materi",
      "Rekonfirmasi pengampu materi",
      "Penyamaan persepsi (pengelola, penyelenggara, penjamin mutu, pengampu materi, coach)",
      "Persiapan pembukaan (re-checking)",
      "Administrasi keuangan",
    ]),
  },
  {
    kode: "II.A.1",
    judul: "Pelaksanaan — pemantauan harian pembelajaran klasikal",
    butir: b("II.A.1", [
      "Rekonfirmasi kesediaan mengajar",
      "Biodata pengampu materi",
      "Pendamping/pemandu",
      "Presensi",
      "Kebersihan kelas",
      "Penyiapan ruang kelas dan kelengkapan kegiatan",
      "Penyiapan ruang diskusi dan kelengkapannya",
      "Bahan ajar untuk peserta",
      "Proses pembelajaran klasikal (di kelas)",
      "Penggandaan bahan penugasan/latihan",
      "Perlengkapan kantor (ATK, komputer, fotokopi)",
      "Memo",
      "Evaluasi harian",
      "Sarana olahraga dan perlengkapannya",
    ]),
  },
  {
    kode: "II.A.2",
    judul: "Pelaksanaan — pemantauan harian e-learning sinkron",
    butir: b("II.A.2", [
      "Rekonfirmasi kesediaan mengajar",
      "Biodata pengampu materi",
      "Pendamping/pemandu",
      "Menyiapkan jaringan internet",
      "Membuka aplikasi/sistem manajemen kelas (Zoom, Google Classroom, dll.)",
      "Aplikasi/sistem manajemen kelas",
      "Evaluasi harian",
    ]),
  },
  {
    kode: "II.B",
    judul: "Pelaksanaan — kegiatan di luar ruang kelas",
    butir: b("II.B", ["Studi lapangan", "Visitasi agenda pembelajaran", "Ekstrakurikuler"]),
  },
  {
    kode: "II.C",
    judul: "Pelaksanaan — penilaian aksi perubahan",
    butir: b("II.C", ["Rekonfirmasi kesediaan penguji", "Memantau ketersediaan bahan", "Pelaksanaan", "Petugas", "Input nilai", "Rekapitulasi"]),
  },
  {
    kode: "II.D",
    judul: "Pelaksanaan — evaluasi",
    butir: b("II.D", ["Peserta", "Hasil akhir kelulusan peserta", "Tenaga pengajar", "Kinerja penyelenggara", "Umpan balik"]),
  },
  {
    kode: "II.E",
    judul: "Pelaksanaan — sertifikasi",
    butir: b("II.E", ["Input data alumni", "Pengisian STTPP", "Pemberian kode registrasi", "Penandatanganan"]),
  },
];

export const SEMUA_BUTIR_FORMULIR_2 = FORMULIR_2.flatMap((s) => s.butir);
export const isKodeButirFormulir2 = (v: unknown) => SEMUA_BUTIR_FORMULIR_2.some((x) => x.kode === v);

/** Kolom isian per butir: Jangka Waktu, Penanggung Jawab, Keterangan (Selesai/Belum). */
export type IsianPemantauan = { kode: string; jangkaWaktu?: string | null; penanggungJawab?: string | null; selesai: boolean };

export function ringkasPemantauan(isian: IsianPemantauan[]) {
  const selesai = new Set(isian.filter((x) => x.selesai).map((x) => x.kode));
  const perBagian = FORMULIR_2.map((s) => ({
    kode: s.kode,
    judul: s.judul,
    selesai: s.butir.filter((x) => selesai.has(x.kode)).length,
    total: s.butir.length,
  }));
  return {
    perBagian,
    selesai: perBagian.reduce((n, x) => n + x.selesai, 0),
    total: SEMUA_BUTIR_FORMULIR_2.length,
    /** Butir PERSIAPAN yang belum selesai — dipakai untuk peringatan sebelum diklat mulai. */
    persiapanBelum: FORMULIR_2[0].butir.filter((x) => !selesai.has(x.kode)),
  };
}

// --- Formulir 15: Laporan Hasil Evaluasi Remedial ------------------------------------

/** Satu baris tabel Formulir 15 (kolom 1–7). Sikap perilaku = konseling, bukan remedial. */
export type BarisRemedial = {
  no: number;
  jenisEvaluasi: string;
  /** "Remedial" atau "Konseling". */
  bentukTindakLanjut: string;
  waktu: string | null;
  tanggal: string | null;
  teknisPelaksanaan: string | null;
  nilai: number | null;
  catatan: string | null;
};

/**
 * Baris Formulir 15 untuk satu peserta. `evaluasi` = jenis evaluasi berkualifikasi kurang baik
 * (dari hitungan penilaian) beserta pelaksanaan remedialnya bila sudah dicatat.
 * Nilai remedial dibatasi 85,00 (Pedoman Bab III.E.2.b.4.d).
 */
export function barisFormulir15(
  evaluasi: {
    label: string;
    bisaRemedial: boolean;
    pelaksanaan?: { waktu?: string | null; tanggal?: string | null; teknis?: string | null; nilai?: number | null; catatan?: string | null } | null;
  }[],
): BarisRemedial[] {
  return evaluasi.map((e, i) => ({
    no: i + 1,
    jenisEvaluasi: e.label,
    bentukTindakLanjut: e.bisaRemedial ? "Remedial" : "Konseling",
    waktu: e.pelaksanaan?.waktu ?? null,
    tanggal: e.pelaksanaan?.tanggal ?? null,
    teknisPelaksanaan: e.pelaksanaan?.teknis ?? null,
    nilai: e.bisaRemedial && e.pelaksanaan?.nilai != null ? Math.min(e.pelaksanaan.nilai, 85) : null,
    catatan: e.pelaksanaan?.catatan ?? null,
  }));
}
