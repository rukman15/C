/**
 * Materi Kompetensi Dasar PKA/PKP (modul mandiri wajib, terbitan LAN) — disalin
 * dari situs PKA/PKP balai (sites.google.com/view/bbpkapdn2, menu Materi > Self
 * Learning) dan disimpan bersama aplikasi di `static/materi/`.
 *
 * Menambah/mengganti modul: taruh PDF di static/materi/, lalu tambah baris di bawah.
 */
export type JenisMateri = "Modul" | "Bahan tayang";
export type MateriRecord = {
  judul: string;
  jenis: JenisMateri;
  berkas: string; // path publik, mis. "/materi/berpikir-kritis.pdf"
  ukuranKb: number;
  program: ("PKA" | "PKP")[];
};

export const MATERI_KOMPETENSI_DASAR: MateriRecord[] = [
  { judul: "Keterampilan Digital (Digital Skill dalam Penyusunan Kebijakan)", jenis: "Modul", berkas: "/materi/digital-skill-penyusunan-kebijakan.pdf", ukuranKb: 483, program: ["PKA", "PKP"] },
  { judul: "Resiliensi Diri (Self Resilience)", jenis: "Modul", berkas: "/materi/self-resilience-pka.pdf", ukuranKb: 563, program: ["PKA"] },
  { judul: "Resiliensi Diri (Self Resilience)", jenis: "Modul", berkas: "/materi/self-resilience-pkp.pdf", ukuranKb: 494, program: ["PKP"] },
  { judul: "Berpikir Kritis", jenis: "Modul", berkas: "/materi/berpikir-kritis.pdf", ukuranKb: 1463, program: ["PKA"] },
  { judul: "GEDSI 1 — Teori dan Konsep Dasar Pengarusutamaan Gender dan Inklusi Sosial di Sektor Publik", jenis: "Modul", berkas: "/materi/gedsi-1-teori-dan-konsep-dasar.pdf", ukuranKb: 1212, program: ["PKP"] },
  { judul: "GEDSI 2 — Institusionalisasi Kesetaraan Gender dan Inklusi Sosial di Sektor Publik", jenis: "Modul", berkas: "/materi/gedsi-2-institusionalisasi.pdf", ukuranKb: 1715, program: ["PKP"] },
  { judul: "GEDSI 3 — Kepemimpinan yang Inklusif", jenis: "Modul", berkas: "/materi/gedsi-3-kepemimpinan-inklusif.pdf", ukuranKb: 819, program: ["PKP"] },
  { judul: "Pengelolaan Konflik Kepentingan", jenis: "Modul", berkas: "/materi/pengelolaan-konflik-kepentingan.pdf", ukuranKb: 954, program: ["PKA", "PKP"] },
  { judul: "Pengelolaan Konflik Kepentingan", jenis: "Bahan tayang", berkas: "/materi/pengelolaan-konflik-kepentingan-bahan-tayang.pdf", ukuranKb: 6818, program: ["PKA", "PKP"] },
];

/** Materi untuk satu program (urutan seperti di daftar). Program lain/tanpa program -> kosong. */
export function materiProgram(jenisPelatihan: string | null | undefined): MateriRecord[] {
  if (jenisPelatihan !== "PKA" && jenisPelatihan !== "PKP") return [];
  return MATERI_KOMPETENSI_DASAR.filter((m) => m.program.includes(jenisPelatihan));
}

export function formatUkuran(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB` : `${kb} KB`;
}
