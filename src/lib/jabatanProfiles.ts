import type { DashboardProfile } from "@/lib/roles";

/**
 * PLACEHOLDER — rencana #1 (dashboard per jabatan). Lihat
 * CATATAN-PLACEHOLDER-JABATAN.md buat konteks lengkap: apa yang udah
 * diputusin, apa yang masih belum dikerjain (link users↔Pegawai,
 * integrasi permission, Tim Kerja).
 *
 * Pola di sini SENGAJA niru pola `roleProfiles` yang udah ada di
 * src/data/roles.ts (array data statis, dashboard/page.tsx yang baca
 * konfignya, komponen shell yang sama dipakai apa adanya) — bukan
 * arsitektur baru. Bedanya cuma: key lookup-nya jadi string jabatan (dari
 * kolom `jabatan` tabel Pegawai), bukan salah satu dari 8 UserRole.
 *
 * `matches` = daftar string jabatan PERSIS seperti di data pegawai (lihat
 * data/seed/pegawai.json) yang pakai profile ini. Satu profile boleh
 * dipakai banyak jabatan sekaligus — ini implementasi dari keputusan
 * diskusi soal config-sharing antar-jabatan yang mirip, jadi jumlah
 * profile TIDAK harus sama dengan jumlah jabatan (39).
 */
export type JabatanProfile = DashboardProfile & {
  /** Slug internal, cuma id React key / debugging — BUKAN dipakai buat auth. */
  id: string;
  accent: string;
  matches: string[];
};

/**
 * Samakan penulisan jabatan sebelum dicocokkan: huruf besar, tanda baca dibuang,
 * "&" = "DAN", dan singkatan umum dibentangkan ke nomenklatur Permendagri
 * 11/2025 (KASUBBAG -> KEPALA SUBBAGIAN, KABAG -> KEPALA BAGIAN, TU -> TATA USAHA,
 * SDM -> SUMBER DAYA MANUSIA). Jadi "Kasubbag SDM & Umum" dan "KEPALA SUBBAGIAN
 * SUMBER DAYA MANUSIA DAN UMUM" dianggap jabatan yang sama.
 */
