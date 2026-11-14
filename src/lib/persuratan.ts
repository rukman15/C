/**
 * Persuratan (naskah dinas keluar, agenda & penomoran, surat masuk & disposisi, cuti pegawai) —
 * logika MURNI, diuji di uji/murni.test.ts. Format naskah: Permendagri 18/2024 (src/lib/tata-naskah.ts).
 * Lihat CATATAN-SURAT-MENYURAT.md.
 */
import { NAMA_LEMBAGA } from "@/lib/aplikasi";
import { periodeSurat, tanggalPanjang, terbilang } from "@/lib/dokumen";
import { akhirPekanIso, isTanggalIso, tambahHariIso } from "@/lib/tanggal";

// ------------------------------------------------------------------ JENIS NASKAH

/** Bentuk tata letak (satu bentuk dipakai beberapa jenis). */
export type BentukNaskah = "surat-tugas" | "nota-dinas" | "surat-dinas" | "berita-acara" | "laporan";

export type JenisNaskah =
  | "SURAT_TUGAS"
  | "NOTA_DINAS"
  | "NOTA_USULAN"
  | "SURAT_DINAS"
  | "UNDANGAN"
  | "PANGGILAN_PESERTA"
  | "PERMOHONAN_PENGAJAR"
  | "PENGAJUAN_LAN"
  | "BERITA_ACARA"
  | "LAPORAN";

export type DefinisiJenis = {
  kode: JenisNaskah;
  label: string;
  bentuk: BentukNaskah;
  /** Wajib dikaitkan ke satu jadwal diklat (isian bawaan diambil dari data diklat). */
  diklat: boolean;
  /** Bagian acara (hari/tanggal, waktu, tempat, acara). */
  acara: boolean;
  /** Memakai daftar pegawai (penerima surat tugas / pegawai yang diusulkan). */
  pegawai?: boolean;
  keterangan: string;
};

export const JENIS_NASKAH: DefinisiJenis[] = [
  { kode: "SURAT_TUGAS", label: "Surat Tugas", bentuk: "surat-tugas", diklat: false, acara: false, pegawai: true, keterangan: "Penugasan pegawai di luar mengajar (monitoring, rapat, lomba, dll.)." },
  { kode: "NOTA_DINAS", label: "Nota Dinas", bentuk: "nota-dinas", diklat: false, acara: false, keterangan: "Komunikasi kedinasan antarpejabat di lingkungan balai." },
  { kode: "NOTA_USULAN", label: "Nota Dinas Usulan Pegawai", bentuk: "nota-dinas", diklat: true, acara: false, pegawai: true, keterangan: "Usulan pegawai yang akan ditugaskan (mis. studi lapangan per angkatan), ditandatangani Ketua Tim Diklat. Dari nota ini dibuat surat tugas." },
  { kode: "SURAT_DINAS", label: "Surat Dinas", bentuk: "surat-dinas", diklat: false, acara: false, keterangan: "Surat keluar kepada pihak di luar balai." },
  { kode: "UNDANGAN", label: "Surat Undangan", bentuk: "surat-dinas", diklat: false, acara: true, keterangan: "Undangan rapat atau kegiatan." },
  { kode: "PANGGILAN_PESERTA", label: "Surat Panggilan Peserta", bentuk: "surat-dinas", diklat: true, acara: true, keterangan: "Pemanggilan peserta diklat ke instansi asal (Formulir 2 butir I.6), dengan lampiran daftar peserta." },
  { kode: "PERMOHONAN_PENGAJAR", label: "Surat Permohonan Pengajar/Narasumber", bentuk: "surat-dinas", diklat: true, acara: true, keterangan: "Permohonan pengajar atau narasumber dari luar balai." },
  { kode: "PENGAJUAN_LAN", label: "Surat Pengajuan Penyelenggaraan ke LAN", bentuk: "surat-dinas", diklat: true, acara: false, keterangan: "Pengajuan rencana penyelenggaraan pelatihan ke LAN (Formulir 2 butir I.3)." },
  { kode: "BERITA_ACARA", label: "Berita Acara", bentuk: "berita-acara", diklat: false, acara: false, keterangan: "Berita acara kegiatan (mis. seminar aksi perubahan, penetapan kelulusan, serah terima)." },
  { kode: "LAPORAN", label: "Laporan Penyelenggaraan", bentuk: "laporan", diklat: true, acara: false, keterangan: "Laporan penyelenggaraan diklat; isi awal disusun dari data diklat." },
];

export const isJenisNaskah = (v: unknown): v is JenisNaskah => JENIS_NASKAH.some((j) => j.kode === v);
export const jenisNaskah = (kode: string): DefinisiJenis | undefined => JENIS_NASKAH.find((j) => j.kode === kode);
export const labelJenisNaskah = (kode: string) => jenisNaskah(kode)?.label ?? kode;
/** Jenis yang punya daftar pegawai (penerima surat tugas atau pegawai yang diusulkan). */
export const punyaDaftarPegawai = (kode: string) => !!jenisNaskah(kode)?.pegawai;

/** Sifat surat (isian "Sifat"). */
export const SIFAT_SURAT = ["Biasa", "Penting", "Segera", "Sangat Segera", "Rahasia"] as const;
export type SifatSurat = (typeof SIFAT_SURAT)[number];
export const isSifatSurat = (v: unknown): v is SifatSurat => (SIFAT_SURAT as readonly string[]).includes(v as string);

/** Klasifikasi keamanan (Permendagri 18/2024 Ps. 47): SR, R, T, B. */
export const KEAMANAN = [
  { kode: "B", label: "Biasa/Terbuka" },
  { kode: "T", label: "Terbatas" },
  { kode: "R", label: "Rahasia" },
  { kode: "SR", label: "Sangat Rahasia" },
] as const;
export type KodeKeamanan = (typeof KEAMANAN)[number]["kode"];
export const isKeamanan = (v: unknown): v is KodeKeamanan => KEAMANAN.some((k) => k.kode === v);

/** Rincian acara (undangan, panggilan, permohonan pengajar). */
export type AcaraNaskah = { hari: string; waktu: string; tempat: string; acara: string };

/** Satu pihak berita acara / pejabat "Mengetahui". */
export type PihakNaskah = { sebutan: string; jabatan: string; nama: string; nip: string };

/** Satu bagian laporan. */
export type BagianLaporan = { judul: string; isi: string[] };

