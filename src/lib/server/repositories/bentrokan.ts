import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { sinkronStatusTraining } from "@/lib/server/repositories/training";

/**
 * "Cek bentrokan" (menu Ketua Diklat): satu Widyaiswara yang ditugaskan ke dua
 * pelatihan yang PERIODENYA BERIRISAN.
 *
 * Yang dihitung: penugasan berstatus "menunggu" atau "disetujui" pada pelatihan
 * yang belum "Selesai". Penugasan "ditolak" diabaikan.
 *
 * Aturan tanggal: granularitas HARI (UTC). Training tanpa `endDate` dianggap
 * satu hari (endDate = startDate). Dua periode beririsan kalau
 * aStart <= bEnd && bStart <= aEnd — jadi training yang selesai tanggal 10 dan
 * training lain yang mulai tanggal 10 DIHITUNG bentrok.
 *
 * Tingkat keparahan:
 *  - "pasti"   : kedua penugasan sudah "disetujui"
 *  - "potensi" : minimal salah satu masih "menunggu"
 */
export type BentrokanSisi = {
  approvalId: string;
  trainingId: string;
  trainingName: string;
  status: "menunggu" | "disetujui";
  periode: string;
  startDate: string;
  endDate: string;
};

export type BentrokanRecord = {
  instructorId: string;
  instructorName: string;
  a: BentrokanSisi;
  b: BentrokanSisi;
  /** Rentang irisan, ISO date (YYYY-MM-DD). */
  irisanMulai: string;
  irisanSelesai: string;
  hariBentrok: number;
  tingkat: "pasti" | "potensi";
};

const HARI_MS = 24 * 60 * 60 * 1000;

