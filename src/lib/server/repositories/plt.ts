import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { catatAudit, AKSI_AUDIT, type Pelaku } from "@/lib/server/audit";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { normalJabatan } from "@/lib/jabatanProfiles";
import {
  PERAN_SEMENTARA_KHUSUS_ADMIN,
  PERAN_TUNGGAL,
  labelSebagai,
  rentangBeririsan,
  statusMenutupAkun,
  statusSementara,
  type JenisSementara,
  type StatusSementara,
} from "@/lib/plt";
import type { UserRole } from "@/lib/roles";

/**
 * Plt/Plh (penugasan sementara). Dikelola admin & kepegawaian; seseorang tidak
 * boleh menetapkan Plt/Plh untuk dirinya sendiri. Penugasan tidak dihapus —
 * hanya dicabut — supaya jejaknya tetap ada.
 */

export type PenugasanSementaraRecord = {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string | null;
  jabatanAsli: string | null;
  jenis: string;
  jabatan: string;
  role: string;
  nomorSk: string;
  mulai: string;
  selesai: string;
  status: StatusSementara;
  sebagai: string;
  punyaAkunAktif: boolean;
  dibuatOleh: string;
};

type Baris = {
  id: string; pegawaiId: string; jenis: string; jabatan: string; role: string; nomorSk: string;
  mulai: Date; selesai: Date; dicabutAt: Date | null; dibuatOleh: string;
};

/** Kunci advisory untuk penetapan Plt/Plh (angka tetap, unik di aplikasi ini). */
const KUNCI_PLT = 420_715_001;

const hariIni = () => isoTanggal(awalHariWib());
const statusDari = (b: Baris, hari: string) =>
  statusSementara({ jenis: b.jenis, jabatan: b.jabatan, mulai: isoTanggal(b.mulai), selesai: isoTanggal(b.selesai), dicabut: !!b.dicabutAt }, hari);

export async function listPenugasanSementara(): Promise<PenugasanSementaraRecord[]> {
  const rows: Baris[] = await prisma.penugasanSementara.findMany({ orderBy: { mulai: "desc" } });
  const ids = [...new Set(rows.map((r) => r.pegawaiId))];
  const [pegawai, akun] = await Promise.all([
    prisma.pegawai.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true, nip: true, jabatan: true } }),
    prisma.akun.findMany({ where: { pegawaiId: { in: ids }, aktif: true }, select: { pegawaiId: true } }),
  ]);
  const pById = new Map<string, { nama: string; nip: string | null; jabatan: string | null }>(
    pegawai.map((p: { id: string; nama: string; nip: string | null; jabatan: string | null }) => [p.id, p]),
  );
  const berakun = new Set(akun.map((a: { pegawaiId: string | null }) => a.pegawaiId));
  const hari = hariIni();
  const URUT: Record<StatusSementara, number> = { BERLAKU: 0, AKAN_DATANG: 1, SELESAI: 2, DICABUT: 3 };
  return rows
    .map((r) => {
      const p = pById.get(r.pegawaiId);
      return {
        id: r.id,
        pegawaiId: r.pegawaiId,
        nama: p?.nama ?? "(pegawai terhapus)",
        nip: p?.nip ?? null,
        jabatanAsli: p?.jabatan ?? null,
        jenis: r.jenis,
        jabatan: r.jabatan,
        role: r.role,
        nomorSk: r.nomorSk,
        mulai: isoTanggal(r.mulai),
        selesai: isoTanggal(r.selesai),
        status: statusDari(r, hari),
        sebagai: labelSebagai(r),
        punyaAkunAktif: berakun.has(r.pegawaiId),
        dibuatOleh: r.dibuatOleh,
      };
    })
    .sort((a, b) => URUT[a.status] - URUT[b.status] || (a.mulai < b.mulai ? 1 : -1));
}

export type BuatPenugasanInput = {
  pegawaiId: string;
  jenis: JenisSementara;
  jabatan: string;
  role: UserRole;
  nomorSk: string;
  mulai: string; // YYYY-MM-DD
  selesai: string;
};

