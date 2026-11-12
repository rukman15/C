/**
 * Identitas aplikasi & lembaga — SATU-SATUNYA tempat nama aplikasi ditulis. Ganti nama di sini saja;
 * semua halaman dan dokumen membaca konstanta ini. Nama database, tabel, cookie, dan folder proyek
 * sengaja tidak ikut nama aplikasi.
 */
export const NAMA_APLIKASI = "e-Balai";
// Sesuai kop surat resmi (lihat contoh surat tugas 2026).
export const NAMA_LEMBAGA = "Balai Besar Pengembangan Kompetensi Aparatur Pemerintahan Dalam Negeri II";
export const LEMBAGA_SINGKAT = "BBPKA-PDN II Jatinangor";
export const INDUK_LEMBAGA = "BPSDM Kementerian Dalam Negeri";
/** Keterangan di bawah nama aplikasi (judul halaman masuk, kaki halaman). */
export const NAMA_LENGKAP = `Sistem Informasi ${NAMA_LEMBAGA}`;

/** Kop surat resmi (surat tugas). Baris tebal lalu baris alamat. */
export const KOP_SURAT = {
  baris: [
    "KEMENTERIAN DALAM NEGERI",
    "REPUBLIK INDONESIA",
    "BADAN PENGEMBANGAN SUMBER DAYA MANUSIA",
    "BALAI BESAR PENGEMBANGAN KOMPETENSI",
    "APARATUR PEMERINTAHAN DALAM NEGERI II",
  ],
  alamat: [
    "Jalan Kiara Payung Km. 4,5 Sukasari-Sumedang, Telepon (022) 87835007, Faksimile (022) 87835008",
    "Laman https://bbpkjatinangor.kemendagri.go.id, Pos-el bbpkjatinangor@kemendagri.go.id",
  ],
  /** Logo di kiri kop (static/). */
  logo: "/brand/logo-kemendagri-kop.png",
};

/** Kota "Ditetapkan di" / tempat tanda tangan. */
export const KOTA_SURAT = "Sumedang";
/** Jabatan penanda tangan bawaan surat tugas (baris-baris). */
export const JABATAN_KEPALA = ["Kepala Balai Besar", "Pengembangan Kompetensi Aparatur", "Pemerintahan Dalam Negeri II,"];
