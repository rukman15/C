import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { NAMA_LEMBAGA, KOTA_SURAT } from "@/lib/aplikasi";
import { getPengaturanDokumen, pangkatDariNip, penerimaDari, type PenerimaSurat } from "@/lib/server/repositories/dokumen";
import { bawaanSpd, periksaSpd, rapikanRentang, rapikanIsi, type IsianSpd, type RentangTanggal } from "@/lib/persuratan";

/**
 * Surat Perjalanan Dinas (SPD): satu per pegawai per surat tugas BERNOMOR (umum atau mengajar),
 * diterbitkan PPK (Pengaturan Dokumen). Format Lampiran I PMK 113/PMK.05/2012 (lembar I & II).
 * PMK 119/2023 mewajibkan Sistem Elektronik Perjalanan Dinas — SPD di sini konsep cetak untuk
 * balai yang belum memakainya (CATATAN-SURAT-MENYURAT.md G).
 */
export type SumberSpd = "naskah" | "surat-tugas";

type SuratDasar = {
  sumber: SumberSpd;
  sumberId: string;
  label: string;
  nomor: string | null;
  tanggal: string;
  untuk: string[];
  rentang: RentangTanggal[];
  pegawaiIds: string[];
  tempatTujuan: string | null;
};

async function suratDasar(sumber: SumberSpd, id: string): Promise<SuratDasar> {
  if (sumber === "naskah") {
    const n: { jenis: string; nomor: string | null; tanggal: Date; isi: unknown; tanggalTugas: unknown; pegawaiIds: string[]; hal: string } | null =
      await prisma.naskahDinas.findUnique({ where: { id }, select: { jenis: true, nomor: true, tanggal: true, isi: true, tanggalTugas: true, pegawaiIds: true, hal: true } });
    if (!n || n.jenis !== "SURAT_TUGAS") throw new NotFoundError("Surat tugas tidak ditemukan");
    return { sumber, sumberId: id, label: "Surat Tugas", nomor: n.nomor, tanggal: isoTanggal(n.tanggal), untuk: rapikanIsi(n.isi).untuk, rentang: rapikanRentang(n.tanggalTugas), pegawaiIds: n.pegawaiIds, tempatTujuan: null };
  }
  const s: { nomor: string | null; tanggal: Date; untuk: string[]; tanggalTugas: unknown; pegawaiIds: string[]; training: { name: string; tempat: string; startDate: Date; endDate: Date | null } } | null =
    await prisma.suratTugas.findUnique({
      where: { id },
      select: { nomor: true, tanggal: true, untuk: true, tanggalTugas: true, pegawaiIds: true, training: { select: { name: true, tempat: true, startDate: true, endDate: true } } },
    });
  if (!s) throw new NotFoundError("Surat tugas tidak ditemukan");
  const sendiri = rapikanRentang(s.tanggalTugas);
  return {
    sumber,
    sumberId: id,
    label: `Surat Tugas mengajar — ${s.training.name}`,
    nomor: s.nomor,
    tanggal: isoTanggal(s.tanggal),
    untuk: s.untuk,
    rentang: sendiri.length ? sendiri : [{ mulai: isoTanggal(s.training.startDate), selesai: isoTanggal(s.training.endDate ?? s.training.startDate) }],
    pegawaiIds: s.pegawaiIds,
    tempatTujuan: s.training.tempat,
  };
}

export type SpdRecord = IsianSpd & {
  id: string;
  pegawaiId: string;
  pegawai: PenerimaSurat;
  nomor: string | null;
  tanggal: string;
};

export type SetSpdRecord = {
  surat: { sumber: SumberSpd; sumberId: string; label: string; nomor: string | null; tanggal: string; rentang: RentangTanggal[]; penerima: PenerimaSurat[] };
  spd: SpdRecord[];
  ppk: { nama: string; nip: string; pangkat: string };
  instansi: string;
  tempatTerbit: string;
};

