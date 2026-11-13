import { PANJANG_SANDI_MIN } from "@/lib/akun";
import { WILAYAH } from "@/lib/wilayah-data";

/**
 * Registrasi mandiri peserta (halaman publik /registrasi). Aturan isian dipakai
 * halaman (pesan per kolom) DAN server (repositories/registrasi.ts), jadi di sini
 * tanpa import server.
 *
 * Alur: daftar -> akun NONAKTIF + profil MENUNGGU -> admin/Ketua Diklat menyetujui
 * (akun aktif) atau menolak (akun & profil dihapus, boleh mendaftar ulang).
 * Masuk dengan nama pengguna, NIP, atau email.
 */

export const STATUS_REGISTRASI = ["MENUNGGU", "DISETUJUI"] as const;
export type StatusRegistrasi = (typeof STATUS_REGISTRASI)[number];

/** Pangkat/golongan ruang PNS (PP 99/2000 jo. PP 12/2002). */
export const GOLONGAN: { kode: string; pangkat: string }[] = [
  { kode: "I/a", pangkat: "Juru Muda" },
  { kode: "I/b", pangkat: "Juru Muda Tingkat I" },
  { kode: "I/c", pangkat: "Juru" },
  { kode: "I/d", pangkat: "Juru Tingkat I" },
  { kode: "II/a", pangkat: "Pengatur Muda" },
  { kode: "II/b", pangkat: "Pengatur Muda Tingkat I" },
  { kode: "II/c", pangkat: "Pengatur" },
  { kode: "II/d", pangkat: "Pengatur Tingkat I" },
  { kode: "III/a", pangkat: "Penata Muda" },
  { kode: "III/b", pangkat: "Penata Muda Tingkat I" },
  { kode: "III/c", pangkat: "Penata" },
  { kode: "III/d", pangkat: "Penata Tingkat I" },
  { kode: "IV/a", pangkat: "Pembina" },
  { kode: "IV/b", pangkat: "Pembina Tingkat I" },
  { kode: "IV/c", pangkat: "Pembina Utama Muda" },
  { kode: "IV/d", pangkat: "Pembina Utama Madya" },
  { kode: "IV/e", pangkat: "Pembina Utama" },
];

export function labelPangkat(kode: string): string {
  const g = GOLONGAN.find((x) => x.kode === kode);
  return g ? `${g.pangkat} (${g.kode})` : kode;
}

/** Nama pengguna disimpan huruf kecil. */
export const rapikanNamaPengguna = (s: string) => s.trim().toLowerCase();

/**
 * 3–30 karakter: huruf kecil, angka, titik, garis bawah, tanda hubung; diawali
 * huruf. Diawali huruf supaya tidak pernah tertukar dengan NIP di kolom login,
 * dan tanpa "@" supaya tidak tertukar dengan email.
 */
export function cekNamaPengguna(u: string): string | null {
  if (u.length < 3) return "Nama pengguna minimal 3 karakter";
  if (u.length > 30) return "Nama pengguna maksimal 30 karakter";
  if (!/^[a-z]/.test(u)) return "Nama pengguna harus diawali huruf";
  if (!/^[a-z][a-z0-9._-]*$/.test(u)) return "Nama pengguna hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung";
  return null;
}

/**
 * NIP PNS 18 angka: tanggal lahir (8) + TMT CPNS tahun-bulan (6) + jenis kelamin
 * 1/2 (1) + nomor urut (3).
 */
export function cekNip(nip: string): string | null {
  if (!/^\d{18}$/.test(nip)) return "NIP harus 18 angka";
  const th = +nip.slice(0, 4), bl = +nip.slice(4, 6), hr = +nip.slice(6, 8);
  const lahir = new Date(Date.UTC(th, bl - 1, hr));
  if (th < 1940 || lahir.getUTCMonth() !== bl - 1 || lahir.getUTCDate() !== hr) return "NIP tidak valid (tanggal lahir)";
  const tmtTh = +nip.slice(8, 12), tmtBl = +nip.slice(12, 14);
  if (tmtTh < th + 15 || tmtBl < 1 || tmtBl > 12) return "NIP tidak valid (TMT CPNS)";
  if (nip[14] !== "1" && nip[14] !== "2") return "NIP tidak valid (digit jenis kelamin)";
  return null;
}

