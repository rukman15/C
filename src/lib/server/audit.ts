import "server-only";
import { prisma } from "@/lib/server/prisma";
import { getActiveSession } from "@/lib/server/auth";

/**
 * Log audit (tabel log_audit) — sama dengan src/lib/server/audit.ts aplikasi lama. Tindakan yang
 * menyangkut hak akses dicatat; kegagalan mencatat tidak menggagalkan tindakannya.
 */
export type Pelaku = { email: string; name: string; sebagai?: string | null };

export const AKSI_AUDIT = {
  AKUN_DIBUAT: "Akun dibuat",
  AKUN_DINONAKTIFKAN: "Akun dinonaktifkan",
  AKUN_DIAKTIFKAN: "Akun diaktifkan",
  SANDI_DIRESET: "Kata sandi direset",
  CATATAN_SANDI_DIBUKA: "Catatan sandi awal dibuka",
  SANDI_NIP_DIGANTI: "Kata sandi NIP diganti sandi acak",
  PERAN_DIUBAH: "Peran akun diubah",
  JABATAN_DIUBAH: "Jabatan pegawai diubah",
  STATUS_PEGAWAI: "Status pegawai diubah",
  AKSES_DITUTUP: "Akses ditutup otomatis",
  PLT_DIBUAT: "Plt/Plh ditetapkan",
  PLT_DICABUT: "Plt/Plh dicabut",
  BERTINDAK_PLT: "Mulai bertindak sebagai Plt/Plh",
  KEMBALI_PERAN: "Kembali ke peran sendiri",
  AKUN_PESERTA: "Akun peserta dibuat/ditautkan",
  REGISTRASI_DIAJUKAN: "Registrasi peserta diajukan",
  REGISTRASI_DISETUJUI: "Registrasi peserta disetujui",
  REGISTRASI_DITOLAK: "Registrasi peserta ditolak",
  SOAL_DITAMBAH: "Soal tes ditambahkan",
  SOAL_DIPERIKSA: "Soal tes diperiksa",
  SOAL_DIUBAH: "Soal tes diubah",
  SOAL_DIHAPUS: "Soal tes dihapus",
  TES_DIATUR: "Pengaturan tes diubah",
  TES_STATUS: "Status tes diubah",
  TES_DIRESET: "Pengerjaan tes direset",
  EVALUASI_SASARAN: "Sasaran evaluasi pengajar diubah",
  EVALUASI_STATUS: "Evaluasi peserta dibuka/ditutup",
  MODUL_DIUBAH: "Pengaturan modul diubah",
  BATAS_JP_WI: "Batas JP Widyaiswara diubah",
  KOORDINATOR_WI: "Koordinator WI diubah",
  // KARKEN kini manual (23 Okt 2026); dua label ini tetap untuk menampilkan log lama.
  KARKEN_DIVERIFIKASI: "KARKEN diverifikasi",
  KARKEN_BATAL_VERIFIKASI: "Verifikasi KARKEN dibatalkan",
  DOKUMEN_DIUNGGAH: "Dokumen peserta diunggah penyelenggara",
  DOKUMEN_DIVERIFIKASI: "Dokumen peserta diverifikasi",
  DOKUMEN_DIUNDUH: "Dokumen peserta dibuka",
  DOKUMEN_PENGATURAN: "Pengaturan dokumen peserta diubah",
  NOMOR_SURAT: "Nomor surat keluar diberikan",
  PENGHITUNG_NOMOR: "Nomor terakhir buku agenda diatur",
  CUTI_DIPUTUSKAN: "Cuti pegawai diputuskan",
  SURAT_MASUK_DIBUKA: "Pindaian surat masuk dibuka",
  FORUM_DISEMBUNYIKAN: "Tulisan forum coaching disembunyikan",
  FORUM_DITAMPILKAN: "Tulisan forum coaching ditampilkan lagi",
  // Langkah 3 (EB-034/EB-035).
  WEWENANG_PENYELENGGARA: "Wewenang Admin Penyelenggara diubah",
  WEWENANG_DICABUT: "Wewenang Admin Penyelenggara dicabut",
  PENUGASAN_ANGKATAN: "Penugasan angkatan diubah",
  // EB-045.
  REKENING_MENTOR_DIBUKA: "Rekening mentor dibuka",
} as const;

export async function catatAudit(pelaku: Pelaku, aksi: string, sasaran?: string | null, rincian?: string | null): Promise<void> {
  try {
    await prisma.logAudit.create({
      data: { pelaku: pelaku.email, pelakuNama: pelaku.name, sebagai: pelaku.sebagai ?? null, aksi, sasaran: sasaran ?? null, rincian: rincian ?? null },
    });
  } catch (e) {
    console.error("[audit] gagal mencatat:", aksi, sasaran, e);
  }
}

/** Pelaku dari sesi yang sedang login (pengganti pelakuDari(cookies) aplikasi lama). */
export async function pelakuSesi(): Promise<Pelaku> {
  const s = await getActiveSession();
  return { email: s?.email ?? "(tidak dikenal)", name: s?.name ?? "(tidak dikenal)", sebagai: s?.plt?.sebagai ?? null };
}
