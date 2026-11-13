/** Bentuk data tab Peserta (murni, aman untuk browser). Sama dengan DaftarPesertaRecord aplikasi lama. */
import { z } from "zod";
import type { AturanKehadiran, RekapKehadiran } from "@/lib/kehadiran";
import { NAMA_PESERTA_MAKS, PESERTA_MAKS_PER_PERMINTAAN, STATUS_PESERTA, TEKS_PESERTA_MAKS, type StatusPeserta } from "@/lib/peserta";

export type PesertaBaris = {
  id: string;
  nomor: number;
  nama: string;
  nip?: string;
  jabatan?: string;
  instansi?: string;
  status: StatusPeserta;
  catatan?: string;
  punyaAkun: boolean;
  rekap: RekapKehadiran;
};

export type DaftarPeserta = {
  peserta: PesertaBaris[];
  aturan: AturanKehadiran | null;
  jumlahSesiWajib: number;
};

export type HasilAkunPeserta = {
  dibuat: { pesertaId: string; nama: string; nip: string; sandiSementara: string }[];
  ditautkan: { pesertaId: string; nama: string; keterangan: string }[];
  dilewati: { pesertaId: string; nama: string; alasan: string }[];
};

// Skema isian, sama dengan src/lib/server/skema-lms.ts aplikasi lama.
const teksOpsional = (maks: number, label: string) => z.string().trim().max(maks, `${label} maksimal ${maks} karakter`).nullable().optional();

const pesertaIsian = {
  nama: z.string().trim().min(1, "Nama wajib diisi").max(NAMA_PESERTA_MAKS, `Nama maksimal ${NAMA_PESERTA_MAKS} karakter`),
  nip: z.string().trim().max(40).nullable().optional(),
  jabatan: teksOpsional(TEKS_PESERTA_MAKS, "Jabatan"),
  instansi: teksOpsional(TEKS_PESERTA_MAKS, "Instansi"),
};

export const skemaTambahPeserta = z.object({
  peserta: z.array(z.object(pesertaIsian)).min(1, "Minimal satu peserta").max(PESERTA_MAKS_PER_PERMINTAAN, `Maksimal ${PESERTA_MAKS_PER_PERMINTAAN} peserta sekali simpan`),
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

export const pesanZod = (e: z.ZodError) => e.issues.map((i) => i.message).join("; ");
