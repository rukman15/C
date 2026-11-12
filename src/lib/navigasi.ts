import type { UserRole } from "@/lib/roles";

/**
 * Menu dasbor — SATU susunan untuk semua pegawai (keputusan 20 Okt 2026): Beranda · Saya · Diklat ·
 * Persuratan · Kepegawaian · Pimpinan · Pengaturan. Isi tiap kelompok mengikuti hak akun; kelompok
 * kosong tidak tampil. Hak di sini hanya untuk TAMPILAN — server tetap penjaga (requireRole,
 * akses-persuratan, aksesDiklat).
 * Logika murni — diuji di uji/murni.test.ts.
 */

export type KelompokMenu = "Saya" | "Diklat" | "Persuratan" | "Kepegawaian" | "Pimpinan" | "Pengaturan";
export const URUTAN_KELOMPOK: KelompokMenu[] = ["Saya", "Diklat", "Persuratan", "Kepegawaian", "Pimpinan", "Pengaturan"];

/** Data akun yang menentukan menu (bagian dari SessionUser). */
export type AkunMenu = {
  role: UserRole;
  pegawaiId: string | null;
  koordinatorWi: boolean;
  /** Anggota tim kerja pemegang diklat (berwenang tugaskan-wi). */
  anggotaTimDiklat: boolean;
};

export type KunciIkon =
  | "beranda"
  | "belajar"
  | "akun"
  | "profil"
  | "coaching"
  | "cuti"
  | "disposisi"
  | "evaluasi"
  | "jadwal"
  | "penugasan"
  | "bentrok"
  | "soal"
  | "registrasi"
  | "beban"
  | "aturan"
  | "dokumen"
  | "surat"
  | "agenda"
  | "masuk"
  | "spd"
  | "pegawai"
  | "plt"
  | "tim"
  | "pemetaan"
  | "ringkasan"
  | "audit"
  | "tugas";

export type ButirMenu = { href: string; label: string; ikon: KunciIkon; kelompok: KelompokMenu | null };
type Aturan = Omit<ButirMenu, "kelompok"> & { kelompok: KelompokMenu | null; boleh: (a: AkunMenu) => boolean };

const peran =
  (...r: UserRole[]) =>
  (a: AkunMenu) =>
    a.role === "admin" || r.includes(a.role);
const pegawai = (a: AkunMenu) => !!a.pegawaiId && a.role !== "admin";
const PERSURATAN: UserRole[] = ["ketua-diklat", "kepala-balai", "kabag-tu", "kepegawaian"];

export const BERANDA: ButirMenu = { href: "/dashboard", label: "Beranda", ikon: "beranda", kelompok: null };