export function cariWilayah(kodeProvinsi: string, kodeKabKota: string): { provinsi: string; kabKota: string } | null {
  const p = WILAYAH.find((w) => w.kode === kodeProvinsi);
  const k = p?.kab.find(([kode]) => kode === kodeKabKota);
  return p && k ? { provinsi: p.nama, kabKota: k[1] } : null;
}

const tanpaPemisah = (s: string) => s.replace(/[\s().-]/g, "");

/** Nomor ponsel Indonesia: 08…, 628…, atau +628…; 10–15 angka. */
export function cekPonsel(s: string): boolean {
  return /^(\+62|62|0)8\d{7,12}$/.test(tanpaPemisah(s));
}

/** Telepon kantor (opsional): angka dengan pemisah umum, 6–16 angka. */
export function cekTelepon(s: string): boolean {
  return /^\+?\d{6,16}$/.test(tanpaPemisah(s));
}

export const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const namaLengkap = (depan: string, belakang?: string | null) => `${depan.trim()} ${(belakang ?? "").trim()}`.trim();

export type IsianRegistrasi = {
  username: string;
  password: string;
  email: string;
  email2: string;
  namaDepan: string;
  namaBelakang: string;
  kodeProvinsi: string;
  kodeKabKota: string;
  nip: string;
  instansi: string;
  unitOrganisasi: string;
  unitKerja: string;
  golongan: string;
  jabatan: string;
  telepon: string;
  ponsel: string;
  alamat: string;
  setuju: boolean;
};

export type KolomRegistrasi = keyof IsianRegistrasi;

const PANJANG_MAKS: Partial<Record<KolomRegistrasi, number>> = {
  namaDepan: 100, namaBelakang: 100, instansi: 200, unitOrganisasi: 200, unitKerja: 200, jabatan: 200, alamat: 500,
};

/**
 * Periksa seluruh isian. Hasil: pesan per kolom (kosong = sah). Yang dicek di
 * sini hanya bentuk isian; keunikan (nama pengguna, email, NIP) dicek server.
 */
export function periksaRegistrasi(d: IsianRegistrasi): Partial<Record<KolomRegistrasi, string>> {
  const g: Partial<Record<KolomRegistrasi, string>> = {};
  const wajib = (k: KolomRegistrasi, label: string) => {
    if (!String(d[k]).trim()) g[k] = `${label} wajib diisi`;
  };

  const u = rapikanNamaPengguna(d.username);
  const eu = cekNamaPengguna(u);
  if (eu) g.username = eu;

  const nip = d.nip.replace(/\s+/g, "");
  if (d.password.length < PANJANG_SANDI_MIN) g.password = `Kata sandi minimal ${PANJANG_SANDI_MIN} karakter`;
  else if (d.password.length > 256) g.password = "Kata sandi terlalu panjang";
  else if (d.password.replace(/\s+/g, "") === nip) g.password = "Kata sandi tidak boleh sama dengan NIP";
  else if (d.password.trim().toLowerCase() === u) g.password = "Kata sandi tidak boleh sama dengan nama pengguna";

  const email = d.email.trim().toLowerCase();
  if (!email) g.email = "Alamat surel wajib diisi";
  else if (email.length > 254 || !POLA_EMAIL.test(email) || email.endsWith(".invalid")) g.email = "Alamat surel tidak valid";
  if (!g.email && d.email2.trim().toLowerCase() !== email) g.email2 = "Surel tidak sama";

  wajib("namaDepan", "Nama depan");
  wajib("kodeProvinsi", "Provinsi");
  if (!g.kodeProvinsi) {
    if (!d.kodeKabKota) g.kodeKabKota = "Kabupaten/Kota wajib dipilih";
    else if (!cariWilayah(d.kodeProvinsi, d.kodeKabKota)) g.kodeKabKota = "Kabupaten/Kota tidak sesuai provinsi";
  }

  const en = cekNip(nip);
  if (en) g.nip = en;
  wajib("instansi", "Instansi");
  wajib("unitOrganisasi", "OPD / Unit Organisasi");
  if (!GOLONGAN.some((x) => x.kode === d.golongan)) g.golongan = "Pangkat/golongan ruang wajib dipilih";
  wajib("jabatan", "Jabatan");
  if (d.telepon.trim() && !cekTelepon(d.telepon)) g.telepon = "Nomor telepon tidak valid";
  if (!d.ponsel.trim()) g.ponsel = "Nomor ponsel wajib diisi";
  else if (!cekPonsel(d.ponsel)) g.ponsel = "Nomor ponsel tidak valid (mis. 081234567890)";
  wajib("alamat", "Alamat");
  if (!d.setuju) g.setuju = "Persetujuan pemrosesan data pribadi wajib dicentang";

  for (const [k, maks] of Object.entries(PANJANG_MAKS) as [KolomRegistrasi, number][]) {
    if (!g[k] && String(d[k]).trim().length > maks) g[k] = `Maksimal ${maks} karakter`;
  }
  return g;
}

