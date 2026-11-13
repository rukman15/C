import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { DiklatSayaRecord, MandiriRecord, RuangBelajarRecord } from "@/lib/server/types";
import { NotFoundError } from "@/lib/server/errors";
import { listSesiPembelajaran } from "@/lib/server/repositories/pembelajaran";
import { getTrainingByIdOrThrow, toTrainingRecord } from "@/lib/server/repositories/training";
import { aturanKehadiran, isStatusKehadiran, rekapKehadiran } from "@/lib/kehadiran";
import { isStatusPeserta, type StatusPeserta } from "@/lib/peserta";
import { labelTipeTahap, tahapKurikulum } from "@/lib/kurikulum";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { tesTerbuka } from "@/lib/server/repositories/tes";
import { evaluasiTertunda } from "@/lib/server/repositories/evaluasi";
import { kelompokUntukPeserta } from "@/lib/server/repositories/kelompok";
import { untukKelompok } from "@/lib/data-pembelajaran";
import { seminarPeserta } from "@/lib/server/repositories/seminar";
import { statusDokumenPeserta } from "@/lib/server/repositories/dokumen-peserta";
import { hariPelatihan, labelPendekTahap, persenHadir, sesiTerdekat, tahapAktif, tugasPeserta } from "@/lib/beranda-peserta";
import { statusTes } from "@/lib/tes";

/**
 * Ruang belajar peserta (BARU). Peserta melihat diklat yang ia ikuti lewat
 * `Peserta.akunId`. Cara akun peserta dibuat/ditautkan BELUM diputuskan; untuk
 * sementara penyelenggara & pimpinan bisa membuka halaman ini sebagai pratinjau.
 */
export type Pembaca = { pratinjau: true } | { pratinjau: false; email: string };

async function akunIdDari(email: string): Promise<string | null> {
  const akun: { id: string } | null = await prisma.akun.findUnique({ where: { email }, select: { id: true } });
  return akun?.id ?? null;
}

const statusPeserta = (s: string): StatusPeserta => (isStatusPeserta(s) ? s : "AKTIF");

/** Bagian "Pembelajaran Mandiri" dari kurikulum (hanya diklat blended). */
export function mandiriDari(jenis: string | null | undefined, mode: string | null | undefined): MandiriRecord | null {
  const t = tahapKurikulum(jenis, mode).find((x) => x.tipe === "MANDIRI");
  if (!t) return null;
  return {
    jp: t.jp,
    hari: t.hari,
    kegiatan: (t.kegiatan ?? []).map((k) => ({ nama: k.nama, jp: k.jp, dinilai: k.dinilai === true })),
  };
}

export async function listDiklatSaya(email: string, now: Date = new Date()): Promise<DiklatSayaRecord[]> {
  const akunId = await akunIdDari(email);
  if (!akunId) return [];
  const rows: { id: string; nomor: number; status: string; trainingId: string }[] = await prisma.peserta.findMany({
    where: { akunId },
    select: { id: true, nomor: true, status: true, trainingId: true },
  });
  const hariIni = isoTanggal(awalHariWib(now));
  const hasil: DiklatSayaRecord[] = [];
  for (const r of rows) {
    const jadwalAsli = await listSesiPembelajaran(r.trainingId);
    // Pengajar & Zoom kelompok e-learning peserta ini menggantikan tautan umum sesi (EB-052).
    const kelEl = await kelompokElearning(r.id);
    const jadwal = { ...jadwalAsli, sesi: jadwalAsli.sesi.map((s) => ({ ...s, ...isiKelompok(s, kelEl) })) };
    const t = toTrainingRecord(await getTrainingByIdOrThrow(jadwal.training.id));
    const catatan: { sesiId: string; status: string }[] = await prisma.kehadiran.findMany({
      where: { pesertaId: r.id },
      select: { sesiId: true, status: true },
    });
    const aturan = aturanKehadiran(t.jenisPelatihan);
    const rekap = rekapKehadiran(
      jadwal.sesi.map((s) => ({ id: s.id, tanggal: s.tanggal, jp: s.jp, bentuk: s.bentuk })),
      catatan,
      aturan,
    );
    const dekat = sesiTerdekat(jadwal.sesi, hariIni);
    const hari = hariPelatihan(t.startDate.slice(0, 10), t.endDate?.slice(0, 10), hariIni);
    const tahap = tahapKurikulum(t.jenisPelatihan, t.modePelatihan).map((x) => ({ kode: x.tipe, hari: x.hari }));
    const iTahap = tahapAktif(tahap, hari, dekat.hariIni[0]?.bentuk);
    const evTertunda = r.status === "AKTIF" && t.status !== "Terjadwal" ? await evaluasiTertunda(r.trainingId, r.id, now) : 0;
    const tugas = r.status === "AKTIF" ? await faktaTugas(r.id, r.trainingId, evTertunda, hariIni, now) : [];
    hasil.push({
      pesertaId: r.id,
      nomor: r.nomor,
      status: statusPeserta(r.status),
      training: t,
      hari,
      kehadiranPersen: persenHadir(rekap),
      tingkatKehadiran: aturan ? rekap.tingkat : null,
      sesiHariIni: dekat.hariIni.map((s) => ({ kegiatan: s.kegiatan, jamMulai: s.jamMulai, bentuk: s.bentuk, jp: s.jp, tautan: s.tautan, pengajar: s.pengajar })),
      sesiBerikutnya: dekat.berikutnya
        ? {
            tanggal: dekat.berikutnya.tanggal,
            jamMulai: dekat.berikutnya.jamMulai,
            kegiatan: dekat.berikutnya.kegiatan,
            bentuk: dekat.berikutnya.bentuk,
            tautan: dekat.berikutnya.tautan,
            pengajar: dekat.berikutnya.pengajar,
          }
        : null,
      mandiri: mandiriDari(t.jenisPelatihan, t.modePelatihan),
      tahapKini: iTahap >= 0 && iTahap < tahap.length ? labelPendekTahap(tahap)[iTahap] : null,
      tesTerbuka: r.status === "AKTIF" ? await tesTerbuka(r.trainingId, r.id, now) : [],
      evaluasiTertunda: evTertunda,
      tahap: tahap.map((x, i) => ({ kode: x.kode, label: labelPendekTahap(tahap)[i] })),
      tahapAktif: iTahap,
      tugas,
    });
  }
  return hasil.sort((a, b) => b.training.startDate.localeCompare(a.training.startDate));
}