/** Tabel lampiran (mis. daftar peserta panggilan). */
export type TabelLampiran = { judul: string; kolom: string[]; baris: string[][] };

/** Isi naskah (kolom JSON `isi`). Isian yang tidak dipakai bentuknya dibiarkan kosong. */
export type IsiNaskah = {
  paragraf: string[];
  dasar: string[];
  untuk: string[];
  acara: AcaraNaskah | null;
  pihak: PihakNaskah[];
  mengetahui: PihakNaskah | null;
  bagian: BagianLaporan[];
  lampiran: TabelLampiran | null;
};

export const isiKosong = (): IsiNaskah => ({ paragraf: [], dasar: [], untuk: [], acara: null, pihak: [], mengetahui: null, bagian: [], lampiran: null });

const teks = (v: unknown, maks: number) => (typeof v === "string" ? v.trim().slice(0, maks) : "");
const daftarTeks = (v: unknown, maks: number, jumlah: number) =>
  Array.isArray(v) ? v.map((x) => teks(x, maks)).filter((x) => x.length > 0).slice(0, jumlah) : [];

/** Rapikan isi dari JSON tersimpan/masukan: bentuk selalu lengkap, teks dipangkas, batas jumlah. */
export function rapikanIsi(v: unknown): IsiNaskah {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const acara = o.acara && typeof o.acara === "object" ? (o.acara as Record<string, unknown>) : null;
  const pihak = (x: unknown): PihakNaskah | null => {
    if (!x || typeof x !== "object") return null;
    const r = x as Record<string, unknown>;
    const h = { sebutan: teks(r.sebutan, 60), jabatan: teks(r.jabatan, 300), nama: teks(r.nama, 150), nip: teks(r.nip, 30) };
    return h.jabatan || h.nama ? h : null;
  };
  const lamp = o.lampiran && typeof o.lampiran === "object" ? (o.lampiran as Record<string, unknown>) : null;
  const kolom = lamp ? daftarTeks(lamp.kolom, 60, 8) : [];
  return {
    paragraf: daftarTeks(o.paragraf, 4000, 40),
    dasar: daftarTeks(o.dasar, 2000, 20),
    untuk: daftarTeks(o.untuk, 2000, 20),
    acara:
      acara && [acara.hari, acara.waktu, acara.tempat, acara.acara].some((x) => teks(x, 500))
        ? { hari: teks(acara.hari, 200), waktu: teks(acara.waktu, 200), tempat: teks(acara.tempat, 500), acara: teks(acara.acara, 500) }
        : null,
    pihak: Array.isArray(o.pihak) ? o.pihak.map(pihak).filter((x): x is PihakNaskah => !!x).slice(0, 6) : [],
    mengetahui: pihak(o.mengetahui),
    bagian: Array.isArray(o.bagian)
      ? o.bagian
          .map((b) => {
            const r = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
            return { judul: teks(r.judul, 200), isi: daftarTeks(r.isi, 4000, 40) };
          })
          .filter((b) => b.judul || b.isi.length)
          .slice(0, 20)
      : [],
    lampiran:
      lamp && kolom.length
        ? {
            judul: teks(lamp.judul, 200),
            kolom,
            baris: Array.isArray(lamp.baris)
              ? lamp.baris
                  .filter(Array.isArray)
                  .slice(0, 500)
                  .map((b) => kolom.map((_, i) => teks((b as unknown[])[i], 300)))
              : [],
          }
        : null,
  };
}

/** Isian wajib per bentuk. Kosong = sah. */
export function periksaIsi(jenis: JenisNaskah, isi: IsiNaskah, n: { hal: string; kepada: string[]; penerimaPegawai: number }): string[] {
  const def = jenisNaskah(jenis)!;
  const g: string[] = [];
  if (!n.hal.trim() && def.bentuk !== "surat-tugas") g.push("Hal/judul wajib diisi");
  if (def.pegawai && n.penerimaPegawai === 0) g.push(def.bentuk === "surat-tugas" ? "Pilih minimal satu pegawai yang ditugaskan" : "Pilih minimal satu pegawai yang diusulkan");
  switch (def.bentuk) {
    case "surat-tugas":
      if (!isi.untuk.length) g.push('Butir "Untuk" wajib diisi');
      break;
    case "nota-dinas":
    case "surat-dinas":
      if (!n.kepada.length) g.push("Tujuan (Yth.) wajib diisi");
      if (!isi.paragraf.length) g.push("Isi surat wajib diisi");
      if (def.acara && !isi.acara) g.push("Rincian acara (hari/tanggal, waktu, tempat, acara) wajib diisi");
      break;
    case "berita-acara":
      if (!isi.paragraf.length) g.push("Isi berita acara wajib diisi");
      if (isi.pihak.length < 1) g.push("Isi minimal satu pihak");
      break;
    case "laporan":
      if (!isi.bagian.length) g.push("Laporan wajib punya minimal satu bagian");
      break;
  }
  return g;
}

// ------------------------------------------------------------------ PENOMORAN

/** Kode unit pada nomor surat keluar balai, mis. 800.1.11.1/4203/BBPKA-PDN II. */
export const KODE_UNIT_BAWAAN = "BBPKA-PDN II";
/** Akhiran nota dinas permohonan cuti (contoh kantor: 800.1.11.2/782/kepeg). */
export const KODE_UNIT_KEPEGAWAIAN = "kepeg";

/**
 * Kode klasifikasi arsip yang TERLIHAT di contoh surat kantor (arti resmi: Lampiran Permendagri
 * 83/2022 — belum dicek). Jenis lain dibiarkan kosong untuk diisi TU.
 */
export const KODE_KLASIFIKASI_CONTOH: Record<string, string> = {
  SURAT_TUGAS: "800.1.11.1",
  CUTI_SAKIT: "800.1.11.2",
  CUTI_TAHUNAN: "800.1.11.4",
};

/** Kode klasifikasi: angka bertitik, mis. "800.1.11.1" (1–6 tingkat). */
export const isKodeKlasifikasi = (v: string) => /^\d{1,3}(\.\d{1,3}){0,5}$/.test(v.trim());

/** "800.1.11.1" + 4203 + "BBPKA-PDN II" -> "800.1.11.1/4203/BBPKA-PDN II". */
export function susunNomor(kode: string, urut: number, unit: string = KODE_UNIT_BAWAAN): string {
  return `${kode.trim()}/${urut}/${unit.trim() || KODE_UNIT_BAWAAN}`;
}