// ------------------------------------------------------------------ PROFIL SAYA (peserta, setelah registrasi)

/**
 * Isian yang boleh diubah peserta sendiri di Profil Saya. NIP, nama, dan nama pengguna TIDAK bisa diubah
 * sendiri (identitas; lewat penyelenggara). Biodata tambahan boleh kosong.
 */
export type IsianProfil = {
  kodeProvinsi: string;
  kodeKabKota: string;
  instansi: string;
  unitOrganisasi: string;
  unitKerja: string;
  golongan: string;
  jabatan: string;
  telepon: string;
  ponsel: string;
  alamat: string;
  alamatKantor: string;
  tempatLahir: string;
  /** "YYYY-MM-DD" atau kosong. */
  tanggalLahir: string;
  /** "L" | "P" | "". */
  jenisKelamin: string;
  pendidikanTerakhir: string;
  eselon: string;
  tmtPangkat: string;
  tmtJabatan: string;
};
export type KolomProfil = keyof IsianProfil;

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const PANJANG_MAKS_PROFIL: Partial<Record<KolomProfil, number>> = {
  instansi: 200, unitOrganisasi: 200, unitKerja: 200, jabatan: 200, alamat: 500, alamatKantor: 500, tempatLahir: 100, pendidikanTerakhir: 100, eselon: 20,
};

export function periksaProfil(d: IsianProfil): Partial<Record<KolomProfil, string>> {
  const g: Partial<Record<KolomProfil, string>> = {};
  if (!d.kodeProvinsi) g.kodeProvinsi = "Provinsi wajib dipilih";
  else if (!d.kodeKabKota) g.kodeKabKota = "Kabupaten/Kota wajib dipilih";
  else if (!cariWilayah(d.kodeProvinsi, d.kodeKabKota)) g.kodeKabKota = "Kabupaten/Kota tidak sesuai provinsi";
  if (!d.instansi.trim()) g.instansi = "Instansi wajib diisi";
  if (!d.unitOrganisasi.trim()) g.unitOrganisasi = "OPD / Unit Organisasi wajib diisi";
  if (!GOLONGAN.some((x) => x.kode === d.golongan)) g.golongan = "Pangkat/golongan ruang wajib dipilih";
  if (!d.jabatan.trim()) g.jabatan = "Jabatan wajib diisi";
  if (d.telepon.trim() && !cekTelepon(d.telepon)) g.telepon = "Nomor telepon tidak valid";
  if (!d.ponsel.trim()) g.ponsel = "Nomor ponsel wajib diisi";
  else if (!cekPonsel(d.ponsel)) g.ponsel = "Nomor ponsel tidak valid (mis. 081234567890)";
  if (!d.alamat.trim()) g.alamat = "Alamat wajib diisi";
  for (const k of ["tanggalLahir", "tmtPangkat", "tmtJabatan"] as const) if (d[k] && !TANGGAL.test(d[k])) g[k] = "Tanggal tidak valid";
  if (d.jenisKelamin && d.jenisKelamin !== "L" && d.jenisKelamin !== "P") g.jenisKelamin = "Pilih laki-laki atau perempuan";
  for (const [k, maks] of Object.entries(PANJANG_MAKS_PROFIL) as [KolomProfil, number][]) {
    if (!g[k] && String(d[k]).trim().length > maks) g[k] = `Maksimal ${maks} karakter`;
  }
  return g;
}