const ATURAN: Aturan[] = [
  // --- Saya: ruang kerja pribadi
  { href: "/dashboard/belajar", label: "Diklat Saya", ikon: "belajar", kelompok: "Saya", boleh: (a) => a.role === "peserta" },
  { href: "/dashboard/profil", label: "Profil Saya", ikon: "profil", kelompok: "Saya", boleh: (a) => a.role === "peserta" && !a.pegawaiId },
  { href: "/dashboard/coaching", label: "Ruang Coaching", ikon: "coaching", kelompok: "Saya", boleh: (a) => a.role === "peserta" && !a.pegawaiId },
  { href: "/dashboard/evaluasi-saya", label: "Evaluasi Saya", ikon: "evaluasi", kelompok: "Saya", boleh: (a) => a.role === "widyaiswara" },
  // Tugas peserta yang ditinjau sebagai coach/mentor/pengampu, atau dipantau pengelola diklat (EB-038).
  { href: "/dashboard/tinjau-tugas", label: "Tinjau Tugas", ikon: "tugas", kelompok: "Saya", boleh: (a) => peran("widyaiswara", "ketua-diklat")(a) || a.anggotaTimDiklat },
  { href: "/dashboard/surat-tugas-saya", label: "Surat Tugas Saya", ikon: "surat", kelompok: "Saya", boleh: pegawai },
  // Cuti tidak diajukan di aplikasi (28 Okt 2026): surat cuti dibuat Kepegawaian/TU di tab Cuti pada Persuratan.
  {
    href: "/dashboard/persuratan/disposisi",
    label: "Disposisi untuk Saya",
    ikon: "disposisi",
    kelompok: "Saya",
    boleh: (a) => pegawai(a) || PERSURATAN.includes(a.role),
  },
  { href: "/dashboard/akun", label: "Akun & Kata Sandi", ikon: "akun", kelompok: "Saya", boleh: () => true },

  // --- Diklat
  { href: "/dashboard/jadwal", label: "Jadwal Diklat", ikon: "jadwal", kelompok: "Diklat", boleh: () => true },
  // Penugasan WI tidak lagi berhalaman sendiri (27 Okt 2026): pengampu ditetapkan di Rincian Diklat.
  { href: "/dashboard/bentrokan", label: "Cek Bentrokan", ikon: "bentrok", kelompok: "Diklat", boleh: (a) => peran("ketua-diklat", "kepala-balai")(a) || a.koordinatorWi },
  { href: "/dashboard/registrasi", label: "Registrasi Peserta", ikon: "registrasi", kelompok: "Diklat", boleh: peran("ketua-diklat") },
  { href: "/dashboard/bank-soal", label: "Bank Soal", ikon: "soal", kelompok: "Diklat", boleh: peran("ketua-diklat", "widyaiswara") },
  { href: "/dashboard/wi", label: "Beban JP Widyaiswara", ikon: "beban", kelompok: "Diklat", boleh: peran("ketua-diklat", "kepala-balai", "kabag-tu", "widyaiswara", "kepegawaian") },
  { href: "/dashboard/admin/aturan-jp", label: "Batas JP Widyaiswara", ikon: "aturan", kelompok: "Diklat", boleh: (a) => a.koordinatorWi && a.role !== "admin" },
  {
    href: "/dashboard/dokumen",
    label: "Dokumen Penugasan",
    ikon: "dokumen",
    kelompok: "Diklat",
    boleh: (a) => peran("ketua-diklat", "kepala-balai", "kabag-tu", "widyaiswara", "kepegawaian")(a) || a.anggotaTimDiklat,
  },
  {
    href: "/dashboard/coaching",
    label: "Ruang Coaching",
    ikon: "coaching",
    kelompok: "Diklat",
    boleh: (a) => peran("ketua-diklat", "widyaiswara", "kepala-balai", "kabag-tu")(a) || a.koordinatorWi || a.anggotaTimDiklat,
  },

  // --- Persuratan: SATU butir (28 Okt 2026); bagian-bagiannya (Naskah Dinas, Surat Tugas,
  // Surat Masuk, Disposisi, SPD, Cuti) lewat tab PersuratanTab. Keuangan hanya punya SPD -> langsung ke sana.
  { href: "/dashboard/persuratan", label: "Persuratan", ikon: "surat", kelompok: "Persuratan", boleh: peran(...PERSURATAN) },
  { href: "/dashboard/persuratan/spd", label: "Persuratan", ikon: "surat", kelompok: "Persuratan", boleh: (a) => a.role === "keuangan" },

  // --- Kepegawaian (cuti pegawai dikelola di tab Cuti pada Persuratan)
  { href: "/dashboard/pegawai", label: "Data Pegawai", ikon: "pegawai", kelompok: "Kepegawaian", boleh: peran("kepala-balai", "kabag-tu", "kepegawaian") },
  { href: "/dashboard/plt", label: "Plt / Plh", ikon: "plt", kelompok: "Kepegawaian", boleh: peran("kepegawaian") },
  { href: "/dashboard/tim-kerja", label: "Tim Kerja", ikon: "tim", kelompok: "Kepegawaian", boleh: peran() },
  { href: "/dashboard/admin/pegawai", label: "Kelola Pegawai", ikon: "pegawai", kelompok: "Kepegawaian", boleh: peran() },
  { href: "/dashboard/admin/pemetaan-pegawai", label: "Pemetaan Pegawai", ikon: "pemetaan", kelompok: "Kepegawaian", boleh: peran() },

  // --- Pimpinan
  { href: "/dashboard/ringkasan", label: "Ringkasan Lembaga", ikon: "ringkasan", kelompok: "Pimpinan", boleh: peran("kepala-balai", "kabag-tu") },

  // --- Pengaturan (admin)
  { href: "/dashboard/admin/akun", label: "Kelola Akun", ikon: "akun", kelompok: "Pengaturan", boleh: peran() },
  // Super Admin menunjuk Admin Penyelenggara & memilih wewenangnya (EB-034).
  { href: "/dashboard/admin/wewenang", label: "Admin Penyelenggara", ikon: "tim", kelompok: "Pengaturan", boleh: peran() },
  { href: "/dashboard/admin/aturan-jp", label: "Aturan JP", ikon: "aturan", kelompok: "Pengaturan", boleh: peran() },
  { href: "/dashboard/admin/dokumen", label: "Pengaturan Dokumen", ikon: "dokumen", kelompok: "Pengaturan", boleh: peran() },
  { href: "/dashboard/admin/audit", label: "Log Audit", ikon: "audit", kelompok: "Pengaturan", boleh: peran() },
];

