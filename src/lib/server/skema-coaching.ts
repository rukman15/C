import "server-only";
import { z } from "zod";

/**
 * Bentuk permintaan Ruang Coaching. Batas di sini hanya pengaman ukuran; pesan aturan yang ramah ada di
 * src/lib/coaching.ts (periksaVideo, periksaSesiCoaching, periksaTopik, ...).
 */
const id = z.string().min(1).max(60);
const teks = (maks: number) => z.string().max(maks, "Isian terlalu panjang");
const opsional = (maks: number) => teks(maks).nullable().optional();

export const skemaVideo = z.object({
  judul: teks(300),
  tautan: teks(600),
  jenis: teks(20),
  keterangan: opsional(2000),
});

export const skemaAksiRuang = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("sesi"),
    id: id.nullable().optional(),
    judul: teks(300),
    tanggal: opsional(10),
    jamMulai: opsional(5),
    tautanRapat: opsional(600),
    keterangan: opsional(2000),
  }),
  z.object({ aksi: z.literal("hapus-sesi"), id }),
  z.object({ aksi: z.literal("pasang-video"), videoId: id, sesiId: id.nullable().optional() }),
  z.object({ aksi: z.literal("lepas-video"), id }),
  z.object({ aksi: z.literal("tonton"), id, sudah: z.boolean() }),
  z.object({
    aksi: z.literal("catatan"),
    sesiId: id,
    pesertaId: id,
    hadir: z.boolean().nullable().optional(),
    catatan: opsional(4000),
    tindakLanjut: opsional(4000),
  }),
]);

export const skemaAksiForum = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("topik"), judul: teks(300), isi: teks(10000), sesiId: id.nullable().optional(), videoKelompokId: id.nullable().optional() }),
  z.object({ aksi: z.literal("balas"), topikId: id, isi: teks(10000) }),
  z.object({ aksi: z.literal("ubah-topik"), id, judul: teks(300), isi: teks(10000) }),
  z.object({ aksi: z.literal("ubah-balasan"), id, isi: teks(10000) }),
  z.object({ aksi: z.literal("atur"), id, disematkan: z.boolean().optional(), terjawab: z.boolean().optional() }),
  z.object({ aksi: z.literal("sembunyikan"), jenis: z.enum(["topik", "balasan"]), id, sembunyi: z.boolean() }),
]);

// Seminar RAP/LAP per peserta (src/lib/seminar.ts) — batas ukuran saja; aturan di periksaJadwalSeminar.
export const skemaSimpanSeminar = z.object({
  jenis: z.enum(["RAP", "LAP"]),
  isian: z
    .array(
      z.object({
        pesertaId: id,
        tanggal: opsional(10),
        jamMulai: opsional(5),
        urutan: z.number().int().nullable().optional(),
        ruang: opsional(300),
        tautanDaring: opsional(600),
        pengujiPegawaiId: id.nullable().optional(),
        pengujiNama: opsional(300),
        mentorNama: opsional(300),
        mentorJabatan: opsional(300),
        mentorHadir: opsional(20),
        evaluatorNama: opsional(300),
      }),
    )
    .max(200),
});
export const skemaStatusSeminar = z.object({
  id,
  status: z.enum(["MENUNGGU", "DIPANGGIL", "PRESENTASI", "SELESAI", "TIDAK_HADIR"]),
});
