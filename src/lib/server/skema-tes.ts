import "server-only";
import { z } from "zod";
import {
  DURASI_MAKS,
  DURASI_MIN,
  JUMLAH_SOAL_MAKS,
  KISI,
  OPSI_MAKS,
  OPSI_MIN,
  OPSI_TEKS_MAKS,
  PEMBAHASAN_MAKS,
  PERTANYAAN_MAKS,
  PROGRAM_TES,
  SOAL_MAKS_PER_IMPOR,
} from "@/lib/tes";

/** Skema isian pre/post-test (bentuk saja; aturan di repositories/tes.ts). */
const soal = {
  kisi: z.enum(KISI, { message: "Agenda/kisi-kisi tidak dikenal" }),
  pertanyaan: z.string().trim().min(1, "Pertanyaan wajib diisi").max(PERTANYAAN_MAKS, `Pertanyaan maksimal ${PERTANYAAN_MAKS} karakter`),
  opsi: z
    .array(z.string().max(OPSI_TEKS_MAKS, `Pilihan maksimal ${OPSI_TEKS_MAKS} karakter`))
    .min(OPSI_MIN, `Minimal ${OPSI_MIN} pilihan`)
    .max(OPSI_MAKS, `Maksimal ${OPSI_MAKS} pilihan`),
  kunci: z.number().int().min(0).max(OPSI_MAKS - 1),
  pembahasan: z.string().max(PEMBAHASAN_MAKS, `Pembahasan maksimal ${PEMBAHASAN_MAKS} karakter`).nullable().optional(),
};
const penyusun = z.string().trim().max(150, "Nama penyusun maksimal 150 karakter").nullable().optional();

export const skemaTambahSoal = z.object({
  program: z.enum(PROGRAM_TES, { message: "Program harus PKA atau PKP" }),
  penyusun,
  soal: z.array(z.object(soal)).min(1, "Tidak ada soal").max(SOAL_MAKS_PER_IMPOR, `Maksimal ${SOAL_MAKS_PER_IMPOR} soal sekali simpan`),
});

export const skemaUbahSoal = z.union([
  z.object({
    aksi: z.enum(["setujui", "kembalikan", "nonaktifkan", "aktifkan"]),
    catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullable().optional(),
  }),
  z
    .object({ ...soal, penyusun })
    .partial()
    .refine((o) => Object.keys(o).length > 0, "Tidak ada perubahan yang dikirim"),
]);

const waktu = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Waktu tidak valid")
  .nullable();

export const skemaSimpanTes = z.object({
  jenis: z.enum(["PRE", "POST"]),
  buka: waktu,
  tutup: waktu,
  durasiMenit: z
    .number()
    .int("Durasi harus bilangan bulat")
    .min(DURASI_MIN, `Durasi minimal ${DURASI_MIN} menit`)
    .max(DURASI_MAKS, `Durasi maksimal ${DURASI_MAKS} menit`),
  soalIds: z.array(z.string().min(1).max(40)).max(JUMLAH_SOAL_MAKS, `Paket maksimal ${JUMLAH_SOAL_MAKS} soal`),
  acakSoal: z.boolean(),
  acakOpsi: z.boolean(),
  tampilkanHasil: z.boolean(),
});

export const skemaAksiTes = z.discriminatedUnion("aksi", [
  z.object({ jenis: z.enum(["PRE", "POST"]), aksi: z.literal("susun"), jumlah: z.number().int().min(1, "Jumlah soal minimal 1").max(JUMLAH_SOAL_MAKS, `Maksimal ${JUMLAH_SOAL_MAKS} soal`) }),
  z.object({ jenis: z.enum(["PRE", "POST"]), aksi: z.enum(["salin-pre", "terbitkan", "tutup", "buka-lagi", "kembali-draf"]) }),
  z.object({ jenis: z.enum(["PRE", "POST"]), aksi: z.literal("reset"), pesertaId: z.string().min(1) }),
]);

export const skemaJawaban = z.object({
  jawaban: z.record(z.string().max(40), z.number().int().min(0).max(OPSI_MAKS - 1).nullable()).refine((o) => Object.keys(o).length <= JUMLAH_SOAL_MAKS, "Terlalu banyak jawaban"),
  kirim: z.boolean().optional(),
});
