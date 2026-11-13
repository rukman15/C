import { z } from "zod";
import { bacaTanggalIso } from "@/lib/tanggal";

/**
 * Bentuk isian jadwal diklat, sama dengan aplikasi lama (src/lib/server/skema-training.ts).
 * Dipakai server dan form (pesan galat sama di kedua sisi). `status` tidak diterima:
 * dihitung dari tanggal.
 */
const tanggal = (label: string) => z.string().refine((v) => bacaTanggalIso(v) !== null, `${label} tidak valid`);

export const KATEGORI_DIKLAT = [
  { value: "manajerial", label: "Manajerial" },
  { value: "jafung", label: "Jabatan Fungsional" },
  { value: "teknis-sub", label: "Teknis Substantif" },
  { value: "teknis-umum", label: "Teknis Umum" },
] as const;

export function labelKategori(kode: string): string {
  return KATEGORI_DIKLAT.find((k) => k.value === kode)?.label ?? kode;
}

export const skemaTraining = z
  .object({
    name: z.string().trim().min(1, "Nama pelatihan wajib diisi").max(200, "Nama pelatihan maksimal 200 karakter"),
    category: z.enum(["manajerial", "jafung", "teknis-sub", "teknis-umum"]),
    participants: z.number().int().min(0).max(10_000).optional(),
    startDate: tanggal("Tanggal mulai"),
    endDate: tanggal("Tanggal selesai").nullable().optional(),
    jpDibutuhkan: z.number().int().min(0).max(10_000).optional(),
    tempat: z.string().trim().max(120).optional(),
    jenisPelatihan: z.string().trim().max(20).nullable().optional(),
    modePelatihan: z.string().trim().max(20).nullable().optional(),
    angkatan: z.string().trim().max(30, "Angkatan maksimal 30 karakter").nullable().optional(),
    // Tim kerja pemegang; tidak dikirim = tidak diubah, null = tanpa tim.
    timKerjaId: z.string().trim().max(60).nullable().optional(),
  })
  .refine(
    (v) => {
      const mulai = bacaTanggalIso(v.startDate);
      const selesai = v.endDate ? bacaTanggalIso(v.endDate) : null;
      return !mulai || !selesai || selesai >= mulai;
    },
    { message: "Tanggal selesai tidak boleh sebelum tanggal mulai", path: ["endDate"] },
  );

export type IsianTraining = z.infer<typeof skemaTraining>;
