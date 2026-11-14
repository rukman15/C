import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { WiRecord } from "@/lib/server/types";
import { NotFoundError } from "@/lib/server/errors";
import { jenjangWi } from "@/lib/dokumen";
import { batasEfektif, type BatasJenjang } from "@/lib/kapasitas";
import { bulanSekarang, getBatasJenjang, jpBulanMap } from "@/lib/server/repositories/batas-jp-wi";

/**
 * Widyaiswara = baris `pegawai` yang jabatannya mengandung "WIDYAISWARA".
 * Tabel `staff` sudah dihapus — satu sumber data kepegawaian. Field HR
 * diturunkan dari kolom pegawai; `jpTerpakai` dihitung dari penugasan yang
 * berstatus "disetujui" (tidak disimpan, jadi tidak bisa selisih).
 *
 * Batas JP berlaku PER BULAN: `jpTerpakai` = JP disetujui pada diklat yang mulai
 * di `bulanBeban` (bawaan: bulan berjalan), `jpMaksimal` = batas efektif bulan itu
 * (batas khusus WI, atau batas jenjang dari halaman admin Aturan JP).
 */
const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;

type PegawaiRow = {
  id: string;
  nama: string;
  jabatan: string | null;
  jenisKelamin: string | null;
  tingkatPendidikan: string | null;
  tanggalLahir: Date | null;
  status: string | null;
  jpMaksimal: number | null;
  spesialisasi: string[];
  bio: string | null;
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Bucket umur dari tanggal lahir, relatif ke hari ini. */
function ageGroupFromBirth(tanggalLahir: Date | null): string {
  if (!tanggalLahir) return "Tidak diketahui";
  const age = Math.floor((Date.now() - tanggalLahir.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  return "60+";
}

function toRecord(row: PegawaiRow, jpTerpakai: number, jpTotal: number, batasJenjang: BatasJenjang, bulan: string): WiRecord {
  const e = batasEfektif(row.jpMaksimal, jenjangWi(row.jabatan), batasJenjang);
  return {
    id: row.id,
    name: row.nama,
    role: titleCase(row.jabatan ?? ""),
    unit: "Widyaiswara",
    education: row.tingkatPendidikan ?? "Tidak diketahui",
    ageGroup: ageGroupFromBirth(row.tanggalLahir),
    gender: (row.jenisKelamin ?? "Laki-laki") as WiRecord["gender"],
    // Status pegawai asli bervariasi ("AKTIF", "DIPERBANTUKAN ...", dst) tapi
    // orangnya tetap bertugas; hanya "CUTI" yang dianggap tidak bisa ditugaskan.
    status: (row.status ?? "").toUpperCase() === "CUTI" ? "Cuti" : "Aktif",
    jpTerpakai,
    jpMaksimal: e.batas ?? undefined,
    jpTotal,
    batasSendiri: row.jpMaksimal && row.jpMaksimal > 0 ? row.jpMaksimal : undefined,
    sumberBatas: e.sumber ?? undefined,
    bulanBeban: bulan,
    spesialisasi: row.spesialisasi,
    bio: row.bio ?? undefined,
  };
}

/** Peta instructorId -> total JP dari SEMUA penugasan "disetujui" (sepanjang waktu, untuk info). */
export async function jpTerpakaiMap(ids?: string[]): Promise<Map<string, number>> {
  const groups = await prisma.penugasanApproval.groupBy({
    by: ["instructorId"],
    where: { status: "disetujui", ...(ids ? { instructorId: { in: ids } } : {}) },
    _sum: { jp: true },
  });
  return new Map(
    groups.map((g: { instructorId: string; _sum: { jp: number | null } }) => [
      g.instructorId,
      g._sum.jp ?? 0,
    ]),
  );
}

/** `bulan` "YYYY-MM" menentukan JP terpakai & batas yang dibandingkan; bawaan bulan berjalan. */
export async function listWidyaiswara(bulan: string = bulanSekarang()): Promise<WiRecord[]> {
  const [rows, total, jpBulan, batasJenjang] = await Promise.all([
    prisma.pegawai.findMany({ where: WI_WHERE, orderBy: { no: "asc" } }),
    jpTerpakaiMap(),
    jpBulanMap(bulan),
    getBatasJenjang(),
  ]);
  return rows.map((r: PegawaiRow) => toRecord(r, jpBulan.get(r.id) ?? 0, total.get(r.id) ?? 0, batasJenjang, bulan));
}

/** Undefined kalau id tidak ada ATAU pegawai itu bukan Widyaiswara. */
export async function getWiById(id: string, bulan: string = bulanSekarang()): Promise<WiRecord | undefined> {
  const [row, total, jpBulan, batasJenjang] = await Promise.all([
    prisma.pegawai.findFirst({ where: { id, ...WI_WHERE } }),
    jpTerpakaiMap([id]),
    jpBulanMap(bulan, [id]),
    getBatasJenjang(),
  ]);
  return row ? toRecord(row, jpBulan.get(id) ?? 0, total.get(id) ?? 0, batasJenjang, bulan) : undefined;
}

export type WiPatch = {
  status?: "Aktif" | "Cuti";
  /** Batas khusus per bulan; null = hapus (ikut batas jenjang). */
  jpMaksimal?: number | null;
  spesialisasi?: string[];
  bio?: string;
};

/**
 * Hanya field operasional yang bisa diubah. Data HR (nama, jabatan, dst)
 * bersumber dari Excel/seed. `status: "Cuti"` disimpan sebagai
 * `pegawai.status = "CUTI"`, "Aktif" sebagai "AKTIF".
 */
export async function updateWi(id: string, patch: WiPatch): Promise<WiRecord> {
  const existing = await getWiById(id);
  if (!existing) throw new NotFoundError(`Widyaiswara "${id}" tidak ditemukan`);
  const { status, ...rest } = patch;
  await prisma.pegawai.update({
    where: { id },
    data: { ...rest, ...(status ? { status: status.toUpperCase() } : {}) },
  });
  return (await getWiById(id)) as WiRecord;
}