function hari(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isoHari(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Row = {
  id: string;
  status: string;
  instructor: { id: string; nama: string };
  training: { id: string; name: string; startDate: Date; endDate: Date | null };
};

const SELECT_ROW = {
  id: true,
  status: true,
  instructor: { select: { id: true, nama: true } },
  training: { select: { id: true, name: true, startDate: true, endDate: true } },
} as const;

const WHERE_AKTIF = {
  status: { in: ["menunggu", "disetujui"] },
  training: { status: { not: "Selesai" } },
};

function toSisi(row: Row): BentrokanSisi & { _s: number; _e: number } {
  const s = hari(row.training.startDate);
  const e = row.training.endDate ? Math.max(s, hari(row.training.endDate)) : s;
  return {
    approvalId: row.id,
    trainingId: row.training.id,
    trainingName: row.training.name,
    status: row.status as "menunggu" | "disetujui",
    periode: s === e ? fmt(s) : `${fmt(s)} – ${fmt(e)}`,
    startDate: isoHari(s),
    endDate: isoHari(e),
    _s: s,
    _e: e,
  };
}

/**
 * Satu baris per (WI, pelatihan). Sejak LMS tahap 1 satu WI bisa punya beberapa
 * penugasan pada pelatihan yang sama (satu per mata pelatihan); untuk bentrokan
 * JADWAL itu tetap satu keterlibatan. Yang diwakilkan: penugasan yang sudah
 * disetujui kalau ada, selain itu yang pertama ditemukan.
 */
function satuPerPelatihan(rows: Row[]): Row[] {
  const peta = new Map<string, Row>();
  for (const r of rows) {
    const kunci = `${r.instructor.id}|${r.training.id}`;
    const ada = peta.get(kunci);
    if (!ada || (ada.status !== "disetujui" && r.status === "disetujui")) peta.set(kunci, r);
  }
  return [...peta.values()];
}

function publik(x: ReturnType<typeof toSisi>): BentrokanSisi {
  return {
    approvalId: x.approvalId,
    trainingId: x.trainingId,
    trainingName: x.trainingName,
    status: x.status,
    periode: x.periode,
    startDate: x.startDate,
    endDate: x.endDate,
  };
}

function bandingkan(
  instructor: { id: string; nama: string },
  x: ReturnType<typeof toSisi>,
  y: ReturnType<typeof toSisi>,
): BentrokanRecord | null {
  const mulai = Math.max(x._s, y._s);
  const selesai = Math.min(x._e, y._e);
  if (mulai > selesai) return null;
  return {
    instructorId: instructor.id,
    instructorName: instructor.nama,
    a: publik(x),
    b: publik(y),
    irisanMulai: isoHari(mulai),
    irisanSelesai: isoHari(selesai),
    hariBentrok: Math.round((selesai - mulai) / HARI_MS) + 1,
    tingkat: x.status === "disetujui" && y.status === "disetujui" ? "pasti" : "potensi",
  };
}

/** Semua bentrokan jadwal WI saat ini, "pasti" duluan lalu urut tanggal irisan. */
export async function listBentrokan(): Promise<BentrokanRecord[]> {
  // WHERE_AKTIF menyaring pelatihan yang belum "Selesai" — statusnya disamakan
  // dulu dengan tanggal, supaya pelatihan yang sudah lewat tidak terus muncul.
  await sinkronStatusTraining();
  const rows: Row[] = await prisma.penugasanApproval.findMany({
    where: WHERE_AKTIF,
    select: SELECT_ROW,
  });

  const perWi = new Map<string, Row[]>();
  for (const r of satuPerPelatihan(rows)) {
    const arr = perWi.get(r.instructor.id);
    if (arr) arr.push(r);
    else perWi.set(r.instructor.id, [r]);
  }

  const hasil: BentrokanRecord[] = [];
  for (const list of perWi.values()) {
    const sisi = list.map(toSisi).sort((p, q) => p._s - q._s);
    for (let i = 0; i < sisi.length; i++) {
      for (let j = i + 1; j < sisi.length; j++) {
        // Pelatihan yang sama tidak mungkin muncul dua kali di sini (lihat satuPerPelatihan).
        const b = bandingkan(list[0].instructor, sisi[i], sisi[j]);
        if (b) hasil.push(b);
      }
    }
  }

  return hasil.sort(
    (p, q) =>
      (p.tingkat === q.tingkat ? 0 : p.tingkat === "pasti" ? -1 : 1) ||
      p.irisanMulai.localeCompare(q.irisanMulai) ||
      p.instructorName.localeCompare(q.instructorName, "id"),
  );
}

export type BentrokanKandidat = {
  trainingId: string;
  trainingName: string;
  status: "menunggu" | "disetujui";
  periode: string;
  hariBentrok: number;
};

/**
 * Pratinjau sebelum mengajukan: kalau WI `instructorId` ditugaskan ke
 * `trainingId`, penugasan aktif lain milik WI itu yang periodenya beririsan.
 */
export async function cekKandidat(
  trainingId: string,
  instructorId: string,
): Promise<BentrokanKandidat[]> {
  if (!trainingId || !instructorId) {
    throw new ValidationError("trainingId dan instructorId wajib diisi");
  }
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!training) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  await sinkronStatusTraining();

  const s = hari(training.startDate);
  const e = training.endDate ? Math.max(s, hari(training.endDate)) : s;

  const rows: Row[] = await prisma.penugasanApproval.findMany({
    where: { ...WHERE_AKTIF, instructorId, trainingId: { not: trainingId } },
    select: SELECT_ROW,
  });

  const hasil: BentrokanKandidat[] = [];
  for (const r of satuPerPelatihan(rows)) {
    const sisi = toSisi(r);
    const mulai = Math.max(s, sisi._s);
    const selesai = Math.min(e, sisi._e);
    if (mulai > selesai) continue;
    hasil.push({
      trainingId: sisi.trainingId,
      trainingName: sisi.trainingName,
      status: sisi.status,
      periode: sisi.periode,
      hariBentrok: Math.round((selesai - mulai) / HARI_MS) + 1,
    });
  }
  return hasil;
}