/** Fakta checklist tugas satu peserta (dokumen, tes, seminar, evaluasi) → `tugasPeserta`. */
async function faktaTugas(pesertaId: string, trainingId: string, evaluasiTertunda: number, hariIni: string, now: Date) {
  const dok = await statusDokumenPeserta(pesertaId, now).catch(() => null);
  const tes: { id: string; jenis: string; status: string; buka: Date | null; tutup: Date | null }[] = await prisma.tes.findMany({
    where: { trainingId },
    select: { id: true, jenis: true, status: true, buka: true, tutup: true },
  });
  const pengerjaan: { tesId: string; selesai: Date | null }[] = tes.length
    ? await prisma.pengerjaanTes.findMany({ where: { pesertaId, tesId: { in: tes.map((x) => x.id) } }, select: { tesId: true, selesai: true } })
    : [];
  const terisi: number = (await prisma.evaluasiPengajar.count({ where: { pesertaId } })) + (await prisma.evaluasiPenyelenggaraan.count({ where: { pesertaId } }));
  return tugasPeserta(
    {
      pesertaId,
      dokumen: dok?.wajib
        ? {
            lengkap: dok.ringkas.lengkap,
            kurang: dok.ringkas.kurang.length,
            menunggu: dok.ringkas.menunggu.length,
            ditolak: dok.ringkas.ditolak.length,
            sisaHari: dok.ringkas.sisaHari,
          }
        : null,
      tes: tes
        .map((x) => ({ x, st: statusTes(x, now) }))
        .filter(({ x, st }) => st !== "DRAF" && (x.jenis === "PRE" || x.jenis === "POST"))
        .map(({ x, st }) => ({
          jenis: x.jenis as "PRE" | "POST",
          status: st as "TERJADWAL" | "DIBUKA" | "DITUTUP",
          selesai: pengerjaan.some((p) => p.tesId === x.id && !!p.selesai),
          buka: x.buka ? isoTanggal(awalHariWib(x.buka)) : null,
        })),
      evaluasi: { tertunda: evaluasiTertunda, terisi },
      seminar: (await seminarPeserta(pesertaId)).map((s) => ({ jenis: s.jenis, tanggal: s.tanggal, status: s.status })),
    },
    hariIni,
  );
}