type BarisSpd = {
  id: string;
  pegawaiId: string;
  nomor: string | null;
  tanggal: Date;
  tingkatBiaya: string;
  maksud: string;
  alatAngkut: string;
  tempatBerangkat: string;
  tempatTujuan: string;
  tanggalBerangkat: Date;
  tanggalKembali: Date;
  lamaHari: number;
  akun: string;
  keterangan: string;
};

const keSpd = (r: BarisSpd, peta: Map<string, PenerimaSurat>): SpdRecord => ({
  id: r.id,
  pegawaiId: r.pegawaiId,
  pegawai: peta.get(r.pegawaiId) ?? { pegawaiId: r.pegawaiId, nama: "(pegawai tidak ditemukan)", nip: "-", pangkat: "-", jabatan: "-" },
  nomor: r.nomor,
  tanggal: isoTanggal(r.tanggal),
  tingkatBiaya: r.tingkatBiaya,
  maksud: r.maksud,
  alatAngkut: r.alatAngkut,
  tempatBerangkat: r.tempatBerangkat,
  tempatTujuan: r.tempatTujuan,
  tanggalBerangkat: isoTanggal(r.tanggalBerangkat),
  tanggalKembali: isoTanggal(r.tanggalKembali),
  lamaHari: r.lamaHari,
  akun: r.akun,
  keterangan: r.keterangan,
});

/** Surat tugas + SPD para penerimanya + PPK. */
export async function setSpd(sumber: SumberSpd, sumberId: string): Promise<SetSpdRecord> {
  const s = await suratDasar(sumber, sumberId);
  const rows: BarisSpd[] = await prisma.spd.findMany({ where: { sumber, sumberId } });
  const penerima = await penerimaDari([...new Set([...s.pegawaiIds, ...rows.map((r) => r.pegawaiId)])]);
  const peta = new Map(penerima.map((p) => [p.pegawaiId, p]));
  const urut = new Map(s.pegawaiIds.map((id, i) => [id, i]));
  const atur = (await getPengaturanDokumen()).perjalanan;
  return {
    surat: { sumber, sumberId, label: s.label, nomor: s.nomor, tanggal: s.tanggal, rentang: s.rentang, penerima: penerima.filter((p) => s.pegawaiIds.includes(p.pegawaiId)) },
    spd: rows.map((r) => keSpd(r, peta)).sort((a, b) => (urut.get(a.pegawaiId) ?? 999) - (urut.get(b.pegawaiId) ?? 999)),
    ppk: { nama: atur.ppkNama, nip: atur.ppkNip, pangkat: await pangkatDariNip(atur.ppkNip) },
    instansi: NAMA_LEMBAGA,
    tempatTerbit: KOTA_SURAT,
  };
}

const tgl = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** Buat SPD untuk penerima yang belum punya (surat tugas harus sudah bernomor). */
export async function buatSpdSemua(sumber: SumberSpd, sumberId: string, email: string): Promise<SetSpdRecord> {
  const s = await suratDasar(sumber, sumberId);
  if (!s.nomor) throw new ConflictError("Beri nomor surat tugas dulu — SPD diterbitkan berdasarkan surat tugas yang sudah ditandatangani");
  const ada: { pegawaiId: string }[] = await prisma.spd.findMany({ where: { sumber, sumberId }, select: { pegawaiId: true } });
  const sudah = new Set(ada.map((a) => a.pegawaiId));
  const akun = (await getPengaturanDokumen()).perjalanan.akunPerjalanan;
  const isi = bawaanSpd({ untuk: s.untuk, rentang: s.rentang, tempatTujuan: s.tempatTujuan }, akun);
  for (const pegawaiId of s.pegawaiIds.filter((id) => !sudah.has(id))) {
    await prisma.spd.create({
      data: {
        sumber,
        sumberId,
        pegawaiId,
        tanggal: awalHariWib(),
        ...isi,
        tanggalBerangkat: tgl(isi.tanggalBerangkat || s.tanggal),
        tanggalKembali: tgl(isi.tanggalKembali || s.tanggal),
        lamaHari: Math.max(1, isi.lamaHari),
        dibuatOleh: email,
      },
    });
  }
  return setSpd(sumber, sumberId);
}

