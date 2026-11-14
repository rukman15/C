import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { AKSI_AUDIT, catatAudit, type Pelaku } from "@/lib/server/audit";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { jenjangWi, rentangBulan, type JenjangWi } from "@/lib/dokumen";
import { BATAS_JENJANG_KOSONG, batasEfektif, type BatasJenjang, type SumberBatas } from "@/lib/kapasitas";

/**
 * Batas JP Widyaiswara PER BULAN — diatur manual oleh admin di halaman Aturan JP.
 * Aturannya (urutan prioritas) ada di `batasEfektif` (@/lib/kapasitas.ts).
 */

const SINGLETON_ID = "singleton";
const WI_WHERE = { jabatan: { contains: "WIDYAISWARA", mode: "insensitive" } } as const;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Bulan berjalan (WIB), "YYYY-MM". */
export function bulanSekarang(): string {
  return isoTanggal(awalHariWib()).slice(0, 7);
}

type BarisBatas = {
  batasWiPertama: number | null;
  batasWiMuda: number | null;
  batasWiMadya: number | null;
  batasWiUtama: number | null;
};

/** Batas per jenjang. Baris pengaturan belum ada = semua kosong (tidak menulis apa pun). */
export async function getBatasJenjang(): Promise<BatasJenjang> {
  const r: BarisBatas | null = await prisma.pengaturanJp.findUnique({ where: { id: SINGLETON_ID } });
  if (!r) return { ...BATAS_JENJANG_KOSONG };
  return {
    pertama: r.batasWiPertama ?? null,
    muda: r.batasWiMuda ?? null,
    madya: r.batasWiMadya ?? null,
    utama: r.batasWiUtama ?? null,
  };
}

/**
 * JP penugasan DISETUJUI per WI pada diklat yang mulai di `bulan` ("YYYY-MM").
 * `ids` membatasi WI yang dihitung (kosong/undefined = semua).
 */
export async function jpBulanMap(bulan: string, ids?: string[]): Promise<Map<string, number>> {
  const r = rentangBulan(bulan);
  const rows: { instructorId: string; jp: number }[] = await prisma.penugasanApproval.findMany({
    where: {
      status: "disetujui",
      ...(ids ? { instructorId: { in: ids } } : {}),
      training: { startDate: { gte: utc(r.awal), lt: utc(r.akhirEksklusif) } },
    },
    select: { instructorId: true, jp: true },
  });
  const m = new Map<string, number>();
  for (const x of rows) m.set(x.instructorId, (m.get(x.instructorId) ?? 0) + x.jp);
  return m;
}

export type BatasJpWiRecord = {
  bulan: string;
  jenjang: BatasJenjang;
  diubahOleh: string | null;
  updatedAt: string | null;
  wi: {
    id: string;
    no: number | null;
    nama: string;
    jabatan: string;
    jenjang: JenjangWi | null;
    cuti: boolean;
    /** Batas khusus WI ini (pegawai.jpMaksimal); null = ikut jenjang. */
    batasSendiri: number | null;
    batas: number | null;
    sumber: SumberBatas | null;
    /** JP disetujui pada diklat yang mulai di `bulan`. */
    jpBulan: number;
  }[];
};

/** Isi halaman admin: batas jenjang + semua WI (urutan resmi) dengan batas efektif & JP bulan ini. */
export async function listBatasJpWi(bulan: string): Promise<BatasJpWiRecord> {
  const [pengaturan, wi, jp]: [
    (BarisBatas & { diubahOleh: string | null; updatedAt: Date }) | null,
    { id: string; no: number | null; nama: string; jabatan: string | null; status: string | null; jpMaksimal: number | null }[],
    Map<string, number>,
  ] = await Promise.all([
    prisma.pengaturanJp.findUnique({ where: { id: SINGLETON_ID } }),
    prisma.pegawai.findMany({
      where: WI_WHERE,
      select: { id: true, no: true, nama: true, jabatan: true, status: true, jpMaksimal: true },
      orderBy: { no: "asc" },
    }),
    jpBulanMap(bulan),
  ]);
  const jenjang: BatasJenjang = pengaturan
    ? {
        pertama: pengaturan.batasWiPertama ?? null,
        muda: pengaturan.batasWiMuda ?? null,
        madya: pengaturan.batasWiMadya ?? null,
        utama: pengaturan.batasWiUtama ?? null,
      }
    : { ...BATAS_JENJANG_KOSONG };
  return {
    bulan,
    jenjang,
    diubahOleh: pengaturan?.diubahOleh ?? null,
    updatedAt: pengaturan?.updatedAt ? pengaturan.updatedAt.toISOString() : null,
    wi: wi.map((w) => {
      const j = jenjangWi(w.jabatan);
      const e = batasEfektif(w.jpMaksimal, j, jenjang);
      return {
        id: w.id,
        no: w.no,
        nama: w.nama,
        jabatan: w.jabatan ?? "",
        jenjang: j,
        cuti: (w.status ?? "").toUpperCase() === "CUTI",
        batasSendiri: w.jpMaksimal && w.jpMaksimal > 0 ? w.jpMaksimal : null,
        batas: e.batas,
        sumber: e.sumber,
        jpBulan: jp.get(w.id) ?? 0,
      };
    }),
  };
}