/** Sumber nomor di buku agenda surat keluar. */
export type SumberAgenda = "naskah" | "surat-tugas" | "surat-keterangan" | "cuti" | "manual";
export const SUMBER_AGENDA: SumberAgenda[] = ["naskah", "surat-tugas", "surat-keterangan", "cuti", "manual"];
export const isSumberAgenda = (v: unknown): v is SumberAgenda => (SUMBER_AGENDA as string[]).includes(v as string);

// ------------------------------------------------------------------ SURAT DINAS / UNDANGAN / DIKLAT

/** Data diklat untuk isian bawaan surat terkait diklat. */
export type DataDiklatSurat = {
  nama: string;
  mulai: string;
  selesai: string | null;
  tempat: string;
  angkatan: string | null;
  jumlahPeserta: number;
};

const kalimatPeriode = (d: DataDiklatSurat) => periodeSurat(d.mulai, d.selesai);

/** Hari + tanggal: "Senin, 20 Oktober 2026" atau "Senin s.d. Kamis, 20 s.d. 23 Oktober 2026". */
export function hariTanggal(mulai: string, selesai?: string | null): string {
  const h = (iso: string) => HARI[new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()];
  if (!selesai || selesai.slice(0, 10) === mulai.slice(0, 10)) return `${h(mulai)}, ${tanggalPanjang(mulai)}`;
  return `${h(mulai)} s.d. ${h(selesai)}, ${periodeSurat(mulai, selesai)}`;
}
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Isian bawaan per jenis naskah (bisa diubah sebelum disimpan). */
export function bawaanNaskah(
  jenis: JenisNaskah,
  d: DataDiklatSurat | null,
  peserta: { nama: string; nip: string; jabatan: string; instansi: string }[] = [],
): { hal: string; kepada: string[]; isi: IsiNaskah; sifat: SifatSurat; lampiranTeks: string } {
  const isi = isiKosong();
  const acaraDiklat = d ? { hari: hariTanggal(d.mulai, d.selesai), waktu: "08.00 WIB s.d. selesai", tempat: d.tempat, acara: d.nama } : null;
  switch (jenis) {
    case "SURAT_TUGAS":
      isi.untuk = ["", `Melaporkan hasil pelaksanaan tugas ini kepada Kepala ${NAMA_LEMBAGA}.`];
      return { hal: "", kepada: [], isi, sifat: "Biasa", lampiranTeks: "" };
    case "NOTA_DINAS":
      isi.paragraf = ["", "Demikian untuk menjadi maklum dan mohon arahan lebih lanjut."];
      return { hal: "", kepada: [], isi, sifat: "Biasa", lampiranTeks: "" };
    case "NOTA_USULAN":
      isi.paragraf = [
        d ? `Bersama ini kami usulkan pegawai berikut untuk ditugaskan mengikuti ${d.nama}${d.angkatan ? ` Angkatan ${d.angkatan}` : ""}.` : "Bersama ini kami usulkan pegawai berikut untuk ditugaskan.",
        "Demikian untuk menjadi maklum dan mohon persetujuan.",
      ];
      return { hal: d ? `Usulan Pegawai ${d.nama}${d.angkatan ? ` Angkatan ${d.angkatan}` : ""}` : "Usulan Pegawai", kepada: [`Kepala ${NAMA_LEMBAGA}`], isi, sifat: "Biasa", lampiranTeks: "" };
    case "SURAT_DINAS":
      isi.paragraf = ["", "Atas perhatian dan kerja samanya, kami ucapkan terima kasih."];
      return { hal: "", kepada: [], isi, sifat: "Biasa", lampiranTeks: "" };
    case "UNDANGAN":
      isi.paragraf = ["Dengan hormat, kami mengundang Bapak/Ibu untuk hadir pada kegiatan yang akan dilaksanakan pada:", "Mengingat pentingnya acara tersebut, kami mohon Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih."];
      isi.acara = { hari: "", waktu: "", tempat: "", acara: "" };
      return { hal: "Undangan", kepada: [], isi, sifat: "Segera", lampiranTeks: "" };
    case "PANGGILAN_PESERTA":
      isi.paragraf = [
        d
          ? `Dalam rangka pelaksanaan ${d.nama}, dengan hormat kami sampaikan bahwa pegawai di lingkungan instansi Bapak/Ibu sebagaimana tercantum dalam lampiran surat ini ditetapkan sebagai peserta, yang akan dilaksanakan pada:`
          : "Dengan hormat kami sampaikan bahwa pegawai sebagaimana tercantum dalam lampiran surat ini ditetapkan sebagai peserta pelatihan, yang akan dilaksanakan pada:",
        "Sehubungan dengan hal tersebut, kami mohon Bapak/Ibu menugaskan pegawai yang bersangkutan untuk mengikuti pelatihan sampai selesai serta melengkapi dokumen persyaratan peserta sesuai ketentuan.",
        "Atas perhatian dan kerja samanya, kami ucapkan terima kasih.",
      ];
      isi.acara = acaraDiklat;
      isi.lampiran = peserta.length
        ? { judul: "DAFTAR PESERTA", kolom: ["No.", "Nama", "NIP", "Jabatan", "Instansi"], baris: peserta.map((p, i) => [`${i + 1}.`, p.nama, p.nip || "-", p.jabatan || "-", p.instansi || "-"]) }
        : null;
      return { hal: d ? `Pemanggilan Peserta ${d.nama}` : "Pemanggilan Peserta Pelatihan", kepada: [], isi, sifat: "Segera", lampiranTeks: peserta.length ? "1 (satu) berkas" : "" };
    case "PERMOHONAN_PENGAJAR":
      isi.paragraf = [
        d
          ? `Dalam rangka pelaksanaan ${d.nama}, dengan hormat kami mohon kesediaan Bapak/Ibu untuk menjadi pengajar/narasumber, yang akan dilaksanakan pada:`
          : "Dengan hormat kami mohon kesediaan Bapak/Ibu untuk menjadi pengajar/narasumber pada kegiatan yang akan dilaksanakan pada:",
        "Konfirmasi kesediaan dapat disampaikan kepada penyelenggara. Atas perhatian dan kesediaannya, kami ucapkan terima kasih.",
      ];
      isi.acara = acaraDiklat;
      return { hal: "Permohonan Pengajar/Narasumber", kepada: [], isi, sifat: "Segera", lampiranTeks: "" };
    case "PENGAJUAN_LAN":
      isi.paragraf = [
        d
          ? `Dalam rangka pengembangan kompetensi aparatur, ${NAMA_LEMBAGA} merencanakan penyelenggaraan ${d.nama} yang akan dilaksanakan pada tanggal ${kalimatPeriode(d)} di ${d.tempat} dengan jumlah peserta ${d.jumlahPeserta} (${terbilang(d.jumlahPeserta)}) orang.`
          : `Dalam rangka pengembangan kompetensi aparatur, ${NAMA_LEMBAGA} merencanakan penyelenggaraan pelatihan sebagai berikut.`,
        "Sehubungan dengan hal tersebut, kami mengajukan rencana penyelenggaraan dimaksud untuk mendapatkan persetujuan. Bahan pendukung kami sampaikan sebagaimana terlampir.",
        "Atas perhatian dan kerja samanya, kami ucapkan terima kasih.",
      ];
      return {
        hal: d ? `Pengajuan Rencana Penyelenggaraan ${d.nama}` : "Pengajuan Rencana Penyelenggaraan Pelatihan",
        kepada: ["Kepala Lembaga Administrasi Negara"],
        isi,
        sifat: "Penting",
        lampiranTeks: "1 (satu) berkas",
      };
    case "BERITA_ACARA":
      isi.paragraf = ["", "Berita Acara ini dibuat dengan sesungguhnya dan dipergunakan sebagaimana mestinya."];
      isi.pihak = [
        { sebutan: "Pihak Pertama", jabatan: "", nama: "", nip: "" },
        { sebutan: "Pihak Kedua", jabatan: "", nama: "", nip: "" },
      ];
      return { hal: d ? `Berita Acara ${d.nama}` : "", kepada: [], isi, sifat: "Biasa", lampiranTeks: "" };
    case "LAPORAN":
      isi.bagian = kerangkaLaporan(d);
      return { hal: d ? `Laporan Penyelenggaraan ${d.nama}` : "Laporan Penyelenggaraan", kepada: [], isi, sifat: "Biasa", lampiranTeks: "" };
  }
}