export type SpdInput = IsianSpd & { nomor?: string | null; tanggal: string };

export async function ubahSpd(id: string, i: SpdInput): Promise<{ sumber: SumberSpd; sumberId: string }> {
  const r: { sumber: string; sumberId: string } | null = await prisma.spd.findUnique({ where: { id }, select: { sumber: true, sumberId: true } });
  if (!r) throw new NotFoundError("SPD tidak ditemukan");
  const galat = periksaSpd(i);
  if (galat.length) throw new ValidationError(galat.join("; "));
  await prisma.spd.update({
    where: { id },
    data: {
      nomor: i.nomor?.trim() || null,
      tanggal: tgl(i.tanggal),
      tingkatBiaya: i.tingkatBiaya,
      maksud: i.maksud,
      alatAngkut: i.alatAngkut,
      tempatBerangkat: i.tempatBerangkat,
      tempatTujuan: i.tempatTujuan,
      tanggalBerangkat: tgl(i.tanggalBerangkat),
      tanggalKembali: tgl(i.tanggalKembali),
      lamaHari: i.lamaHari,
      akun: i.akun,
      keterangan: i.keterangan,
    },
  });
  return { sumber: r.sumber as SumberSpd, sumberId: r.sumberId };
}

export async function hapusSpd(id: string): Promise<void> {
  const { count } = await prisma.spd.deleteMany({ where: { id } });
  if (!count) throw new NotFoundError("SPD tidak ditemukan");
}

export type SuratUntukSpd = { sumber: SumberSpd; sumberId: string; nomor: string; tanggal: string; label: string; jumlahPenerima: number; jumlahSpd: number };

/** Surat tugas BERNOMOR pada satu tahun (umum & mengajar) beserta jumlah SPD-nya. */
export async function daftarSuratUntukSpd(tahun: number): Promise<SuratUntukSpd[]> {
  const rentang = { gte: new Date(Date.UTC(tahun, 0, 1)), lt: new Date(Date.UTC(tahun + 1, 0, 1)) };
  const [naskah, surat, spd] = await Promise.all([
    prisma.naskahDinas.findMany({
      where: { jenis: "SURAT_TUGAS", nomor: { not: null }, tanggal: rentang },
      select: { id: true, nomor: true, tanggal: true, isi: true, pegawaiIds: true },
    }) as Promise<{ id: string; nomor: string | null; tanggal: Date; isi: unknown; pegawaiIds: string[] }[]>,
    prisma.suratTugas.findMany({
      where: { nomor: { not: null }, tanggal: rentang },
      select: { id: true, nomor: true, tanggal: true, pegawaiIds: true, training: { select: { name: true } } },
    }) as Promise<{ id: string; nomor: string | null; tanggal: Date; pegawaiIds: string[]; training: { name: string } }[]>,
    prisma.spd.findMany({ select: { sumber: true, sumberId: true } }) as Promise<{ sumber: string; sumberId: string }[]>,
  ]);
  const hitung = new Map<string, number>();
  for (const s of spd) hitung.set(`${s.sumber}:${s.sumberId}`, (hitung.get(`${s.sumber}:${s.sumberId}`) ?? 0) + 1);
  const out: SuratUntukSpd[] = [
    ...naskah.map((n) => ({
      sumber: "naskah" as const,
      sumberId: n.id,
      nomor: n.nomor ?? "",
      tanggal: isoTanggal(n.tanggal),
      label: rapikanIsi(n.isi).untuk[0]?.slice(0, 120) || "Surat Tugas",
      jumlahPenerima: n.pegawaiIds.length,
      jumlahSpd: hitung.get(`naskah:${n.id}`) ?? 0,
    })),
    ...surat.map((s) => ({
      sumber: "surat-tugas" as const,
      sumberId: s.id,
      nomor: s.nomor ?? "",
      tanggal: isoTanggal(s.tanggal),
      label: `Mengajar — ${s.training.name}`,
      jumlahPenerima: s.pegawaiIds.length,
      jumlahSpd: hitung.get(`surat-tugas:${s.id}`) ?? 0,
    })),
  ];
  return out.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
}
