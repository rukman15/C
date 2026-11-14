import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { getLembarPenilaian } from "@/lib/server/repositories/penilaian";
import { ttdKepalaBalai } from "@/lib/server/repositories/dokumen";
import type { Penandatangan } from "@/lib/tata-naskah";
import { JABATAN_KEPALA, KOTA_SURAT } from "@/lib/aplikasi";
import { namaProgram } from "@/lib/kurikulum";
import { LABEL_KUALIFIKASI, KUALIFIKASI_URUT, labelEvaluasi, type HasilPeserta } from "@/lib/penilaian";
import { isoTanggal } from "@/lib/tanggal";
import {
  LABEL_SURAT_KETERANGAN,
  susunSuratKeterangan,
  type DataSuratKeterangan,
  type IsiSuratKeterangan,
  type JenisSuratKeterangan,
} from "@/lib/surat-keterangan";
import type { PesertaPenilaianRecord } from "@/lib/server/types";

/**
 * Surat keterangan "ditunda kelulusannya" / "tidak lulus" (BARU). Yang berhak dihitung
 * dari penilaian (Formulir 14): ditunda = hasil evaluasi akhir PERTAMA ditunda; tidak lulus =
 * status akhir tidak lulus. Yang disimpan hanya nomor & tanggal surat — isinya dibaca dari
 * nilai saat dicetak. Kelola: Ketua Diklat/admin; lihat: Kepala Balai, Kabag TU.
 */

export type CalonSuratRecord = {
  pesertaId: string;
  nomorPeserta: number;
  nama: string;
  jenis: JenisSuratKeterangan;
  label: string;
  nilaiAkhir: number | null;
  surat: { id: string; nomor: string | null; tanggal: string } | null;
  /** Surat sudah dibuat tetapi nilai kini tidak lagi menunjukkan status ini. */
  tidakSesuai: boolean;
};
export type DaftarSuratKeteranganRecord = { bolehKelola: boolean; calon: CalonSuratRecord[] };

export type SuratKeteranganRecord = {
  id: string;
  jenis: JenisSuratKeterangan;
  nomor: string | null;
  tanggal: string;
  kota: string;
  trainingName: string;
  pesertaNama: string;
  penandatangan: Penandatangan;
  isi: IsiSuratKeterangan;
};

/** Jenis surat yang berhak diterima peserta menurut hasil penilaiannya. */
export function jenisBerhak(h: HasilPeserta | undefined): JenisSuratKeterangan[] {
  if (!h) return [];
  const out: JenisSuratKeterangan[] = [];
  if (h.statusAwal === "DITUNDA") out.push("DITUNDA");
  if (h.status === "TIDAK_LULUS") out.push("TIDAK_LULUS");
  return out;
}

const minimalBaik = (k: string | null) => k != null && KUALIFIKASI_URUT.indexOf(k as never) <= KUALIFIKASI_URUT.indexOf("BAIK");

/** Evaluasi yang dicantumkan: ditunda = kurang baik pada evaluasi pertama; tidak lulus = di bawah "baik" pada nilai akhir. */
function aspekSurat(jenis: JenisSuratKeterangan, h: HasilPeserta): DataSuratKeterangan["aspek"] {
  return jenis === "DITUNDA"
    ? h.evaluasi
        .filter((e) => e.kualifikasiAwal === "KURANG_BAIK")
        .map((e) => ({ kode: e.kode, label: labelEvaluasi(e.kode), nilai: e.nilai, kualifikasi: LABEL_KUALIFIKASI.KURANG_BAIK }))
    : h.evaluasi
        .filter((e) => !minimalBaik(e.kualifikasi))
        .map((e) => ({ kode: e.kode, label: labelEvaluasi(e.kode), nilai: e.nilaiDipakai, kualifikasi: e.kualifikasi ? LABEL_KUALIFIKASI[e.kualifikasi] : "-" }));
}

async function pesertaDenganHasil(trainingId: string, email: string) {
  const lembar = await getLembarPenilaian(trainingId, { peran: "PENYELENGGARA", email });
  return { training: lembar.training, peserta: lembar.peserta.filter((p) => p.status === "AKTIF") };
}

type SuratRow = { id: string; trainingId: string; pesertaId: string; jenis: string; nomor: string | null; tanggal: Date };

