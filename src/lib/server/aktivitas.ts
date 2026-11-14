import "server-only";
import { prisma } from "@/lib/server/prisma";
import { JENIS_AKTIVITAS, batasSimpan, rapikanRingkasan, tautanAktivitas, type JenisAktivitas } from "@/lib/aktivitas";
import { ForbiddenError, kodePrisma } from "@/lib/server/errors";
import { wajibKelolaTraining, type AksesDiklat } from "@/lib/server/akses";

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

/** Catat aktivitas milik satu peserta (diklat & nama diambil dari data peserta). Kegagalan tidak dilempar. */
export async function catatAktivitasPeserta(
  pesertaId: string,
  i: Omit<IsianAktivitas, "trainingId" | "ringkasan"> & { ringkasan: (namaPeserta: string) => string },
): Promise<void> {
  try {
    const p = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: { trainingId: true, nama: true } });
    if (!p) return;
    await catatAktivitas({ ...i, trainingId: p.trainingId, ringkasan: i.ringkasan(p.nama) });
  } catch (e) {
    console.error("[aktivitas] gagal mencatat:", e);
  }
}


export type ButirAktivitas = {
  id: string;
  trainingId: string | null;
  jenis: string;
  label: string;
  ringkasan: string;
  aktorNama: string;
  atasNama: string | null;
  waktu: string;
  tautan: string | null;
};

export type DaftarAktivitas = { siap: boolean; butir: ButirAktivitas[] };

/** Boleh membaca log aktivitas: pengelola diklat (bukan peserta/coach/penguji — mereka punya "Tugas Saya"). */
export function bolehLihatAktivitas(a: AksesDiklat): boolean {
  return a.global || a.wewenang.length > 0 || a.tim.length > 0;
}

export async function daftarAktivitas(a: AksesDiklat, trainingId: string | null, take = 10): Promise<DaftarAktivitas> {
  if (!bolehLihatAktivitas(a)) throw new ForbiddenError();
  const semua = a.global || a.wewenang.length > 0;
  let where: Record<string, unknown>;
  if (trainingId) {
    if (!semua) await wajibKelolaTraining(a, trainingId);
    where = { trainingId };
  } else if (semua) {
    where = {};
  } else {
    const milik: { id: string }[] = await prisma.training.findMany({ where: { timKerjaId: { in: a.timIds } }, select: { id: true } });
    where = { trainingId: { in: milik.map((t) => t.id) } };
  }
  let rows: { id: string; trainingId: string | null; jenis: string; ringkasan: string; aktorNama: string; atasNama: string | null; objekTipe: string | null; objekId: string | null; createdAt: Date }[];
  try {
    rows = await prisma.logAktivitas.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(take, 1), 50) });
  } catch (e) {
    // Migrasi log_aktivitas belum dijalankan: panel menampilkan keterangan, bukan galat.
    if (kodePrisma(e) === "P2021") return { siap: false, butir: [] };
    throw e;
  }
  return {
    siap: true,
    butir: rows.map((r) => ({
      id: r.id,
      trainingId: r.trainingId,
      jenis: r.jenis,
      label: JENIS_AKTIVITAS[r.jenis as JenisAktivitas] ?? r.jenis,
      ringkasan: r.ringkasan,
      aktorNama: r.aktorNama,
      atasNama: r.atasNama,
      waktu: r.createdAt.toISOString(),
      tautan: tautanAktivitas(r),
    })),
  };
}