/** Ringkasan data diklat untuk laporan (dihitung server dari data). */
export type RingkasanDiklat = {
  pesertaAktif: number;
  pesertaKeluar: number;
  lulus: number | null;
  tidakLulus: number | null;
  ditunda: number | null;
  sesi: number;
  jp: number;
  pengajar: string[];
  evaluasiPengajarResponden: number;
};

/** Kerangka laporan: Pendahuluan, Pelaksanaan, Hasil, Simpulan & Saran, Penutup. */
export function kerangkaLaporan(d: DataDiklatSurat | null, r?: RingkasanDiklat | null): BagianLaporan[] {
  const pelaksanaan: string[] = d
    ? [
        `${d.nama} dilaksanakan pada tanggal ${kalimatPeriode(d)} bertempat di ${d.tempat}.`,
        r ? `Pembelajaran berlangsung dalam ${r.sesi} (${terbilang(r.sesi)}) sesi dengan jumlah ${r.jp} (${terbilang(r.jp)}) JP.` : "",
        r && r.pengajar.length ? `Tenaga pengajar: ${r.pengajar.join(", ")}.` : "",
      ].filter(Boolean)
    : [""];
  const hasil: string[] = r
    ? [
        `Peserta aktif sebanyak ${r.pesertaAktif} (${terbilang(r.pesertaAktif)}) orang${r.pesertaKeluar ? `; ${r.pesertaKeluar} (${terbilang(r.pesertaKeluar)}) orang mengundurkan diri/dikeluarkan` : ""}.`,
        r.lulus !== null
          ? `Hasil evaluasi akhir: ${r.lulus} orang lulus, ${r.tidakLulus ?? 0} orang tidak lulus${r.ditunda ? `, ${r.ditunda} orang ditunda kelulusannya` : ""} (penetapan oleh Tim Evaluasi Akhir).`
          : "Hasil evaluasi akhir belum tersedia.",
        r.evaluasiPengajarResponden ? `Evaluasi tenaga pelatihan diisi oleh ${r.evaluasiPengajarResponden} responden.` : "",
      ].filter(Boolean)
    : [""];
  return [
    { judul: "PENDAHULUAN", isi: [d ? `Laporan ini disusun sebagai pertanggungjawaban pelaksanaan ${d.nama}.` : ""] },
    { judul: "PELAKSANAAN", isi: pelaksanaan },
    { judul: "HASIL YANG DICAPAI", isi: hasil },
    { judul: "SIMPULAN DAN SARAN", isi: [""] },
    { judul: "PENUTUP", isi: ["Demikian laporan ini disampaikan untuk menjadi bahan evaluasi dan perbaikan penyelenggaraan berikutnya."] },
  ];
}

// ------------------------------------------------------------------ BERITA ACARA

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "Pada hari ini, Senin, tanggal dua puluh, bulan Oktober, tahun dua ribu dua puluh enam," */
export function pembukaBeritaAcara(iso: string): string {
  const [y, b, t] = iso.slice(0, 10).split("-").map(Number);
  const hari = HARI[new Date(Date.UTC(y, b - 1, t)).getUTCDay()];
  return `Pada hari ini, ${hari}, tanggal ${terbilang(t)}, bulan ${BULAN[b - 1]}, tahun ${terbilang(y)},`;
}

// ------------------------------------------------------------------ SURAT MASUK & DISPOSISI

export const STATUS_SURAT_MASUK = ["BARU", "DIDISPOSISI", "SELESAI"] as const;
export type StatusSuratMasuk = (typeof STATUS_SURAT_MASUK)[number];
export const isStatusSuratMasuk = (v: unknown): v is StatusSuratMasuk => (STATUS_SURAT_MASUK as readonly string[]).includes(v as string);

/** Instruksi pada Lembar Disposisi (Permendagri 18/2024 Lampiran E.3.h) + yang lazim di balai. */
export const INSTRUKSI_DISPOSISI = ["Tanggapan dan Saran", "Proses lebih lanjut", "Koordinasi/konfirmasikan", "Hadiri/wakili", "Untuk diketahui", "Arsipkan"] as const;
export const isInstruksi = (v: unknown) => (INSTRUKSI_DISPOSISI as readonly string[]).includes(v as string);

