import "server-only";
import { z } from "zod";
import { CATATAN_EVALUASI_MAKS, FORMULIR_EVALUASI } from "@/lib/evaluasi";

export const skemaIsiEvaluasi = z.object({
  sasaranKunci: z.string().min(1).max(120),
  // Bentuk & rentang nilai diperiksa periksaIsianEvaluasi() (pesannya menyebut nama aspek).
  nilai: z.record(z.string().max(5), z.number().nullable()),
  catatan: z.string().max(CATATAN_EVALUASI_MAKS, `Catatan maksimal ${CATATAN_EVALUASI_MAKS} karakter`).nullable().optional(),
});

export const skemaAksiEvaluasi = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("tambah"),
    formulir: z.enum(FORMULIR_EVALUASI),
    nama: z.string().trim().min(1, "Nama wajib diisi").max(150, "Nama maksimal 150 karakter"),
    keterangan: z.string().trim().max(200, "Keterangan maksimal 200 karakter").nullable().optional(),
    pegawaiId: z.string().max(60).nullable().optional(),
  }),
  z.object({ aksi: z.literal("hapus"), id: z.string().min(1) }),
  z.object({ aksi: z.enum(["tutup", "buka"]) }),
]);

// Formulir 23B — kode aspek & rentang nilai diperiksa periksaIsian23B().
export const skemaIsi23B = z.object({
  nilai: z.record(z.string().max(5), z.number().nullable()),
  catatan: z.string().max(CATATAN_EVALUASI_MAKS, `Catatan maksimal ${CATATAN_EVALUASI_MAKS} karakter`).nullable().optional(),
});