const SINGKATAN: [RegExp, string][] = [
  [/\bKA\s?SUBB?AG\b/g, "KEPALA SUBBAGIAN"],
  [/\bKA\s?BAG\b/g, "KEPALA BAGIAN"],
  [/\bSUBB?AG\b/g, "SUBBAGIAN"],
  [/\bTU\b/g, "TATA USAHA"],
  [/\bSDM\b/g, "SUMBER DAYA MANUSIA"],
  [/\bBBPKA[\s-]*PDN\b/g, "BALAI BESAR PENGEMBANGAN KOMPETENSI APARATUR PEMERINTAHAN DALAM NEGERI"],
];
export function normalJabatan(value: string): string {
  let s = value.toUpperCase().replace(/&/g, " DAN ").replace(/[.,;:()/\\-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [pola, ganti] of SINGKATAN) s = s.replace(pola, ganti);
  return s.replace(/\s+/g, " ").trim();
}
const normalize = normalJabatan;

/**
 * Fallback buat jabatan yang belum eksplisit dikonfigurasi di bawah.
 * SENGAJA generic: dari 39 jabatan yang ada di data pegawai, baru 3
 * kelompok di bawah yang dapet profile spesifik (Widyaiswara, Kepegawaian
 * & SDM, Pimpinan unit) — sisanya (~30 jabatan, termasuk 46 dari 133
 * pegawai yang "Operator Layanan Operasional") jatuh ke sini dulu, sampai
 * ada kebutuhan konkret buat dipisah lebih detail. Ini jawaban langsung
 * buat "banyak dashboard atau kondisional": mayoritas jabatan cukup satu
 * fallback bareng-bareng, cuma segelintir yang butuh profile sendiri.
 */
export const DEFAULT_JABATAN_PROFILE: JabatanProfile = {
  id: "default-pegawai",
  label: "Pegawai",
  group: "Pegawai",
  description: "Dashboard umum pegawai — belum ada konfigurasi khusus buat jabatan ini.",
  destination: "Dashboard Pegawai",
  accent: "bg-[#e5ebf5]",
  matches: [],
  actions: [{ label: "Profil saya", description: "Lihat data kepegawaian", href: "#" }],
};

export const jabatanProfiles: JabatanProfile[] = [
  {
    id: "widyaiswara",
    label: "Widyaiswara",
    group: "Pegawai",
    description: "Lihat jadwal mengajar dan penugasan kelas.",
    destination: "Dashboard Widyaiswara",
    accent: "bg-[#e6f1ed]",
    matches: [
      "WIDYAISWARA AHLI PERTAMA",
      "WIDYAISWARA AHLI MUDA",
      "WIDYAISWARA AHLI MADYA",
      "WIDYAISWARA AHLI UTAMA",
    ],
    actions: [
      { label: "Jadwal mengajar", description: "Lihat agenda dan ruang kelas", href: "/dashboard/jadwal?role=widyaiswara" },
      { label: "Materi saya", description: "Kelola bahan ajar", href: "#" },
      { label: "Riwayat mengajar", description: "Lihat kelas yang telah selesai", href: "#" },
    ],
  },
  {
    id: "kepegawaian-sdm",
    label: "Kepegawaian & SDM",
    group: "Pegawai",
    description: "Kelola data pegawai, unit kerja, dan kebutuhan SDM.",
    destination: "Dashboard Kepegawaian",
    accent: "bg-[#e5ebf5]",
    matches: [
      "ANALIS SDM APARATUR AHLI PERTAMA",
      "ANALIS SDM APARATUR AHLI MUDA",
      "ANALIS SDM APARATUR AHLI MADYA",
      "ASESOR SDM APARATUR AHLI MADYA",
      "KONSELOR SDM",
    ],
    actions: [
      { label: "Pemetaan pegawai", description: "Lihat komposisi dan unit kerja", href: "/dashboard/pegawai" },
      { label: "Data Widyaiswara", description: "Kelola profil pengajar", href: "#" },
      { label: "Jadwal dan penugasan", description: "Pantau ketersediaan SDM", href: "#" },
    ],
  },
  {
    id: "pimpinan-unit",
    label: "Pimpinan unit",
    group: "Pimpinan",
    description: "Pantau ringkasan kinerja unit yang dipimpin.",
    destination: "Dashboard Pimpinan Unit",
    accent: "bg-[#f5ead7]",
    matches: [
      "KEPALA BALAI BESAR PENGEMBANGAN KOMPETENSI APARATUR PEMERINTAHAN DALAM NEGERI II",
      "KEPALA BALAI BESAR PENGEMBANGAN KOMPETENSI APARATUR PEMERINTAHAN DALAM NEGERI",
      "KEPALA BALAI BESAR",
      "KEPALA BALAI",
      // Kabag TU & para Kasubbag TIDAK lagi di sini: profil ini memuat persetujuan
      // penugasan WI yang menurut Permendagri 11/2025 kewenangan Kepala Balai.
      // Kabag TU punya profil "tata-usaha" (peran kabag-tu, lihat di bawah).
    ],
    // "Persetujuan penugasan" ditambahin di sini (bukan cuma di roleProfiles
    // kepala-balai) karena akun kepala-balai yang udah ditautkan ke pegawai
    // (session.pegawaiId, lihat CATATAN-LINK-USERS-PEGAWAI.md) render lewat
    // profile jabatan INI, bukan roleProfiles lagi — tanpa baris ini, aksi
    // approval WI nggak kepencet dari dashboard sama sekali buat akun itu.
    actions: [
      { label: "Ringkasan lembaga", description: "Lihat indikator utama", href: "/dashboard/ringkasan" },
      { label: "Laporan unit", description: "Review laporan operasional", href: "#" },
      {
        label: "Jadwal & pengampu diklat",
        description: "Lihat diklat dan Widyaiswara pengampunya",
        href: "/dashboard/jadwal",
      },
      // Sama seperti alasan "Persetujuan penugasan" di atas: akun
      // kepala-balai yang tertaut pegawai render lewat profile INI, bukan
      // roleProfiles["kepala-balai"] — tanpa baris ini, grafik beban JP WI
      // tidak kepencet sama sekali dari dashboard akun tersebut, cuma bisa
      // dicari manual lewat sidebar "Widyaiswara".
      {
        label: "Beban JP Widyaiswara",
        description: "Lihat grafik beban JP tiap WI",
        href: "/dashboard/wi",
      },
    ],
  },
  {
    id: "tata-usaha",
    label: "Kepala Bagian Tata Usaha",
    group: "Pimpinan",
    description: "Pantau layanan diklat, kepegawaian, dan kinerja balai.",
    destination: "Dashboard Kepala Bagian Tata Usaha",
    accent: "bg-[#f5ead7]",
    matches: ["KEPALA BAGIAN TATA USAHA"],
    actions: [
      { label: "Ringkasan lembaga", description: "Lihat indikator utama", href: "/dashboard/ringkasan" },
      { label: "Data pegawai", description: "Komposisi dan proyeksi pensiun", href: "/dashboard/pegawai" },
      { label: "Beban JP Widyaiswara", description: "Lihat grafik beban JP tiap WI", href: "/dashboard/wi" },
    ],
  },
];

/**
 * Cari profile buat satu jabatan (persis dari kolom `jabatan` Pegawai).
 * Jabatan yang belum eksplisit dikonfigurasi di atas jatuh ke
 * DEFAULT_JABATAN_PROFILE — bukan error, itu memang perilaku yang
 * diharapkan sampai jabatan itu butuh dashboard sendiri.
 */
export function getJabatanProfile(jabatan: string | null | undefined): JabatanProfile {
  if (!jabatan) return DEFAULT_JABATAN_PROFILE;
  const needle = normalize(jabatan);
  return (
    jabatanProfiles.find((profile) => profile.matches.some((m) => normalize(m) === needle)) ??
    DEFAULT_JABATAN_PROFILE
  );
}