export const STATUS_DISPOSISI = ["BARU", "DIBACA", "SELESAI"] as const;
export type StatusDisposisi = (typeof STATUS_DISPOSISI)[number];

/** Status surat masuk dihitung dari disposisinya: belum ada → BARU; semua selesai → SELESAI. */
export function statusSuratDariDisposisi(disposisi: { status: string }[], selesaiManual = false): StatusSuratMasuk {
  if (selesaiManual) return "SELESAI";
  if (!disposisi.length) return "BARU";
  return disposisi.every((d) => d.status === "SELESAI") ? "SELESAI" : "DIDISPOSISI";
}

/** Berkas pindaian surat masuk: PDF/JPG/PNG ≤ 5 MB. */
export const UKURAN_MAKS_SURAT_MASUK = 5 * 1024 * 1024;
export const TIPE_BERKAS_SURAT_MASUK = ["application/pdf", "image/jpeg", "image/png"];
export function periksaBerkasSuratMasuk(b: { tipe: string; ukuran: number }): string | null {
  if (!TIPE_BERKAS_SURAT_MASUK.includes(b.tipe)) return "Berkas harus PDF, JPG, atau PNG";
  if (b.ukuran <= 0) return "Berkas kosong";
  if (b.ukuran > UKURAN_MAKS_SURAT_MASUK) return "Ukuran berkas maksimal 5 MB";
  return null;
}

// ------------------------------------------------------------------ CUTI PEGAWAI

export type JenisCuti = "TAHUNAN" | "SAKIT" | "ALASAN_PENTING" | "BESAR" | "MELAHIRKAN" | "LUAR_TANGGUNGAN";
export const JENIS_CUTI: { kode: JenisCuti; label: string; kodeKlasifikasi: string }[] = [
  { kode: "TAHUNAN", label: "Cuti Tahunan", kodeKlasifikasi: KODE_KLASIFIKASI_CONTOH.CUTI_TAHUNAN },
  { kode: "SAKIT", label: "Cuti Sakit", kodeKlasifikasi: KODE_KLASIFIKASI_CONTOH.CUTI_SAKIT },
  { kode: "ALASAN_PENTING", label: "Cuti Karena Alasan Penting", kodeKlasifikasi: "" },
  { kode: "BESAR", label: "Cuti Besar", kodeKlasifikasi: "" },
  { kode: "MELAHIRKAN", label: "Cuti Melahirkan", kodeKlasifikasi: "" },
  { kode: "LUAR_TANGGUNGAN", label: "Cuti di Luar Tanggungan Negara", kodeKlasifikasi: "" },
];
export const isJenisCuti = (v: unknown): v is JenisCuti => JENIS_CUTI.some((j) => j.kode === v);
export const labelJenisCuti = (k: string) => JENIS_CUTI.find((j) => j.kode === k)?.label ?? k;

export type StatusCuti = "DIAJUKAN" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN";
export const LABEL_STATUS_CUTI: Record<StatusCuti, string> = { DIAJUKAN: "Diajukan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan" };

/** Hari kerja (Senin–Jumat) mulai..selesai inklusif. Libur nasional/cuti bersama TIDAK dikurangi. */
export function hariKerja(mulai: string, selesai: string): number {
  if (!isTanggalIso(mulai) || !isTanggalIso(selesai) || selesai < mulai) return 0;
  let n = 0;
  for (let d = mulai; d <= selesai; d = tambahHariIso(d, 1)) if (!akhirPekanIso(d)) n++;
  return n;
}

/** Dua rentang tanggal (inklusif, "YYYY-MM-DD") beririsan? */
export const beririsan = (a: { mulai: string; selesai: string }, b: { mulai: string; selesai: string }) => a.mulai <= b.selesai && b.mulai <= a.selesai;

/** Periksa pengajuan cuti. `lamaHari` boleh diubah (libur nasional), tetapi 1..hari kalender. */
export function periksaCuti(c: { jenis: string; mulai: string; selesai: string; lamaHari: number; alasan?: string | null }): string[] {
  const g: string[] = [];
  if (!isJenisCuti(c.jenis)) g.push("Jenis cuti tidak dikenal");
  if (!isTanggalIso(c.mulai) || !isTanggalIso(c.selesai)) g.push("Tanggal cuti tidak valid");
  else if (c.selesai < c.mulai) g.push("Tanggal selesai tidak boleh sebelum tanggal mulai");
  else {
    const kalender = Math.round((Date.parse(c.selesai) - Date.parse(c.mulai)) / 86_400_000) + 1;
    if (!Number.isInteger(c.lamaHari) || c.lamaHari < 1 || c.lamaHari > kalender) g.push(`Lama cuti harus 1–${kalender} hari`);
  }
  // Cuti sakit: alasan medis TIDAK disimpan (data kesehatan) — cukup "sakit".
  if (c.jenis !== "SAKIT" && !c.alasan?.trim()) g.push("Alasan cuti wajib diisi");
  return g;
}

/** Alasan yang dicetak: cuti sakit selalu "sakit" (rincian medis tidak disimpan). */
export const alasanCuti = (jenis: string, alasan: string | null | undefined) => (jenis === "SAKIT" ? "sakit" : (alasan ?? "").trim());

/**
 * Kelompok jabatan pemohon untuk kewenangan izin cuti (Permendagri 81/2018). Kepala Balai dan
 * JF ahli madya/utama izinnya dari pusat; jabatan lain di UPT dari Kepala UPT (Ps. 11 ayat 4).
 */
export type KelompokJabatanCuti = "PIMPINAN" | "AHLI_MADYA" | "LAINNYA";
export function kelompokJabatanCuti(jabatan: string | null | undefined, pimpinanUnit: boolean): KelompokJabatanCuti {
  if (pimpinanUnit) return "PIMPINAN";
  return /ahli\s+(madya|utama)/i.test(jabatan ?? "") ? "AHLI_MADYA" : "LAINNYA";
}

export type PemberiIzinCuti = {
  kode: "KEPALA_BALAI" | "KEPALA_BPSDM" | "KARO_KEPEGAWAIAN" | "SEKJEN";
  /** Jabatan pemberi izin, untuk kalimat surat. */
  jabatan: string;
  /** true = Surat Izin Cuti diterbitkan balai (ditandatangani Kepala Balai). */
  diBalai: boolean;
  dasar: string;
};

