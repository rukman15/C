import "server-only";
import { z } from "zod";
import { bacaTanggalIso } from "@/lib/tanggal";

const butir = z.array(z.string().trim().max(2000, "Satu butir maksimal 2000 karakter")).max(20);

export const skemaSuratTugas = z.object({
  nomor: z.string().trim().max(120, "Nomor maksimal 120 karakter").nullable().optional(),
  tanggal: z.string().refine((v) => bacaTanggalIso(v) !== null, "Tanggal surat tidak valid"),
  tempat: z.string().trim().max(60).nullable().optional(),
  dasar: butir,
  untuk: butir,
  pegawaiIds: z.array(z.string().min(1).max(60)).min(1, "Pilih minimal satu Widyaiswara").max(100),
  penandatangan: z.string().trim().max(300).nullable().optional(),
  ttdNama: z.string().trim().max(150).nullable().optional(),
  ttdNip: z.string().trim().max(30).nullable().optional(),
  tanggalTugas: z.array(z.object({ mulai: z.string().max(10), selesai: z.string().max(10) })).max(60).optional(),
});

const jpMin = z.number().int().min(0).max(500).nullable();
const orang = z.object({ nama: z.string().trim().max(150), nip: z.string().trim().max(30) });
// jpMinimal & koordinatorWi: isian KARKEN lama (KARKEN kini manual) — opsional, tidak dikirim = nilai lama tetap.
export const skemaPengaturanDokumen = z.object({
  jpMinimal: z.object({ pertama: jpMin, muda: jpMin, madya: jpMin, utama: jpMin }).optional(),
  koordinatorWi: orang.optional(),
  kabagTu: orang,
  kepalaBalai: orang,
  perjalanan: z
    .object({
      ppkNama: z.string().trim().max(150),
      ppkNip: z.string().trim().max(30),
      dipaTeks: z.string().trim().max(200),
      akunPerjalanan: z.string().trim().max(60),
    })
    .optional(),
});
