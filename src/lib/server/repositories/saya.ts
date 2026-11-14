import "server-only";
import { prisma } from "@/lib/server/prisma";
import { isoTanggal } from "@/lib/tanggal";
import { rapikanRentang, type RentangTanggal } from "@/lib/persuratan";

/**
 * Ruang kerja "Saya": data milik akun yang login. Surat tugas saya = surat tugas mengajar (inti)
 * + surat tugas umum BERNOMOR dari modul persuratan.
 * Konsep (belum bernomor) tidak ditampilkan ke penerima.
 */

export type SuratTugasSayaRecord = {
  id: string;
  sumber: "mengajar" | "umum";
  nomor: string | null;
  /** Tanggal surat "YYYY-MM-DD". */
  tanggal: string;
  hal: string;
  /** Hari tugas; mengajar tanpa isian = periode diklat. */
  tanggalTugas: RentangTanggal[];
  /** Halaman cetak (PDF). */
  cetak: string;
};

export async function suratTugasSaya(pegawaiId: string, o: { umum: boolean }): Promise<SuratTugasSayaRecord[]> {
  const mengajar: { id: string; nomor: string | null; tanggal: Date; tanggalTugas: unknown; training: { name: string; startDate: Date; endDate: Date | null } }[] =
    await prisma.suratTugas.findMany({
      where: { pegawaiIds: { has: pegawaiId } },
      select: { id: true, nomor: true, tanggal: true, tanggalTugas: true, training: { select: { name: true, startDate: true, endDate: true } } },
    });
  const umum: { id: string; nomor: string | null; tanggal: Date; hal: string; tanggalTugas: unknown }[] = o.umum
    ? await prisma.naskahDinas.findMany({
        where: { jenis: "SURAT_TUGAS", nomor: { not: null }, pegawaiIds: { has: pegawaiId } },
        select: { id: true, nomor: true, tanggal: true, hal: true, tanggalTugas: true },
      })
    : [];
  const hasil: SuratTugasSayaRecord[] = [
    ...mengajar.map((s) => {
      const sendiri = rapikanRentang(s.tanggalTugas);
      return {
        id: s.id,
        sumber: "mengajar" as const,
        nomor: s.nomor,
        tanggal: isoTanggal(s.tanggal),
        hal: `Mengajar pada ${s.training.name}`,
        tanggalTugas: sendiri.length ? sendiri : [{ mulai: isoTanggal(s.training.startDate), selesai: isoTanggal(s.training.endDate ?? s.training.startDate) }],
        cetak: `/cetak/surat-tugas/${s.id}`,
      };
    }),
    ...umum.map((n) => ({
      id: n.id,
      sumber: "umum" as const,
      nomor: n.nomor,
      tanggal: isoTanggal(n.tanggal),
      hal: n.hal || "Surat tugas",
      tanggalTugas: rapikanRentang(n.tanggalTugas),
      cetak: `/cetak/naskah/${n.id}`,
    })),
  ];
  const awal = (s: SuratTugasSayaRecord) => s.tanggalTugas[0]?.mulai ?? s.tanggal;
  return hasil.sort((a, b) => awal(b).localeCompare(awal(a)));
}
