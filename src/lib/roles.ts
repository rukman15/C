export type UserRole =
  | "peserta"
  | "pamdal"
  | "keuangan"
  | "kepegawaian"
  | "ketua-diklat"
  | "widyaiswara"
  | "kepala-balai"
  | "kabag-tu"
  | "admin";

/**
 * Bentuk minimal yang dibutuhin komponen shell dashboard (Sidebar, Topbar,
 * StatusCard, ActionsGrid) — supaya komponen yang sama bisa dipakai baik
 * buat profile 8-role (RoleProfile, di bawah) maupun profile per-jabatan
 * (JabatanProfile, lihat src/data/jabatanProfiles.ts). Ini bagian dari
 * placeholder rencana #1 (dashboard per jabatan) — lihat
 * CATATAN-PLACEHOLDER-JABATAN.md.
 *
 * `href` di tiap action bersifat opsional: RoleProfile (di bawah) nggak
 * ngisinya karena masih pakai lookup terpisah `ACTION_ROUTES` di
 * DashboardActionsGrid.tsx; JabatanProfile ngisi langsung di sini.
 */
export type DashboardProfile = {
  label: string;
  group: "Peserta" | "Pegawai" | "Pimpinan" | "Admin";
  description: string;
  destination: string;
  actions: { label: string; description: string; href?: string }[];
};

export type RoleProfile = DashboardProfile & {
  id: UserRole;
  accent: string;
};

export const roleProfiles: RoleProfile[] = [
  { id: "peserta", label: "Peserta pelatihan", group: "Peserta", description: "Akses pelatihan, registrasi, LMS, dan sertifikat.", destination: "Ruang belajar peserta", accent: "bg-[#e5ebf5]", actions: [{ label: "Pelatihan saya", description: "Lihat kelas dan progres belajar" }, { label: "Jadwal dan sertifikat", description: "Pantau agenda dan riwayat kelulusan" }, { label: "Ruang LMS", description: "Lanjutkan materi pembelajaran" }] },
  { id: "pamdal", label: "Pamdal", group: "Pegawai", description: "Kelola informasi tugas dan layanan pengamanan.", destination: "Dashboard Pamdal", accent: "bg-[#f5ead7]", actions: [{ label: "Jadwal tugas", description: "Lihat pembagian jadwal jaga" }, { label: "Laporan kejadian", description: "Catat dan pantau laporan" }] },
  { id: "keuangan", label: "Pengelola keuangan", group: "Pegawai", description: "Akses ringkasan anggaran dan administrasi keuangan.", destination: "Dashboard Keuangan", accent: "bg-[#e6f1ed]", actions: [{ label: "Ringkasan anggaran", description: "Pantau realisasi dan pagu" }, { label: "Dokumen keuangan", description: "Kelola berkas administrasi" }, { label: "Laporan", description: "Susun laporan berkala" }] },
  { id: "kepegawaian", label: "Pengelola kepegawaian", group: "Pegawai", description: "Kelola data pegawai, unit kerja, dan kebutuhan SDM.", destination: "Dashboard Kepegawaian", accent: "bg-[#e5ebf5]", actions: [{ label: "Pemetaan pegawai", description: "Lihat komposisi dan unit kerja" }, { label: "Data Widyaiswara", description: "Kelola profil pengajar" }, { label: "Jadwal dan penugasan", description: "Pantau ketersediaan SDM" }] },
  { id: "ketua-diklat", label: "Ketua tim diklat", group: "Pegawai", description: "Atur program, jadwal kelas, dan penugasan Widyaiswara.", destination: "Dashboard Ketua Tim Diklat", accent: "bg-[#dfecc1]", actions: [{ label: "Atur jadwal diklat", description: "Susun kalender kelas" }, { label: "Tugaskan Widyaiswara", description: "Petakan pengajar ke kelas" }, { label: "Cek bentrokan", description: "Pastikan jadwal tidak bertabrakan" }, { label: "Beban JP Widyaiswara", description: "Lihat grafik beban JP tiap WI" }] },
  { id: "widyaiswara", label: "Widyaiswara", group: "Pegawai", description: "Lihat jadwal mengajar dan penugasan kelas.", destination: "Dashboard Widyaiswara", accent: "bg-[#e6f1ed]", actions: [{ label: "Jadwal mengajar", description: "Lihat agenda dan ruang kelas" }, { label: "Materi saya", description: "Kelola bahan ajar" }, { label: "Riwayat mengajar", description: "Lihat kelas yang telah selesai" }] },
  { id: "kepala-balai", label: "Kepala balai", group: "Pimpinan", description: "Pantau ringkasan kinerja seluruh layanan BBPKA.", destination: "Dashboard Kepala Balai", accent: "bg-[#f5ead7]", actions: [{ label: "Ringkasan lembaga", description: "Lihat indikator utama" }, { label: "Kinerja pelatihan", description: "Pantau program dan peserta" }, { label: "Laporan unit", description: "Review laporan operasional" }, { label: "Persetujuan penugasan", description: "Tinjau pengajuan Widyaiswara dari Ketua Diklat" }, { label: "Beban JP Widyaiswara", description: "Lihat grafik beban JP tiap WI" }] },
  { id: "kabag-tu", label: "Kepala Bagian Tata Usaha", group: "Pimpinan", description: "Pantau layanan, kepegawaian, dan kinerja balai (lihat saja — persetujuan tetap di Kepala Balai).", destination: "Dashboard Kepala Bagian Tata Usaha", accent: "bg-[#f5ead7]", actions: [{ label: "Ringkasan lembaga", description: "Lihat indikator utama" }, { label: "Data pegawai", description: "Komposisi dan proyeksi pensiun" }, { label: "Beban JP Widyaiswara", description: "Lihat grafik beban JP tiap WI" }] },
  { id: "admin", label: "Administrator sistem", group: "Admin", description: "Kelola pengguna, role, permission, dan konfigurasi aplikasi.", destination: "Dashboard Administrator", accent: "bg-[#dbe5f2]", actions: [{ label: "Kelola pengguna", description: "Atur akun dan status akses" }, { label: "Role dan permission", description: "Tentukan kewenangan setiap akun" }, { label: "Audit aktivitas", description: "Pantau perubahan sistem" }, { label: "Kelola Tim Kerja", description: "Atur tim lintas-jabatan dan wewenangnya" }, { label: "Kelola Pegawai", description: "Lihat dan edit data HR pegawai" }, { label: "Aturan JP", description: "Atur batas beban JP harian dan bulanan" }, { label: "Jadwal Diklat", description: "Tambah dan kelola jadwal diklat" }, { label: "Pemetaan Pegawai", description: "Atur jabatan, akses akun, dan keanggotaan tim pegawai" }] },
];