export async function daftarSuratKeterangan(trainingId: string, bolehKelola: boolean, email: string): Promise<DaftarSuratKeteranganRecord> {
  const { peserta } = await pesertaDenganHasil(trainingId, email);
  const surat: SuratRow[] = await prisma.suratKeterangan.findMany({ where: { trainingId } });
  const calon: CalonSuratRecord[] = [];
  const dari = (p: PesertaPenilaianRecord, jenis: JenisSuratKeterangan, berhak: boolean) => {
    const s = surat.find((x) => x.pesertaId === p.id && x.jenis === jenis);
    if (!berhak && !s) return;
    calon.push({
      pesertaId: p.id,
      nomorPeserta: p.nomor,
      nama: p.nama,
      jenis,
      label: LABEL_SURAT_KETERANGAN[jenis],
      nilaiAkhir: p.hasil?.nilaiAkhir ?? null,
      surat: s ? { id: s.id, nomor: s.nomor, tanggal: isoTanggal(s.tanggal) } : null,
      tidakSesuai: !berhak,
    });
  };
  for (const p of peserta) {
    const berhak = jenisBerhak(p.hasil);
    for (const j of ["DITUNDA", "TIDAK_LULUS"] as const) dari(p, j, berhak.includes(j));
  }
  return { bolehKelola, calon };
}

export async function simpanSuratKeterangan(
  trainingId: string,
  input: { pesertaId: string; jenis: JenisSuratKeterangan; nomor?: string | null; tanggal: string },
  email: string,
): Promise<string> {
  const { peserta } = await pesertaDenganHasil(trainingId, email);
  const p = peserta.find((x) => x.id === input.pesertaId);
  if (!p) throw new NotFoundError("Peserta tidak ditemukan");
  const ada: { id: string } | null = await prisma.suratKeterangan.findUnique({
    where: { pesertaId_jenis: { pesertaId: p.id, jenis: input.jenis } },
    select: { id: true },
  });
  // Surat baru hanya untuk yang berhak; surat lama tetap bisa diperbaiki nomor/tanggalnya.
  if (!ada && !jenisBerhak(p.hasil).includes(input.jenis))
    throw new ValidationError(`Menurut penilaian, ${p.nama} tidak berstatus "${LABEL_SURAT_KETERANGAN[input.jenis].toLowerCase()}"`);
  const data = { nomor: input.nomor?.trim() || null, tanggal: new Date(`${input.tanggal}T00:00:00.000Z`) };
  const r: { id: string } = await prisma.suratKeterangan.upsert({
    where: { pesertaId_jenis: { pesertaId: p.id, jenis: input.jenis } },
    update: data,
    create: { ...data, trainingId, pesertaId: p.id, jenis: input.jenis, dibuatOleh: email },
    select: { id: true },
  });
  return r.id;
}

export async function hapusSuratKeterangan(trainingId: string, id: string): Promise<void> {
  const s: SuratRow | null = await prisma.suratKeterangan.findUnique({ where: { id } });
  if (!s || s.trainingId !== trainingId) throw new NotFoundError("Surat keterangan tidak ditemukan");
  await prisma.suratKeterangan.deleteMany({ where: { id } });
}

export async function getSuratKeterangan(id: string, email: string): Promise<SuratKeteranganRecord> {
  const s: SuratRow | null = await prisma.suratKeterangan.findUnique({ where: { id } });
  if (!s) throw new NotFoundError("Surat keterangan tidak ditemukan");
  const jenis = s.jenis as JenisSuratKeterangan;
  const { training: t, peserta } = await pesertaDenganHasil(s.trainingId, email);
  const p = peserta.find((x) => x.id === s.pesertaId);
  if (!p || !p.hasil) throw new NotFoundError("Peserta tidak ditemukan atau tidak aktif");
  if (!jenisBerhak(p.hasil).includes(jenis))
    throw new ConflictError(`Penilaian ${p.nama} kini tidak lagi berstatus "${LABEL_SURAT_KETERANGAN[jenis].toLowerCase()}" — periksa nilai sebelum mencetak`);
  const baris: { jabatan: string | null } | null = await prisma.peserta.findUnique({ where: { id: p.id }, select: { jabatan: true } });
  return {
    id: s.id,
    jenis,
    nomor: s.nomor,
    tanggal: isoTanggal(s.tanggal),
    kota: KOTA_SURAT,
    trainingName: t.name,
    pesertaNama: p.nama,
    penandatangan: await ttdKepalaBalai(JABATAN_KEPALA),
    isi: susunSuratKeterangan({
      jenis,
      program: namaProgram(t.jenisPelatihan, t.angkatan) || t.name,
      mulai: t.startDate.slice(0, 10),
      selesai: t.endDate?.slice(0, 10) ?? null,
      peserta: { nama: p.nama, nip: p.nip ?? null, jabatan: baris?.jabatan ?? null, instansi: p.instansi ?? null },
      aspek: aspekSurat(jenis, p.hasil),
      perluRemedial: p.hasil.perluRemedial,
      perluKeputusanTim: p.hasil.perluKeputusanTim,
    }),
  };
}