export const PEMBERI_IZIN: Record<PemberiIzinCuti["kode"], string> = {
  KEPALA_BALAI: "Kepala Balai Besar",
  KEPALA_BPSDM: "Kepala Badan Pengembangan Sumber Daya Manusia Kementerian Dalam Negeri",
  KARO_KEPEGAWAIAN: "Kepala Biro Kepegawaian Sekretariat Jenderal Kementerian Dalam Negeri",
  SEKJEN: "Sekretaris Jenderal Kementerian Dalam Negeri",
};

/**
 * Siapa yang berwenang memberi izin cuti PNS balai (Permendagri 81/2018):
 * - tahunan & sakit ≤ 14 hari kerja: Kepala UPT (Ps. 11 ayat 4); Kepala Balai & JF ahli madya → Kepala BPSDM (Ps. 7 ayat 2);
 * - sakit > 14 hari kerja s.d. 1 tahun, besar, melahirkan, alasan penting: Kepala Biro Kepegawaian (Ps. 9 huruf ee);
 *   Kepala Balai & JF ahli madya → Sekretaris Jenderal (Ps. 5 huruf s);
 * - sakit > 1 tahun dan di luar tanggungan negara: Sekretaris Jenderal (Ps. 5 huruf u & v).
 */
export function pemberiIzinCuti(c: { jenis: string; lamaHari: number; mulai: string; selesai: string }, kelompok: KelompokJabatanCuti): PemberiIzinCuti {
  const jadi = (kode: PemberiIzinCuti["kode"], dasar: string): PemberiIzinCuti => ({ kode, jabatan: PEMBERI_IZIN[kode], diBalai: kode === "KEPALA_BALAI", dasar });
  const tinggi = kelompok !== "LAINNYA";
  if (c.jenis === "LUAR_TANGGUNGAN") return jadi("SEKJEN", "Permendagri 81/2018 Ps. 5 huruf v (diusulkan kepada Kepala BKN)");
  const kalender = Math.round((Date.parse(c.selesai) - Date.parse(c.mulai)) / 86_400_000) + 1;
  if (c.jenis === "SAKIT" && kalender > 365) return jadi("SEKJEN", "Permendagri 81/2018 Ps. 5 huruf u");
  if (c.jenis === "TAHUNAN" || (c.jenis === "SAKIT" && c.lamaHari <= 14))
    return tinggi ? jadi("KEPALA_BPSDM", "Permendagri 81/2018 Ps. 7 ayat (2)") : jadi("KEPALA_BALAI", "Permendagri 81/2018 Ps. 11 ayat (4)");
  return tinggi ? jadi("SEKJEN", "Permendagri 81/2018 Ps. 5 huruf s") : jadi("KARO_KEPEGAWAIAN", "Permendagri 81/2018 Ps. 9 huruf ee");
}

export type DataCutiSurat = {
  jenis: JenisCuti;
  mulai: string;
  selesai: string;
  lamaHari: number;
  alasan: string | null;
  pegawai: { nama: string; nip: string; pangkat: string; jabatan: string; jenisKepegawaian: string };
};

/** Paragraf Nota Dinas permohonan cuti (contoh kantor, ejaan dibakukan). */
export function teksNotaDinasCuti(c: DataCutiSurat, pemberi?: PemberiIzinCuti, kepadaPemberi = false): { hal: string; paragraf: string[] } {
  const label = labelJenisCuti(c.jenis);
  const status = c.pegawai.jenisKepegawaian.trim();
  return {
    hal: `Permohonan ${label} a.n. ${c.pegawai.nama}`,
    paragraf: [
      `Permohonan ${label.toLowerCase()} a.n. ${c.pegawai.nama}${status ? `, ${status}` : ""} dari ${NAMA_LEMBAGA} dengan alasan ${alasanCuti(c.jenis, c.alasan)}, selama ${c.lamaHari} (${terbilang(c.lamaHari)}) hari kerja pada tanggal ${periodeSurat(c.mulai, c.selesai)}${c.jenis === "SAKIT" ? ", surat keterangan sakit terlampir" : ""}.`,
      ...(!pemberi || pemberi.diBalai
        ? ["Demikian untuk menjadi maklum dan mohon arahan lebih lanjut."]
        : kepadaPemberi
          ? ["Demikian untuk menjadi maklum dan mohon perkenan pemberian izin."]
          : [`Sesuai ${pemberi.dasar.replace(/ \(.*\)$/, "")}, izin ${label.toLowerCase()} tersebut diberikan oleh ${pemberi.jabatan}.`, "Demikian untuk menjadi maklum dan mohon perkenan untuk diteruskan."]),
    ],
  };
}

/** Isi Surat Izin Cuti (contoh kantor; "Ijin" → "Izin"). */
export function teksSuratIzinCuti(c: DataCutiSurat): { judul: string; pembuka: string; identitas: [string, string][]; isi: string; penutup: string } {
  const label = labelJenisCuti(c.jenis);
  return {
    judul: `SURAT IZIN ${label.toUpperCase()}`,
    pembuka: `Diberikan ${label} kepada Pegawai:`,
    identitas: [
      ["Nama", c.pegawai.nama],
      ["NIP", c.pegawai.nip || "-"],
      ["Pangkat/Gol.", c.pegawai.pangkat || "-"],
      ["Jabatan", c.pegawai.jabatan || "-"],
      ["Satuan Organisasi", NAMA_LEMBAGA],
    ],
    isi: `Selama ${c.lamaHari} (${terbilang(c.lamaHari)}) hari kerja mulai tanggal ${periodeSurat(c.mulai, c.selesai)} dengan ketentuan setelah selesai menjalankan ${label} wajib melapor kepada atasan langsung dan bekerja kembali sebagaimana biasa.`,
    penutup: `Demikian Surat Izin ${label} ini dibuat untuk dapat dipergunakan sebagaimana mestinya.`,
  };
}

/** Cuti DISETUJUI yang beririsan dengan periode diklat (untuk menolak penugasan WI). */
export function cutiBeririsan<T extends { mulai: string; selesai: string; status: string }>(cuti: T[], periode: { mulai: string; selesai: string }): T[] {
  return cuti.filter((c) => c.status === "DISETUJUI" && beririsan(c, periode));
}