export async function buatPenugasanSementara(
  input: BuatPenugasanInput,
  pelaku: Pelaku & { pegawaiId: string | null; role: UserRole; bertindakPlt: boolean },
): Promise<{ id: string }> {
  const jabatan = input.jabatan.trim().replace(/\s+/g, " ");
  // Pemegang Plt/Plh tidak boleh menetapkan Plt/Plh (mencegah rantai pemberian hak).
  if (pelaku.bertindakPlt) throw new ForbiddenError("Saat bertindak sebagai Plt/Plh, Anda tidak dapat menetapkan Plt/Plh.");
  if (pelaku.role !== "admin" && PERAN_SEMENTARA_KHUSUS_ADMIN.includes(input.role)) {
    throw new ForbiddenError("Plt/Plh dengan peran pimpinan, kepegawaian, atau keuangan hanya dapat ditetapkan Administrator.");
  }
  if (input.mulai > input.selesai) throw new ValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  if (input.selesai < hariIni()) throw new ValidationError("Tanggal selesai sudah lewat.");
  if (pelaku.pegawaiId && pelaku.pegawaiId === input.pegawaiId) {
    throw new ValidationError("Tidak dapat menetapkan Plt/Plh untuk diri sendiri.");
  }

  const p = await prisma.pegawai.findUnique({
    where: { id: input.pegawaiId },
    select: { id: true, nama: true, nip: true, jabatan: true, status: true },
  });
  if (!p) throw new NotFoundError("Pegawai tidak ditemukan.");
  if (statusMenutupAkun(p.status)) throw new ValidationError(`Status pegawai ${p.status}: tidak dapat ditugaskan.`);
  if (p.jabatan && normalJabatan(p.jabatan) === normalJabatan(jabatan)) {
    throw new ValidationError("Pegawai ini sudah menjabat jabatan tersebut secara definitif.");
  }
  const akunAktif = await prisma.akun.count({ where: { pegawaiId: p.id, aktif: true } });
  if (akunAktif === 0) throw new ValidationError("Pegawai ini belum memiliki akun aktif. Buat akunnya dulu di Kelola Akun.");

  // Satu jabatan (dan satu peran pimpinan) hanya boleh dirangkap satu orang pada
  // satu waktu. Cek + simpan dalam satu transaksi berkunci (advisory lock
  // Postgres, lepas otomatis di akhir transaksi) supaya dua permintaan
  // bersamaan tidak sama-sama lolos.
  const rentang = { mulai: input.mulai, selesai: input.selesai };
  let row: { id: string };
  try {
    row = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KUNCI_PLT})`;
        const lain: Baris[] = await tx.penugasanSementara.findMany({ where: { dicabutAt: null } });
        const bentrok = lain.find(
          (b) =>
            (normalJabatan(b.jabatan) === normalJabatan(jabatan) ||
              (PERAN_TUNGGAL.includes(input.role) && b.role === input.role)) &&
            rentangBeririsan(rentang, { mulai: isoTanggal(b.mulai), selesai: isoTanggal(b.selesai) }),
        );
        if (bentrok) {
          throw new ConflictError(
            `${labelSebagai(bentrok)} sudah ditetapkan ${isoTanggal(bentrok.mulai)} s.d. ${isoTanggal(bentrok.selesai)}. Cabut dulu bila akan diganti.`,
          );
        }
        return tx.penugasanSementara.create({
          data: {
            pegawaiId: p.id,
            jenis: input.jenis,
            jabatan,
            role: input.role,
            nomorSk: input.nomorSk.trim(),
            mulai: new Date(`${input.mulai}T00:00:00.000Z`),
            selesai: new Date(`${input.selesai}T00:00:00.000Z`),
            dibuatOleh: pelaku.email,
          },
          select: { id: true },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (e) {
    if (kodePrisma(e) === "P2028") throw new ConflictError("Ada perubahan Plt/Plh bersamaan. Coba simpan lagi.");
    throw e;
  }
  await catatAudit(
    pelaku,
    AKSI_AUDIT.PLT_DIBUAT,
    `${p.nama}${p.nip ? ` (NIP ${p.nip})` : ""}`,
    `${labelSebagai({ jenis: input.jenis, jabatan })} · SK ${input.nomorSk.trim()} · ${input.mulai} s.d. ${input.selesai} · peran ${input.role}`,
  );
  return { id: row.id };
}

export async function cabutPenugasanSementara(id: string, pelaku: Pelaku & { role: UserRole }): Promise<void> {
  const b: Baris | null = await prisma.penugasanSementara.findUnique({ where: { id } });
  if (!b) throw new NotFoundError("Penugasan tidak ditemukan.");
  if (pelaku.role !== "admin" && PERAN_SEMENTARA_KHUSUS_ADMIN.includes(b.role as UserRole)) {
    throw new ForbiddenError("Plt/Plh ini ditetapkan Administrator; pencabutannya juga oleh Administrator.");
  }
  const status = statusDari(b, hariIni());
  if (status === "DICABUT") throw new ConflictError("Penugasan ini sudah dicabut.");
  if (status === "SELESAI") throw new ConflictError("Penugasan ini sudah selesai.");
  await prisma.penugasanSementara.update({ where: { id }, data: { dicabutAt: new Date() } });
  const p = await prisma.pegawai.findUnique({ where: { id: b.pegawaiId }, select: { nama: true } });
  await catatAudit(pelaku, AKSI_AUDIT.PLT_DICABUT, p?.nama ?? b.pegawaiId, labelSebagai(b));
}

/** Penugasan yang SEDANG berlaku untuk seorang pegawai (untuk pilihan "bertindak sebagai"). */
export async function penugasanBerlaku(pegawaiId: string): Promise<{ id: string; role: string; sebagai: string; selesai: string }[]> {
  const rows: Baris[] = await prisma.penugasanSementara.findMany({ where: { pegawaiId, dicabutAt: null } });
  const hari = hariIni();
  return rows
    .filter((r) => statusDari(r, hari) === "BERLAKU")
    .map((r) => ({ id: r.id, role: r.role, sebagai: labelSebagai(r), selesai: isoTanggal(r.selesai) }));
}
