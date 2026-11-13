import "server-only";
import { z } from "zod";
import { isTanggalIsoValid, JP_SESI_MAKS, SESI_MAKS_PER_PERMINTAAN } from "@/lib/sesi";
import { NAMA_PESERTA_MAKS, PESERTA_MAKS_PER_PERMINTAAN, STATUS_PESERTA, TEKS_PESERTA_MAKS } from "@/lib/peserta";
import { BENTUK_SESI, JENIS_MASA_TEMPAT_KERJA, STATUS_KEHADIRAN, type JenisMasaTempatKerja } from "@/lib/kehadiran";
import { JENIS_KELOMPOK, NAMA_KELOMPOK_MAKS, type JenisKelompok } from "@/lib/kelompok";
import { JENIS_SURAT_KETERANGAN } from "@/lib/surat-keterangan";

/**
 * Skema Zod LMS tahap 2 (peserta, jadwal pembelajaran, kehadiran). Hanya BENTUK
 * isian; aturan bisnis (NIP kembar, mata pelatihan milik programnya, sesi yang
 * boleh dicatat kehadirannya) ada di repositories/peserta.ts dan pembelajaran.ts.
 */
const teksOpsional = (maks: number, label: string) =>
  z.string().trim().max(maks, `${label} maksimal ${maks} karakter`).nullable().optional();

const pesertaIsian = {
  nama: z.string().trim().min(1, "Nama wajib diisi").max(NAMA_PESERTA_MAKS, `Nama maksimal ${NAMA_PESERTA_MAKS} karakter`),
  // Format NIP diperiksa `rapikanNip` di repository (pesannya lebih jelas daripada regex).
  nip: z.string().trim().max(40).nullable().optional(),
  jabatan: teksOpsional(TEKS_PESERTA_MAKS, "Jabatan"),
  instansi: teksOpsional(TEKS_PESERTA_MAKS, "Instansi"),
};

export const skemaTambahPeserta = z.object({
  peserta: z
    .array(z.object(pesertaIsian))
    .min(1, "Minimal satu peserta")
    .max(PESERTA_MAKS_PER_PERMINTAAN, `Maksimal ${PESERTA_MAKS_PER_PERMINTAAN} peserta sekali simpan`),
});

export const skemaUbahPeserta = z
  .object({
    ...pesertaIsian,
    nomor: z.number().int().min(1, "Nomor minimal 1").max(9999),
    status: z.enum(STATUS_PESERTA),
    catatan: teksOpsional(500, "Catatan"),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Tidak ada perubahan yang dikirim");

const BENTUK = BENTUK_SESI.map((b) => b.value) as [string, ...string[]];

export const skemaSesiPembelajaran = z.object({
  tanggal: z.string().refine(isTanggalIsoValid, "Tanggal harus berformat YYYY-MM-DD dan ada di kalender"),
  jamMulai: z.string().trim().max(5).nullable().optional(),
  kegiatan: z.string().trim().min(1, "Nama kegiatan wajib diisi").max(200, "Nama kegiatan maksimal 200 karakter"),
  jp: z
    .number()
    .int("JP harus bilangan bulat")
    .min(1, "JP minimal 1")
    .max(JP_SESI_MAKS, `JP satu sesi maksimal ${JP_SESI_MAKS}`),
  bentuk: z.enum(BENTUK).optional(),
  mataPelatihan: z.string().trim().max(60).nullable().optional(),
  keterangan: teksOpsional(300, "Keterangan"),
  tautan: z.string().trim().max(500, "Tautan maksimal 500 karakter").nullable().optional(),
  ruang: z.string().trim().max(100, "Ruang maksimal 100 karakter").nullable().optional(),
});

export const skemaTambahSesiPembelajaran = z.object({
  sesi: z
    .array(skemaSesiPembelajaran)
    .min(1, "Minimal satu sesi")
    .max(SESI_MAKS_PER_PERMINTAAN, `Maksimal ${SESI_MAKS_PER_PERMINTAAN} sesi sekali simpan`),
});

export const skemaUbahSesiPembelajaran = skemaSesiPembelajaran
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Tidak ada perubahan yang dikirim");

export const skemaSimpanKehadiran = z.object({
  kehadiran: z
    .array(
      z.object({
        pesertaId: z.string().min(1),
        status: z.enum(STATUS_KEHADIRAN).nullable(),
        keterangan: teksOpsional(200, "Keterangan"),
      }),
    )
    .min(1, "Tidak ada kehadiran yang dikirim")
    .max(500),
});

export const pesanZod = (error: z.ZodError) => error.issues.map((i) => i.message).join("; ");

// Kelompok kecil peserta PKA/PKP (src/lib/kelompok.ts).
const jenisKelompok = z.enum(JENIS_KELOMPOK.map((j) => j.kode) as [JenisKelompok, ...JenisKelompok[]]).default("ELEARNING");
export const skemaAksiKelompok = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("jumlah"), jenis: jenisKelompok, jumlah: z.number().int() }),
  z.object({ aksi: z.literal("bagi"), jenis: jenisKelompok, jumlah: z.number().int() }),
  z.object({
    aksi: z.literal("ubah"),
    id: z.string().min(1).max(60),
    nama: z.string().trim().max(NAMA_KELOMPOK_MAKS, `Nama kelompok maksimal ${NAMA_KELOMPOK_MAKS} karakter`).nullable().optional(),
    coachNama: z.string().trim().max(150, "Nama coach maksimal 150 karakter").nullable().optional(),
    coachPegawaiId: z.string().max(60).nullable().optional(),
    tautan: z.string().trim().max(500, "Tautan maksimal 500 karakter").nullable().optional(),
  }),
  z.object({ aksi: z.literal("pindah"), jenis: jenisKelompok, pesertaId: z.string().min(1).max(60), kelompokId: z.string().min(1).max(60).nullable() }),
]);

