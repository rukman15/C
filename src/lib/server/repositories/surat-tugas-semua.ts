import "server-only";
import { prisma } from "@/lib/server/prisma";

/**
 * Satu daftar surat tugas (keputusan 28 Okt 2026: "surat tugas satu saja") dari dua sumber yang
 * datanya tetap terpisah:
 *  - "surat-tugas": surat tugas MENGAJAR (tabel `surat_tugas`, dibuat dari Rincian Diklat, penerima = pengampu);
 *  - "naskah": surat tugas UMUM (naskah dinas jenis SURAT_TUGAS, penerima = pegawai mana pun).
 * Hanya tampilan gabungan — pembuatan, penomoran, cetak tetap lewat jalur masing-masing.
 */
export type SuratTugasGabungan = {
  sumber: "surat-tugas" | "naskah";
  id: string;
  tanggal: string; // YYYY-MM-DD
  nomor: string | null;
  /** Ringkasan isi: butir "Untuk" pertama, atau hal. */
  ringkas: string;
  trainingId: string | null;
  trainingName: string | null;
  jumlahPenerima: number;
  dibuatOleh: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Butir "Untuk" pertama dari isi naskah (JSON) bila ada. */
function untukPertama(isi: unknown): string {
  const u = (isi as { untuk?: unknown } | null)?.untuk;
  return Array.isArray(u) && typeof u[0] === "string" ? u[0] : "";
}

export async function daftarSuratTugas(tahun: number): Promise<SuratTugasGabungan[]> {
  const rentang = { gte: new Date(Date.UTC(tahun, 0, 1)), lt: new Date(Date.UTC(tahun + 1, 0, 1)) };
  const [mengajar, umum]: [
    { id: string; tanggal: Date; nomor: string | null; untuk: string[]; pegawaiIds: string[]; trainingId: string; training: { name: string } | null; dibuatOleh: string }[],
    { id: string; tanggal: Date; nomor: string | null; hal: string; isi: unknown; pegawaiIds: string[]; trainingId: string | null; training: { name: string } | null; dibuatOleh: string }[],
  ] = await Promise.all([
    prisma.suratTugas.findMany({ where: { tanggal: rentang }, include: { training: { select: { name: true } } } }),
    prisma.naskahDinas.findMany({ where: { jenis: "SURAT_TUGAS", tanggal: rentang }, include: { training: { select: { name: true } } } }),
  ]);
  const baris: SuratTugasGabungan[] = [
    ...mengajar.map((s) => ({
      sumber: "surat-tugas" as const,
      id: s.id,
      tanggal: iso(s.tanggal),
      nomor: s.nomor,
      ringkas: s.untuk[0] ?? "",
      trainingId: s.trainingId,
      trainingName: s.training?.name ?? null,
      jumlahPenerima: s.pegawaiIds.length,
      dibuatOleh: s.dibuatOleh,
    })),
    ...umum.map((n) => ({
      sumber: "naskah" as const,
      id: n.id,
      tanggal: iso(n.tanggal),
      nomor: n.nomor,
      ringkas: untukPertama(n.isi) || n.hal,
      trainingId: n.trainingId,
      trainingName: n.training?.name ?? null,
      jumlahPenerima: n.pegawaiIds.length,
      dibuatOleh: n.dibuatOleh,
    })),
  ];
  // Terbaru dulu; tanggal sama -> yang belum bernomor dulu (pekerjaan TU).
  return baris.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || Number(!!a.nomor) - Number(!!b.nomor));
}
