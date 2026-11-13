/**
 * Bentuk data tab Jadwal & Absensi (murni, aman untuk browser). Sama dengan
 * JadwalPembelajaranRecord/LembarKehadiranRecord dan skema-lms.ts aplikasi lama.
 */
import { z } from "zod";
import { BENTUK_SESI, JENIS_MASA_TEMPAT_KERJA, STATUS_KEHADIRAN, type JenisMasaTempatKerja, type StatusKehadiran } from "@/lib/kehadiran";
import type { StatusPeserta } from "@/lib/peserta";
import { JP_SESI_MAKS, SESI_MAKS_PER_PERMINTAAN, isTanggalIsoValid } from "@/lib/sesi";

export type SesiPembelajaran = {
  id: string;
  trainingId: string;
  tanggal: string;
  jamMulai?: string;
  kegiatan: string;
  jp: number;
  bentuk: string;
  /** false = sesi asinkron/mandiri: tetap dicatat, tidak dihitung dalam batas ketidakhadiran. */
  wajibHadir: boolean;
  mataPelatihan?: string;
  mataPelatihanNama?: string;
  keterangan?: string;
  tautan?: string;
  /** Ruang/tempat sesi; kosong = tempat diklat. */
  ruang?: string;
  /** Pengampu mata pelatihan sesi ini (dari penugasan WI yang disetujui). */
  pengampu?: string[];
  /** Pengajar & tautan Zoom per kelompok e-learning (EB-052); kosong bila belum diatur. */
  perKelompok: PerKelompok[];
  diluarPeriode: boolean;
  hadir: number;
  tidakHadir: number;
  dispensasi: number;
  belumDicatat: number;
  /** Semua catatan pada sesi ini, termasuk milik peserta yang sudah tidak aktif. */
  jumlahCatatan: number;
};

export type PerKelompok = { kelompokId: string; nomor: number; pengajarPegawaiId: string | null; pengajarNama: string | null; tautan: string | null };

export type MasaTempatKerja = { id: string; jenis: string; label: string; mulai: string; selesai: string };

export type JadwalPembelajaran = {
  training: { id: string; name: string; startDate: string; endDate: string | null; jenisPelatihan: string | null };
  sesi: SesiPembelajaran[];
  pesertaAktif: number;
  /** Hari s.d. hari ini yang punya sesi tetapi presensinya belum lengkap. */
  presensiBelumLengkap: string[];
  /** Hari kerja s.d. hari ini tanpa sesi sama sekali, di luar masa di tempat kerja. */
  presensiTanpaSesi: string[];
  masaTempatKerja: MasaTempatKerja[];
  /** Kelompok e-learning jadwal ini (untuk pengajar & Zoom per kelompok). */
  kelompokElearning: { id: string; nomor: number; label: string }[];
  /** WI dengan penugasan disetujui di jadwal ini — pilihan pengajar per kelompok. */
  wi: { id: string; nama: string }[];
};

export type BarisKehadiran = {
  pesertaId: string;
  nomor: number;
  nama: string;
  instansi?: string;
  statusPeserta: StatusPeserta;
  /** null = belum dicatat. */
  status: StatusKehadiran | null;
  keterangan?: string;
};

export type LembarKehadiran = { sesi: SesiPembelajaran; baris: BarisKehadiran[] };

const teksOpsional = (maks: number, label: string) => z.string().trim().max(maks, `${label} maksimal ${maks} karakter`).nullable().optional();
const BENTUK = BENTUK_SESI.map((b) => b.value) as [string, ...string[]];

export const skemaSesiPembelajaran = z.object({
  tanggal: z.string().refine(isTanggalIsoValid, "Tanggal harus berformat YYYY-MM-DD dan ada di kalender"),
  jamMulai: z.string().trim().max(5).nullable().optional(),
  kegiatan: z.string().trim().min(1, "Nama kegiatan wajib diisi").max(200, "Nama kegiatan maksimal 200 karakter"),
  jp: z.number().int("JP harus bilangan bulat").min(1, "JP minimal 1").max(JP_SESI_MAKS, `JP satu sesi maksimal ${JP_SESI_MAKS}`),
  bentuk: z.enum(BENTUK).optional(),
  mataPelatihan: z.string().trim().max(60).nullable().optional(),
  keterangan: teksOpsional(300, "Keterangan"),
  tautan: z.string().trim().max(500, "Tautan maksimal 500 karakter").nullable().optional(),
  ruang: z.string().trim().max(100, "Ruang maksimal 100 karakter").nullable().optional(),
});