// Surat keterangan ditunda/tidak lulus (src/lib/surat-keterangan.ts).
export const skemaAksiSuratKeterangan = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("simpan"),
    pesertaId: z.string().min(1).max(60),
    jenis: z.enum(JENIS_SURAT_KETERANGAN),
    nomor: z.string().trim().max(120, "Nomor surat maksimal 120 karakter").nullable().optional(),
    tanggal: z.string().refine(isTanggalIsoValid, "Tanggal surat tidak valid"),
  }),
  z.object({ aksi: z.literal("hapus"), id: z.string().min(1).max(60) }),
]);

// Masa peserta di tempat kerja (dikecualikan dari presensi harian "tanpa sesi").
export const skemaAksiMasaTempatKerja = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("tambah"),
    jenis: z.enum(JENIS_MASA_TEMPAT_KERJA.map((j) => j.value) as [JenisMasaTempatKerja, ...JenisMasaTempatKerja[]]),
    mulai: z.string().refine(isTanggalIsoValid, "Tanggal mulai tidak valid"),
    selesai: z.string().refine(isTanggalIsoValid, "Tanggal selesai tidak valid"),
  }),
  z.object({ aksi: z.literal("hapus"), id: z.string().min(1).max(60) }),
]);

// Dokumen persyaratan peserta (src/lib/dokumen-peserta.ts) — aksi penyelenggara.
export const skemaAksiDokumen = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("verifikasi"),
    dokumenId: z.string().min(1).max(60),
    status: z.enum(["DITERIMA", "DITOLAK"]),
    alasan: z.string().trim().max(300, "Alasan maksimal 300 karakter").nullable().optional(),
  }),
  z.object({ aksi: z.literal("batas"), tanggal: z.string().refine(isTanggalIsoValid, "Tanggal batas tidak valid").nullable() }),
  z.object({ aksi: z.literal("jalur"), pesertaId: z.string().min(1).max(60), jalur: z.enum(["INSTANSI", "PERORANGAN"]) }),
]);

// Formulir penyelenggaraan PKA/PKP (src/lib/formulir-penyelenggaraan.ts).
export const skemaSimpanPemantauan = z.object({
  isian: z
    .array(
      z.object({
        kode: z.string().min(1).max(20),
        jangkaWaktu: z.string().trim().max(120).nullable().optional(),
        penanggungJawab: z.string().trim().max(120).nullable().optional(),
        selesai: z.boolean(),
      }),
    )
    .min(1, "Tidak ada isian yang dikirim")
    .max(100),
});
export const skemaPelaksanaanRemedial = z.object({
  pesertaId: z.string().min(1).max(60),
  jenisEvaluasi: z.string().min(1).max(40),
  tanggal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
    .nullable()
    .optional(),
  waktu: z.string().trim().max(20).nullable().optional(),
  teknis: z.string().trim().max(200, "Teknis pelaksanaan maksimal 200 karakter").nullable().optional(),
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullable().optional(),
});