/** Halaman bertab yang tidak punya butir menu sendiri — hanya untuk judul tab browser. */
const JUDUL_SUBHALAMAN: ButirMenu[] = [
  { href: "/dashboard/persuratan/surat-tugas", label: "Surat Tugas", ikon: "surat", kelompok: null },
  { href: "/dashboard/persuratan/surat-masuk", label: "Surat Masuk", ikon: "masuk", kelompok: null },
  { href: "/dashboard/persuratan/spd", label: "SPD", ikon: "spd", kelompok: null },
];

/** Semua butir (untuk judul tab browser): satu alamat bisa punya dua label menurut peran. */
export const SEMUA_BUTIR: ButirMenu[] = [BERANDA, ...JUDUL_SUBHALAMAN, ...ATURAN.map(({ boleh: _b, ...b }) => b)];

/**
 * Menu satu akun: Beranda lalu kelompok berurutan. Satu alamat hanya muncul sekali (aturan pertama
 * yang cocok menang — mis. Koordinator WI: "Batas JP Widyaiswara"; admin: "Aturan JP").
 */
export function menuAkun(a: AkunMenu): { beranda: ButirMenu; kelompok: { label: KelompokMenu; butir: ButirMenu[] }[] } {
  const dipakai = new Set<string>();
  const butir: ButirMenu[] = [];
  for (const { boleh, ...b } of ATURAN) {
    if (dipakai.has(b.href) || !boleh(a)) continue;
    dipakai.add(b.href);
    butir.push(b);
  }
  return {
    beranda: BERANDA,
    kelompok: URUTAN_KELOMPOK.map((label) => ({ label, butir: butir.filter((b) => b.kelompok === label) })).filter((k) => k.butir.length > 0),
  };
}

/**
 * Butir menu aktif di alamat `path`? Beranda aktif HANYA di /dashboard persis (supaya tidak ikut
 * menyala di sub-halaman); butir lain aktif juga di sub-halamannya. `?…` di href diabaikan.
 */
export function menuAktif(path: string, href: string): boolean {
  const h = href.split("?")[0];
  return h === "/dashboard" ? path === h : path === h || path.startsWith(h + "/");
}

/** Judul halaman dari alamat: butir dengan awalan alamat terpanjang. */
export function judulDariAlamat(path: string): string | null {
  if (path === "/dashboard") return BERANDA.label;
  const cocok = SEMUA_BUTIR.filter((n) => n.href !== "/dashboard" && (path === n.href || path.startsWith(n.href + "/"))).sort((x, y) => y.href.length - x.href.length)[0];
  return cocok?.label ?? null;
}

/**
 * Pintasan di Beranda: butir "Saya" (tanpa Akun) lalu butir kelompok kerja berurutan, paling banyak
 * `maks`. Pengaturan (admin) tidak dimasukkan.
 */
export function pintasan(menu: ReturnType<typeof menuAkun>, maks = 6): ButirMenu[] {
  const saya = menu.kelompok.find((k) => k.label === "Saya")?.butir.filter((b) => b.href !== "/dashboard/akun") ?? [];
  const kerja = menu.kelompok.filter((k) => k.label !== "Saya" && k.label !== "Pengaturan").flatMap((k) => k.butir);
  return [...saya, ...kerja].slice(0, maks);
}
