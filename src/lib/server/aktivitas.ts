import "server-only";
import { prisma } from "@/lib/server/prisma";
import { batasSimpan, rapikanRingkasan, type JenisAktivitas } from "@/lib/aktivitas";

/**
 * Log aktivitas angkatan (EB-039), sama dengan src/lib/server/aktivitas.ts aplikasi lama.
 * Ditulis SETELAH tindakan utama berhasil; gagal mencatat tidak menggagalkan tindakan.
 * Hanya ringkasan pendek: tanpa isi nilai, isi dokumen, atau alasan medis.
 */
export type IsianAktivitas = {
  trainingId?: string | null;
  aktor: { email: string; name: string };
  atasNama?: string | null;
  jenis: JenisAktivitas;
  objekTipe?: "kiriman" | "tugas" | "dokumen" | "penugasan" | "sesi" | null;
  objekId?: string | null;
  ringkasan: string;
};

/** Hapus log yang lebih tua dari masa simpan (2 tahun, TG-5). */
export async function hapusAktivitasLama(now: Date = new Date()): Promise<number> {
  const r = await prisma.logAktivitas.deleteMany({ where: { createdAt: { lt: batasSimpan(now) } } });
  return r.count;
}

export async function catatAktivitas(i: IsianAktivitas): Promise<void> {
  try {
    await prisma.logAktivitas.create({
      data: {
        trainingId: i.trainingId ?? null,
        aktorEmail: i.aktor.email,
        aktorNama: i.aktor.name,
        atasNama: i.atasNama?.trim() || null,
        jenis: i.jenis,
        objekTipe: i.objekTipe ?? null,
        objekId: i.objekId ?? null,
        ringkasan: rapikanRingkasan(i.ringkasan),
      },
    });
    // Pembersihan sesekali (tanpa penjadwal terpisah).
    if (Math.random() < 0.02) await hapusAktivitasLama();
  } catch (e) {
    console.error("[aktivitas] gagal mencatat:", e);
  }
}