export async function getRuangBelajar(pesertaId: string, pembaca: Pembaca, now: Date = new Date()): Promise<RuangBelajarRecord> {
  const p: {
    id: string;
    trainingId: string;
    nomor: number;
    nama: string;
    nip: string | null;
    instansi: string | null;
    status: string;
    akunId: string | null;
    judulAksiPerubahan: string | null;
  } | null = await prisma.peserta.findUnique({ where: { id: pesertaId } });
  // Peserta lain = "tidak ditemukan" (tidak membocorkan bahwa id itu ada).
  if (!p) throw new NotFoundError("Data peserta tidak ditemukan");
  if (!pembaca.pratinjau) {
    const akunId = await akunIdDari(pembaca.email);
    if (!akunId || p.akunId !== akunId) throw new NotFoundError("Data peserta tidak ditemukan");
  }

  const jadwalAsli = await listSesiPembelajaran(p.trainingId);
  const kelEl = await kelompokElearning(p.id);
  const jadwal = { ...jadwalAsli, sesi: jadwalAsli.sesi.map((s) => ({ ...s, ...isiKelompok(s, kelEl) })) };
  const t = toTrainingRecord(await getTrainingByIdOrThrow(jadwal.training.id));
  const catatan: { sesiId: string; status: string }[] = await prisma.kehadiran.findMany({
    where: { pesertaId },
    select: { sesiId: true, status: true },
  });
  const statusSesi = new Map(catatan.map((c) => [c.sesiId, c.status]));
  const aturan = aturanKehadiran(t.jenisPelatihan);

  const hariIniIso = isoTanggal(awalHariWib(now));
  const hari = hariPelatihan(t.startDate.slice(0, 10), t.endDate?.slice(0, 10), hariIniIso);
  const tahapKur = tahapKurikulum(t.jenisPelatihan, t.modePelatihan);
  const bentukHariIni = jadwal.sesi.find((s) => s.tanggal === hariIniIso)?.bentuk;

  return {
    pratinjau: pembaca.pratinjau,
    peserta: {
      id: p.id,
      nomor: p.nomor,
      nama: p.nama,
      nip: p.nip ?? undefined,
      instansi: p.instansi ?? undefined,
      status: statusPeserta(p.status),
      judulAksiPerubahan: p.judulAksiPerubahan?.trim() || undefined,
    },
    training: t,
    hari,
    tahapAktif: tahapAktif(
      tahapKur.map((x) => ({ kode: x.tipe, hari: x.hari })),
      hari,
      bentukHariIni,
    ),
    tahap: tahapKur.map((x) => ({
      nama: x.nama,
      tipe: labelTipeTahap(x.tipe),
      kode: x.tipe,
      jp: x.jp,
      jpSync: x.jpSync,
      jpAsync: x.jpAsync,
      hari: x.hari,
      hariKalender: x.hariKalender,
      kegiatan: x.kegiatan?.map((k) => ({ nama: k.nama, jp: k.jp, jpSync: k.jpSync, jpAsync: k.jpAsync, dinilai: k.dinilai })),
    })),
    mandiri: mandiriDari(t.jenisPelatihan, t.modePelatihan),
    sesi: jadwal.sesi.map((s) => {
      const st = statusSesi.get(s.id);
      return {
        id: s.id,
        tanggal: s.tanggal,
        jamMulai: s.jamMulai,
        kegiatan: s.kegiatan,
        jp: s.jp,
        bentuk: s.bentuk,
        wajibHadir: s.wajibHadir,
        mataPelatihanNama: s.mataPelatihanNama,
        tautan: s.tautan,
        pengajar: s.pengajar,
        kehadiran: isStatusKehadiran(st) ? st : null,
      };
    }),
    rekap: rekapKehadiran(
      jadwal.sesi.map((s) => ({ id: s.id, tanggal: s.tanggal, jp: s.jp, bentuk: s.bentuk })),
      catatan,
      aturan,
    ),
    aturan,
    kelompok: pembaca.pratinjau ? [] : await kelompokUntukPeserta(p.id),
    seminar: await seminarPeserta(p.id),
    dokumen: await ringkasDokumenRuang(p.id, now),
  };
}

async function ringkasDokumenRuang(pesertaId: string, now: Date): Promise<RuangBelajarRecord["dokumen"]> {
  const d = await statusDokumenPeserta(pesertaId, now);
  if (!d.wajib) return null;
  return {
    terkunci: !d.ringkas.lengkap,
    kurang: d.ringkas.kurang.length,
    ditolak: d.ringkas.ditolak.length,
    menunggu: d.ringkas.menunggu.length,
    batas: d.batas,
    sisaHari: d.ringkas.sisaHari,
  };
}

/** Kelompok e-learning seorang peserta (untuk pengajar & Zoom per kelompok, EB-052). */
async function kelompokElearning(pesertaId: string): Promise<string | null> {
  const a = await prisma.anggotaKelompok.findUnique({ where: { pesertaId_jenis: { pesertaId, jenis: "ELEARNING" } }, select: { kelompokId: true } });
  return a?.kelompokId ?? null;
}

const isiKelompok = (s: Parameters<typeof untukKelompok>[0], kelompokId: string | null) => {
  const k = untukKelompok(s, kelompokId);
  return { tautan: k.tautan ?? undefined, pengajar: k.pengajar ?? undefined };
};