/** 1 -> "I", 4 -> "IV" (judul bagian laporan). */
export function romawi(n: number): string {
  const daftar: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let sisa = Math.max(0, Math.floor(n));
  let out = "";
  for (const [v, h] of daftar) while (sisa >= v) { out += h; sisa -= v; }
  return out;
}

/** Baris "Dari" nota dinas = jabatan penanda tangan dalam satu baris, tanpa koma akhir. */
export const jabatanSatuBaris = (ttdJabatan: string | string[]) =>
  (Array.isArray(ttdJabatan) ? ttdJabatan : ttdJabatan.split("\n")).map((b) => b.trim()).filter(Boolean).join(" ").replace(/,\s*$/, "");

// ------------------------------------------------------------------ TANGGAL TUGAS (surat tugas)
// Pola contoh kantor (134 surat, Okt 2026): "selama N (terbilang) hari pada tanggal …", N = hari
// KALENDER (Sabtu/Minggu ikut dihitung), tanpa jam; satu surat bisa berisi beberapa rentang terpisah.

export type RentangTanggal = { mulai: string; selesai: string };

/** Rapikan daftar rentang: hanya tanggal sah, mulai ≤ selesai, urut, yang beririsan/bersambung digabung. */
export function rapikanRentang(v: unknown): RentangTanggal[] {
  const isi = Array.isArray(v) ? v : [];
  const sah = isi
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ mulai: String(x.mulai ?? "").slice(0, 10), selesai: String(x.selesai ?? x.mulai ?? "").slice(0, 10) }))
    .filter((r) => isTanggalIso(r.mulai) && isTanggalIso(r.selesai) && r.mulai <= r.selesai)
    .sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0))
    .slice(0, 60);
  const out: RentangTanggal[] = [];
  for (const r of sah) {
    const akhir = out[out.length - 1];
    if (akhir && r.mulai <= tambahHariIso(akhir.selesai, 1)) {
      if (r.selesai > akhir.selesai) akhir.selesai = r.selesai;
    } else out.push({ ...r });
  }
  return out;
}

/** Semua tanggal (YYYY-MM-DD) dalam daftar rentang, urut tanpa ganda. */
export function daftarHari(rentang: RentangTanggal[]): string[] {
  const s = new Set<string>();
  for (const r of rapikanRentang(rentang)) for (let d = r.mulai; d <= r.selesai; d = tambahHariIso(d, 1)) s.add(d);
  return [...s].sort();
}

/** Tanggal yang sama-sama ada di dua daftar rentang. */
export function irisanHari(a: RentangTanggal[], b: RentangTanggal[]): string[] {
  const hb = new Set(daftarHari(b));
  return daftarHari(a).filter((d) => hb.has(d));
}

/** Sabtu/Minggu di dalam rentang (untuk catatan, tidak memblokir). */
export const hariAkhirPekan = (rentang: RentangTanggal[]) => daftarHari(rentang).filter(akhirPekanIso);