export const skemaTambahSesiPembelajaran = z.object({
  sesi: z.array(skemaSesiPembelajaran).min(1, "Minimal satu sesi").max(SESI_MAKS_PER_PERMINTAAN, `Maksimal ${SESI_MAKS_PER_PERMINTAAN} sesi sekali simpan`),
});

export const skemaUbahSesiPembelajaran = skemaSesiPembelajaran.partial().refine((o) => Object.keys(o).length > 0, "Tidak ada perubahan yang dikirim");

export const skemaSimpanKehadiran = z.object({
  kehadiran: z
    .array(z.object({ pesertaId: z.string().min(1), status: z.enum(STATUS_KEHADIRAN).nullable(), keterangan: teksOpsional(200, "Keterangan") }))
    .min(1, "Tidak ada kehadiran yang dikirim")
    .max(500),
});

export const skemaAksiMasaTempatKerja = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("tambah"),
    jenis: z.enum(JENIS_MASA_TEMPAT_KERJA.map((j) => j.value) as [JenisMasaTempatKerja, ...JenisMasaTempatKerja[]]),
    mulai: z.string().refine(isTanggalIsoValid, "Tanggal mulai tidak valid"),
    selesai: z.string().refine(isTanggalIsoValid, "Tanggal selesai tidak valid"),
  }),
  z.object({ aksi: z.literal("hapus"), id: z.string().min(1).max(60) }),
]);

/** Kelompokkan sesi (sudah terurut) per tanggal, dengan jumlah JP harian. */
export function sesiPerHari<T extends { tanggal: string; jp: number }>(sesi: T[]): { tanggal: string; jp: number; sesi: T[] }[] {
  const grup: { tanggal: string; jp: number; sesi: T[] }[] = [];
  for (const s of sesi) {
    const akhir = grup[grup.length - 1];
    if (akhir && akhir.tanggal === s.tanggal) {
      akhir.sesi.push(s);
      akhir.jp += s.jp;
    } else grup.push({ tanggal: s.tanggal, jp: s.jp, sesi: [s] });
  }
  return grup;
}

/** Baris lembar yang isiannya berbeda dari yang tersimpan (hanya ini yang dikirim). Keterangan dibuang untuk HADIR/belum. */
export function perubahanKehadiran(
  baris: BarisKehadiran[],
  isian: Record<string, { status: StatusKehadiran | null; keterangan: string }>,
): { pesertaId: string; status: StatusKehadiran | null; keterangan: string | null }[] {
  const hasil: { pesertaId: string; status: StatusKehadiran | null; keterangan: string | null }[] = [];
  for (const b of baris) {
    const x = isian[b.pesertaId];
    if (!x) continue;
    const ket = x.status === null || x.status === "HADIR" ? "" : x.keterangan.trim();
    if (x.status !== b.status || ket !== (b.keterangan ?? "")) hasil.push({ pesertaId: b.pesertaId, status: x.status, keterangan: ket || null });
  }
  return hasil;
}

export const pesanZod = (e: z.ZodError) => e.issues.map((i) => i.message).join("; ");

export const skemaPerKelompok = z.object({
  baris: z
    .array(
      z.object({
        kelompokId: z.string().min(1).max(60),
        pengajarPegawaiId: z.string().max(60).nullable().optional(),
        pengajarNama: z.string().trim().max(150, "Nama pengajar maksimal 150 karakter").nullable().optional(),
        tautan: z.string().trim().max(500, "Tautan maksimal 500 karakter").nullable().optional(),
      }),
    )
    .max(12),
});

/** Isian per kelompok dianggap kosong bila tanpa pengajar dan tanpa tautan (barisnya dihapus). */
export const perKelompokKosong = (b: { pengajarPegawaiId?: string | null; pengajarNama?: string | null; tautan?: string | null }) =>
  !b.pengajarPegawaiId && !b.pengajarNama?.trim() && !b.tautan?.trim();

/** Pengajar & tautan untuk satu peserta: isian kelompoknya bila ada, selain itu tautan umum sesi. */
export function untukKelompok(s: { tautan?: string; perKelompok: PerKelompok[] }, kelompokId: string | null): { pengajar: string | null; tautan: string | null } {
  const k = kelompokId ? s.perKelompok.find((x) => x.kelompokId === kelompokId) : undefined;
  return { pengajar: k?.pengajarNama ?? null, tautan: k?.tautan ?? s.tautan ?? null };
}