export type SimpanBatasInput = {
  jenjang?: Partial<BatasJenjang>;
  /** Batas khusus per WI; null = hapus (kembali ikut jenjang). */
  wi?: { id: string; batas: number | null }[];
};

const KOLOM_JENJANG: Record<JenjangWi, keyof BarisBatas> = {
  pertama: "batasWiPertama",
  muda: "batasWiMuda",
  madya: "batasWiMadya",
  utama: "batasWiUtama",
};
const tampil = (v: number | null) => (v === null ? "kosong" : String(v));
const sahBatas = (v: number | null) => v === null || (Number.isInteger(v) && v >= 1);

/**
 * Simpan batas jenjang dan/atau batas khusus WI sekaligus. Hanya yang benar-benar berubah
 * yang ditulis dan dicatat di Log Audit. Mengembalikan jumlah perubahan.
 */
export async function simpanBatasJpWi(input: SimpanBatasInput, pelaku: Pelaku): Promise<number> {
  const daftar = input.wi ?? [];
  const nilaiJenjang = Object.entries(input.jenjang ?? {}).filter(([, v]) => v !== undefined) as [JenjangWi, number | null][];
  if ([...nilaiJenjang.map(([, v]) => v), ...daftar.map((x) => x.batas)].some((v) => !sahBatas(v))) {
    throw new ValidationError("Batas JP harus bilangan bulat ≥ 1 atau dikosongkan");
  }

  const rincian: string[] = [];

  // 1. Batas per jenjang
  const sekarang = await getBatasJenjang();
  const data: Partial<Record<keyof BarisBatas, number | null>> = {};
  for (const [j, v] of nilaiJenjang) {
    if (!(j in KOLOM_JENJANG) || sekarang[j] === v) continue;
    data[KOLOM_JENJANG[j]] = v;
    rincian.push(`Jenjang ${j}: ${tampil(sekarang[j])} → ${tampil(v)}`);
  }

  // 2. Batas khusus WI
  const perWi = new Map(daftar.map((x) => [x.id, x.batas])); // id ganda: yang terakhir berlaku
  const ubahWi: { id: string; batas: number | null }[] = [];
  if (perWi.size > 0) {
    const ids = [...perWi.keys()];
    const ada: { id: string; nama: string; jpMaksimal: number | null }[] = await prisma.pegawai.findMany({
      where: { id: { in: ids }, ...WI_WHERE },
      select: { id: true, nama: true, jpMaksimal: true },
    });
    const kenal = new Map(ada.map((x) => [x.id, x]));
    const asing = ids.filter((id) => !kenal.has(id));
    if (asing.length > 0) throw new NotFoundError(`Widyaiswara tidak ditemukan: ${asing.join(", ")}`);
    for (const [id, batas] of perWi) {
      const w = kenal.get(id)!;
      const lama = w.jpMaksimal && w.jpMaksimal > 0 ? w.jpMaksimal : null;
      if (lama === batas) continue;
      ubahWi.push({ id, batas });
      rincian.push(`${w.nama}: ${lama ?? "ikut jenjang"} → ${batas ?? "ikut jenjang"}`);
    }
  }

  if (rincian.length === 0) return 0;
  await prisma.pengaturanJp.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data, diubahOleh: pelaku.email },
    update: { ...data, diubahOleh: pelaku.email },
  });
  // Satu UPDATE per WI yang berubah — jumlahnya kecil (puluhan) dan sengaja tanpa transaksi
  // interaktif (batas waktu 5 detik Prisma mudah terlewati di Supabase, lihat urut-pegawai.ts).
  for (const x of ubahWi) {
    await prisma.pegawai.update({ where: { id: x.id }, data: { jpMaksimal: x.batas } });
  }
  await catatAudit(pelaku, AKSI_AUDIT.BATAS_JP_WI, "Batas JP per bulan", rincian.join("; "));
  return rincian.length;
}
