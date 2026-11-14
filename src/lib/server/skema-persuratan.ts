import "server-only";
import { z } from "zod";
import { bacaTanggalIso } from "@/lib/tanggal";
import { INSTRUKSI_DISPOSISI, JENIS_CUTI, JENIS_NASKAH, KEAMANAN, SIFAT_SURAT, SUMBER_AGENDA, isKodeKlasifikasi, type SumberAgenda } from "@/lib/persuratan";

const tanggal = (pesan: string) => z.string().refine((v) => bacaTanggalIso(v) !== null, pesan);
const daftar = (maks: number, jumlah: number) => z.array(z.string().trim().max(maks)).max(jumlah);
const kodeJenis = JENIS_NASKAH.map((j) => j.kode) as [string, ...string[]];

/** Naskah dinas: isi (JSON) dirapikan lagi di repository (`rapikanIsi`). */
export const skemaNaskah = z.object({
  jenis: z.enum(kodeJenis, { message: "Jenis naskah tidak dikenal" }),
  trainingId: z.string().min(1).max(60).nullable().optional(),
  hal: z.string().trim().max(300, "Hal maksimal 300 karakter").default(""),
  tanggal: tanggal("Tanggal naskah tidak valid"),
  tempat: z.string().trim().max(60).nullable().optional(),
  sifat: z.enum(SIFAT_SURAT).default("Biasa"),
  keamanan: z.enum(KEAMANAN.map((k) => k.kode) as [string, ...string[]]).default("B"),
  lampiranTeks: z.string().trim().max(120).default(""),
  kepada: daftar(300, 30).default([]),
  tembusan: daftar(300, 20).default([]),
  pegawaiIds: z.array(z.string().min(1).max(60)).max(200).default([]),
  isi: z.unknown(),
  ttdJabatan: z.string().trim().min(1, "Jabatan penanda tangan wajib diisi").max(300),
  ttdNama: z.string().trim().max(150).default(""),
  ttdNip: z.string().trim().max(30).default(""),
  nomor: z.string().trim().max(120).nullable().optional(),
  // Surat tugas dari nota usulan: tautan asal (divalidasi di repository).
  notaId: z.string().min(1).max(60).nullable().optional(),
  // Surat tugas: rentang tanggal tugas (hari kalender), dasar cek bentrok & SPD.
  tanggalTugas: z.array(z.object({ mulai: z.string().max(10), selesai: z.string().max(10) })).max(60).default([]),
});
export type NaskahInput = z.infer<typeof skemaNaskah>;

export const skemaBeriNomor = z.object({
  sumber: z.enum(SUMBER_AGENDA as [SumberAgenda, ...SumberAgenda[]]),
  sumberId: z.string().min(1).max(60).nullable().optional(),
  kodeKlasifikasi: z.string().trim().refine(isKodeKlasifikasi, "Kode klasifikasi tidak valid (mis. 800.1.11.1)"),
  kodeUnit: z.string().trim().max(40).nullable().optional(),
  // Hanya untuk sumber "manual" (surat keluar yang dibuat di luar aplikasi).
  hal: z.string().trim().max(300).nullable().optional(),
  jenis: z.string().trim().max(100).nullable().optional(),
  tanggal: tanggal("Tanggal surat tidak valid").nullable().optional(),
});

export const skemaPenghitung = z.object({
  tahun: z.number().int().min(2020).max(2100),
  terakhir: z.number().int().min(0).max(999_999),
});

export const skemaSuratMasuk = z.object({
  tanggalTerima: tanggal("Tanggal terima tidak valid"),
  asal: z.string().trim().min(1, "Asal surat wajib diisi").max(300),
  nomorSurat: z.string().trim().min(1, "Nomor surat wajib diisi").max(150),
  tanggalSurat: tanggal("Tanggal surat tidak valid").nullable().optional(),
  hal: z.string().trim().min(1, "Hal wajib diisi").max(500),
  sifat: z.enum(SIFAT_SURAT).default("Biasa"),
  keamanan: z.enum(KEAMANAN.map((k) => k.kode) as [string, ...string[]]).default("B"),
  ringkasan: z.string().trim().max(2000).nullable().optional(),
  selesai: z.boolean().optional(),
});

export const skemaDisposisi = z.object({
  kepadaPegawaiIds: z.array(z.string().min(1).max(60)).min(1, "Pilih minimal satu penerima").max(30),
  instruksi: z.array(z.enum(INSTRUKSI_DISPOSISI)).max(INSTRUKSI_DISPOSISI.length).default([]),
  catatan: z.string().trim().max(1000).nullable().optional(),
  batasWaktu: tanggal("Batas waktu tidak valid").nullable().optional(),
});

export const skemaTindakLanjut = z.object({
  status: z.enum(["DIBACA", "SELESAI"]),
  tindakLanjut: z.string().trim().max(1000).nullable().optional(),
});

export const skemaCuti = z.object({
  pegawaiId: z.string().min(1).max(60).nullable().optional(),
  jenis: z.enum(JENIS_CUTI.map((j) => j.kode) as [string, ...string[]], { message: "Jenis cuti tidak dikenal" }),
  mulai: tanggal("Tanggal mulai tidak valid"),
  selesai: tanggal("Tanggal selesai tidak valid"),
  lamaHari: z.number().int().min(1).max(366),
  alasan: z.string().trim().max(500).nullable().optional(),
  // Nomor diketik pembuat surat (28 Okt 2026); boleh menyusul.
  nomorNotaDinas: z.string().trim().max(120).nullable().optional(),
  nomorSuratIzin: z.string().trim().max(120).nullable().optional(),
});

/** PATCH cuti: isi/ubah nomor (pembuat surat); setujui/tolak/batal hanya untuk pengajuan LAMA yang masih "DIAJUKAN". */
export const skemaKeputusanCuti = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("nomor"), nomorNotaDinas: z.string().trim().max(120).nullable(), nomorSuratIzin: z.string().trim().max(120).nullable() }),
  z.object({ aksi: z.literal("setujui") }),
  z.object({ aksi: z.literal("tolak"), alasanTolak: z.string().trim().min(1, "Alasan penolakan wajib diisi").max(300) }),
  z.object({ aksi: z.literal("batal") }),
]);

export const skemaCekBentrok = z.object({
  pegawaiIds: z.array(z.string().min(1).max(60)).max(200),
  tanggalTugas: z.array(z.object({ mulai: z.string().max(10), selesai: z.string().max(10) })).max(60),
  naskahId: z.string().max(60).nullable().optional(),
  suratTugasId: z.string().max(60).nullable().optional(),
  trainingId: z.string().max(60).nullable().optional(),
  konteks: z.enum(["umum", "mengajar"]).default("umum"),
});

const isianSpd = {
  nomor: z.string().trim().max(120).nullable().optional(),
  tanggal: tanggal("Tanggal SPD tidak valid"),
  tingkatBiaya: z.string().trim().max(20).default(""),
  maksud: z.string().trim().max(1000),
  alatAngkut: z.string().trim().max(100),
  tempatBerangkat: z.string().trim().max(200),
  tempatTujuan: z.string().trim().max(300),
  tanggalBerangkat: tanggal("Tanggal berangkat tidak valid"),
  tanggalKembali: tanggal("Tanggal kembali tidak valid"),
  lamaHari: z.number().int().min(1).max(366),
  akun: z.string().trim().max(60).default(""),
  keterangan: z.string().trim().max(500).default(""),
};
export const skemaSpd = z.object(isianSpd);
export const skemaBuatSpd = z.object({
  sumber: z.enum(["naskah", "surat-tugas"]),
  sumberId: z.string().min(1).max(60),
});