const gabungDan = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`);

/** "12 s.d. 13, 15 s.d. 23 dan 26 Oktober 2026"; lintas bulan: "31 Juli s.d. 2 Agustus 2026". */
export function teksTanggalTugas(rentang: RentangTanggal[]): string {
  const rs = rapikanRentang(rentang);
  type Grup = { bulan: number; tahun: number; inti: string[] };
  const grup: Grup[] = [];
  for (const r of rs) {
    const [y1, b1, t1] = r.mulai.split("-").map(Number);
    const [y2, b2, t2] = r.selesai.split("-").map(Number);
    const inti =
      r.mulai === r.selesai
        ? `${t1}`
        : y1 === y2 && b1 === b2
          ? `${t1} s.d. ${t2}`
          : `${t1} ${BULAN[b1 - 1]}${y1 !== y2 ? ` ${y1}` : ""} s.d. ${t2}`;
    const akhir = grup[grup.length - 1];
    const lintas = !(y1 === y2 && b1 === b2);
    if (akhir && akhir.bulan === b2 && akhir.tahun === y2 && !lintas) akhir.inti.push(inti);
    else grup.push({ bulan: b2, tahun: y2, inti: [inti] });
  }
  return gabungDan(grup.map((g) => `${gabungDan(g.inti)} ${BULAN[g.bulan - 1]} ${g.tahun}`));
}

/** "selama 3 (tiga) hari pada tanggal 6 s.d. 8 Agustus 2026" (hari kalender). */
export function kalimatTanggalTugas(rentang: RentangTanggal[]): string {
  const n = daftarHari(rentang).length;
  if (!n) return "";
  return `selama ${n} (${terbilang(n)}) hari pada tanggal ${teksTanggalTugas(rentang)}`;
}

// Kalimat tanggal selalu di akhir butir: "…, [selama N (…) hari] pada tanggal … s.d. …[.;]".
const POLA_KALIMAT_TANGGAL = /,?\s*(selama\s+\d+\s*\([^)]*\)\s*hari\s*)?pada tanggal\s.*?(?=[.;]?\s*$)/i;

/** Ganti (atau tambahkan) kalimat tanggal di akhir butir "Untuk" pertama. */
export function pasangKalimatTanggal(teks: string, rentang: RentangTanggal[]): string {
  const kalimat = kalimatTanggalTugas(rentang);
  const dasar = teks.replace(POLA_KALIMAT_TANGGAL, "").trim();
  if (!kalimat) return dasar;
  const m = /([.;])\s*$/.exec(dasar);
  const inti = m ? dasar.slice(0, m.index).trimEnd() : dasar;
  return `${inti}${inti ? ", " : ""}${kalimat}${m ? m[1] : "."}`;
}

/** Butir "Untuk" tanpa kalimat tanggal (dipakai sebagai "maksud perjalanan dinas" di SPD). */
export const tanpaKalimatTanggal = (teks: string) => teks.replace(POLA_KALIMAT_TANGGAL, "").replace(/[.;]\s*$/, "").trim();

/** Dasar bawaan surat tugas perjalanan dinas (PMK 113/2012 jo. PMK 119/2023 + DIPA dari Pengaturan Dokumen). */
export function dasarPerjalananDinas(dipaTeks: string | null | undefined, tahun: number): string[] {
  const dipa = dipaTeks?.trim();
  return [
    "Peraturan Menteri Keuangan Nomor 113/PMK.05/2012 tentang Perjalanan Dinas Dalam Negeri bagi Pejabat Negara, Pegawai Negeri, dan Pegawai Tidak Tetap sebagaimana telah diubah dengan Peraturan Menteri Keuangan Nomor 119 Tahun 2023;",
    `Daftar Isian Pelaksanaan Anggaran (DIPA) ${NAMA_LEMBAGA} Tahun Anggaran ${tahun}${dipa ? ` Nomor ${dipa}` : ""};`,
  ];
}

// ------------------------------------------------------------------ BENTROK PENUGASAN

export type TingkatBentrok = "cegah" | "peringatan";

/**
 * Sesi mengajar mewajibkan hadir fisik? Dari bentuk sesi Jadwal Pembelajaran (klasikal & studi
 * lapangan = fisik; e-learning sinkron/asinkron & mandiri = tidak), atau — bila bentuknya tidak
 * diketahui (catatan sesi mengajar) — dari teks tempat/kegiatan: fisik kecuali menyebut daring/Zoom.
 */
export function hariAjarFisik(bentuk: string | null, teks: string | null): boolean {
  if (bentuk) return bentuk === "KLASIKAL" || bentuk === "LAPANGAN";
  return !/daring|zoom|online|e-?learning|virtual|google meet|webinar/i.test(teks ?? "");
}
export type BentrokItem = { jenis: "surat-tugas" | "cuti" | "penugasan-wi"; keterangan: string; tanggal: string[]; tingkat: TingkatBentrok };

/** Pesan galat untuk bentrok yang mencegah (dipakai server). */
export function pesanBentrok(nama: (id: string) => string, peta: Record<string, BentrokItem[]>): string | null {
  const baris = Object.entries(peta).flatMap(([id, xs]) =>
    xs.filter((x) => x.tingkat === "cegah").map((x) => `${nama(id)}: ${x.keterangan} (${x.tanggal.map(tanggalPanjang).join(", ")})`),
  );
  return baris.length ? `Bentrok jadwal — ${baris.join("; ")}` : null;
}

// ------------------------------------------------------------------ TEMPEL DAFTAR PEGAWAI

const rapiNama = (s: string) => s.toLowerCase().replace(/,.*$/, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Cocokkan daftar tempelan (satu orang per baris, atau dipisah koma/titik koma) ke data pegawai:
 * NIP (angka saja) dulu, lalu nama persis (tanpa gelar di belakang koma), lalu awalan nama yang unik.
 */
export function cocokkanDaftarPegawai(
  teks: string,
  pegawai: { id: string; nama: string; nip: string }[],
): { ids: string[]; tidakKetemu: string[]; ganda: string[] } {
  const baris = teks
    .split(/[\n;\t]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const tidakKetemu: string[] = [];
  const ganda: string[] = [];
  for (const b of baris) {
    const angka = b.replace(/\D/g, "");
    let calon = angka.length >= 16 ? pegawai.filter((p) => p.nip.replace(/\D/g, "") === angka) : [];
    if (!calon.length) {
      const n = rapiNama(b);
      calon = pegawai.filter((p) => rapiNama(p.nama) === n);
      if (!calon.length && n.length >= 3) calon = pegawai.filter((p) => rapiNama(p.nama).startsWith(n));
    }
    if (calon.length === 1) {
      if (!ids.includes(calon[0].id)) ids.push(calon[0].id);
    } else if (calon.length > 1) ganda.push(b);
    else tidakKetemu.push(b);
  }
  return { ids, tidakKetemu, ganda };
}

// ------------------------------------------------------------------ SPD (Surat Perjalanan Dinas)
// Format Lampiran I PMK 113/PMK.05/2012 (lembar I butir 1–10, lembar II bagian I–VII), diterbitkan PPK.
// PMK 119/2023: isi minimum SPD + Sistem Elektronik Perjalanan Dinas (di luar aplikasi ini).

export const ALAT_ANGKUT = ["Kendaraan Dinas", "Kendaraan Umum", "Pesawat Udara", "Kereta Api", "Kapal Laut"] as const;
export const TINGKAT_BIAYA = ["A", "B", "C", "D", "E", "F"] as const;

export const PERNYATAAN_SPD =
  "Telah diperiksa dengan keterangan bahwa perjalanan tersebut atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.";
export const PERHATIAN_SPD =
  "PPK yang menerbitkan SPD, pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba, serta bendahara pengeluaran bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara apabila negara menderita rugi akibat kesalahan, kelalaian, dan kealpaannya.";

export type IsianSpd = {
  tingkatBiaya: string;
  maksud: string;
  alatAngkut: string;
  tempatBerangkat: string;
  tempatTujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string;
  lamaHari: number;
  akun: string;
  keterangan: string;
};

/** Isian awal SPD dari surat tugas: maksud = butir Untuk pertama tanpa kalimat tanggal; tanggal = rentang tugas. */
export function bawaanSpd(s: { untuk: string[]; rentang: RentangTanggal[]; tempatTujuan?: string | null }, akun: string | null | undefined): IsianSpd {
  const hari = daftarHari(s.rentang);
  return {
    tingkatBiaya: "",
    maksud: tanpaKalimatTanggal(s.untuk[0] ?? ""),
    alatAngkut: "Kendaraan Umum",
    tempatBerangkat: "Sumedang",
    tempatTujuan: s.tempatTujuan?.trim() ?? "",
    tanggalBerangkat: hari[0] ?? "",
    tanggalKembali: hari[hari.length - 1] ?? "",
    lamaHari: hari.length,
    akun: akun?.trim() ?? "",
    keterangan: "",
  };
}

/** Periksa isian SPD. */
export function periksaSpd(i: IsianSpd): string[] {
  const g: string[] = [];
  if (!i.maksud.trim()) g.push("Maksud perjalanan dinas wajib diisi");
  if (!i.tempatTujuan.trim()) g.push("Tempat tujuan wajib diisi");
  if (!isTanggalIso(i.tanggalBerangkat) || !isTanggalIso(i.tanggalKembali)) g.push("Tanggal berangkat/kembali tidak valid");
  else if (i.tanggalKembali < i.tanggalBerangkat) g.push("Tanggal kembali tidak boleh sebelum tanggal berangkat");
  else {
    const kal = daftarHari([{ mulai: i.tanggalBerangkat, selesai: i.tanggalKembali }]).length;
    if (!Number.isInteger(i.lamaHari) || i.lamaHari < 1 || i.lamaHari > kal) g.push(`Lama perjalanan harus 1–${kal} hari`);
  }
  return g;
}
