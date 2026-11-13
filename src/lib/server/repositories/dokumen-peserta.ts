import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { BUCKET_DOKUMEN_PESERTA, hapusBerkas, salinBerkas, tautanUnduh, unggahBerkas } from "@/lib/server/penyimpanan";
import { isiSesuaiTipe } from "@/lib/server/berkas-unggah";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { getJenjang } from "@/lib/kurikulum";
import {
  JENIS_DOKUMEN,
  LABEL_STATUS_DOKUMEN,
  batasBawaan,
  dapatDipakaiUlang,
  dataJenisDokumen,
  dokumenWajib,
  isJalurPendaftaran,
  periksaBerkas,
  periksaKeputusan,
  ringkasDokumen,
  type JalurPendaftaran,
  type JenisDokumen,
  type RingkasDokumen,
  type StatusDokumen,
} from "@/lib/dokumen-peserta";

/**
 * Dokumen persyaratan peserta PKA/PKP (keputusan 14 Okt 2026, CATATAN-DOKUMEN-PESERTA.md).
 *  - Berkas di bucket PRIVAT Supabase Storage; tabel `dokumen_peserta` = metadata + status.
 *  - Wajib dokumen hanya pada jadwal yang batas dokumennya diisi (`training.batasDokumen`):
 *    jadwal lama yang sudah berjalan tidak tiba-tiba mengunci pesertanya.
 *  - Ruang belajar, tes, evaluasi terkunci sampai semua berkas wajib DITERIMA.
 *  - Isi berkas dicek tanda tangan biner-nya (bukan hanya ekstensi/tipe kiriman browser).
 */

export type PeranDokumen = { peran: "PESERTA"; akunId: string } | { peran: "PENYELENGGARA"; akunId: string };

type TrainingDok = { id: string; name: string; startDate: Date; batasDokumen: Date | null; jenisPelatihan: string | null };
type PesertaDok = { id: string; trainingId: string; nomor: number; nama: string; status: string; akunId: string | null; jalurDaftar: string };
type DokRow = {
  id: string;
  pesertaId: string;
  jenis: string;
  status: string;
  path: string;
  namaBerkas: string;
  tipe: string;
  ukuran: number;
  alasan: string | null;
  diunggahPada: Date;
  diverifikasiPada: Date | null;
};

export type ItemDokumen = {
  jenis: JenisDokumen;
  label: string;
  keterangan: string | null;
  sensitif: boolean;
  format: string[];
  status: StatusDokumen;
  labelStatus: string;
  dokumen: { id: string; namaBerkas: string; ukuran: number; diunggahPada: string; alasan: string | null } | null;
  /** Berkas DITERIMA dari diklat lain milik akun yang sama yang bisa dipakai ulang (hanya untuk peserta sendiri). */
  berkasLama: { dokumenId: string; namaBerkas: string; dari: string } | null;
};
export type DokumenPesertaRecord = {
  peserta: { id: string; nomor: number; nama: string; jalur: JalurPendaftaran };
  training: { id: string; name: string };
  /** Batas unggah ("YYYY-MM-DD"); null = jadwal ini tidak mewajibkan dokumen. */
  batas: string | null;
  wajib: boolean;
  ringkas: RingkasDokumen;
  item: ItemDokumen[];
};

const jalurDari = (v: string): JalurPendaftaran => (isJalurPendaftaran(v) ? v : "INSTANSI");

async function trainingDok(id: string): Promise<TrainingDok> {
  const t: TrainingDok | null = await prisma.training.findUnique({
    where: { id },
    select: { id: true, name: true, startDate: true, batasDokumen: true, jenisPelatihan: true },
  });
  if (!t) throw new NotFoundError("Jadwal diklat tidak ditemukan");
  return t;
}

const SELECT_PESERTA = { id: true, trainingId: true, nomor: true, nama: true, status: true, akunId: true, jalurDaftar: true } as const;

async function pesertaDok(pesertaId: string): Promise<PesertaDok> {
  const p: PesertaDok | null = await prisma.peserta.findUnique({ where: { id: pesertaId }, select: SELECT_PESERTA });
  if (!p) throw new NotFoundError("Data peserta tidak ditemukan");
  return p;
}

/** Peserta hanya berkasnya sendiri ("tidak ditemukan" untuk milik orang lain). */
function wajibMilik(p: PesertaDok, siapa: PeranDokumen) {
  if (siapa.peran === "PESERTA" && p.akunId !== siapa.akunId) throw new NotFoundError("Data peserta tidak ditemukan");
}

function itemDari(jalur: JalurPendaftaran, rows: DokRow[]): ItemDokumen[] {
  const wajib = new Set(dokumenWajib(jalur));
  return JENIS_DOKUMEN.filter((j) => wajib.has(j.kode)).map((j) => {
    const d = rows.find((r) => r.jenis === j.kode);
    const status = (d?.status ?? "BELUM") as StatusDokumen;
    return {
      jenis: j.kode,
      label: j.label,
      keterangan: j.keterangan ?? null,
      sensitif: j.sensitif,
      format: [...j.format],
      status,
      labelStatus: LABEL_STATUS_DOKUMEN[status] ?? status,
      dokumen: d ? { id: d.id, namaBerkas: d.namaBerkas, ukuran: d.ukuran, diunggahPada: d.diunggahPada.toISOString(), alasan: d.alasan } : null,
      berkasLama: null,
    };
  });
}

const hariIni = (now: Date) => isoTanggal(awalHariWib(now));
const batasDari = (t: TrainingDok) => (t.batasDokumen ? isoTanggal(t.batasDokumen) : null);

/** Ringkasan dokumen satu peserta; `wajib=false` bila jadwal tidak mewajibkan dokumen. */
export async function statusDokumenPeserta(pesertaId: string, now: Date = new Date()): Promise<{ wajib: boolean; ringkas: RingkasDokumen; batas: string | null }> {
  const p = await pesertaDok(pesertaId);
  const t = await trainingDok(p.trainingId);
  const rows: { jenis: string; status: string }[] = await prisma.dokumenPeserta.findMany({ where: { pesertaId }, select: { jenis: true, status: true } });
  const batas = batasDari(t);
  return { wajib: !!batas && !!getJenjang(t.jenisPelatihan), ringkas: ringkasDokumen(jalurDari(p.jalurDaftar), rows, batas, hariIni(now)), batas };
}

/**
 * Penjaga tes/evaluasi peserta: tolak bila dokumen wajib belum lengkap. Peserta milik akun lain
 * = "tidak ditemukan" (tidak membocorkan bahwa id itu ada).
 */
export async function wajibDokumenLengkap(pesertaId: string, email: string, now: Date = new Date()): Promise<void> {
  const p = await pesertaDok(pesertaId);
  wajibMilik(p, { peran: "PESERTA", akunId: await akunIdDariEmail(email) });
  const s = await statusDokumenPeserta(pesertaId, now);
  if (s.wajib && !s.ringkas.lengkap) throw new ForbiddenError("Lengkapi dokumen persyaratan dulu — ruang belajar terbuka setelah semua berkas diterima penyelenggara");
}

export async function getDokumenPeserta(pesertaId: string, siapa: PeranDokumen, now: Date = new Date()): Promise<DokumenPesertaRecord> {
  const p = await pesertaDok(pesertaId);
  wajibMilik(p, siapa);
  const t = await trainingDok(p.trainingId);
  const rows: DokRow[] = await prisma.dokumenPeserta.findMany({ where: { pesertaId } });
  const jalur = jalurDari(p.jalurDaftar);
  const batas = batasDari(t);
  const item = itemDari(jalur, rows);
  // Peserta: tawarkan berkas yang sudah diterima di diklat lain (SK jabatan, SK pangkat, pas foto).
  if (siapa.peran === "PESERTA") {
    const lama = await berkasLamaAkun(siapa.akunId, pesertaId);
    for (const it of item) if (it.status !== "DITERIMA" && lama.has(it.jenis)) it.berkasLama = lama.get(it.jenis)!;
  }
  return {
    peserta: { id: p.id, nomor: p.nomor, nama: p.nama, jalur },
    training: { id: t.id, name: t.name },
    batas,
    wajib: !!batas,
    ringkas: ringkasDokumen(jalur, rows, batas, hariIni(now)),
    item,
  };
}

/** Berkas DITERIMA yang bisa dipakai ulang, dari peserta lain (diklat lain) milik akun ini — terbaru per jenis. */
async function berkasLamaAkun(akunId: string, kecualiPesertaId: string): Promise<Map<string, { dokumenId: string; namaBerkas: string; dari: string }>> {
  const rows: { id: string; jenis: string; namaBerkas: string; diverifikasiPada: Date | null; peserta: { training: { name: string } } }[] = await prisma.dokumenPeserta.findMany({
    where: { status: "DITERIMA", peserta: { akunId, id: { not: kecualiPesertaId } } },
    select: { id: true, jenis: true, namaBerkas: true, diverifikasiPada: true, peserta: { select: { training: { select: { name: true } } } } },
  });
  const hasil = new Map<string, { dokumenId: string; namaBerkas: string; dari: string; kapan: number }>();
  for (const r of rows) {
    if (!dapatDipakaiUlang(r.jenis)) continue;
    const kapan = r.diverifikasiPada?.getTime() ?? 0;
    const ada = hasil.get(r.jenis);
    if (!ada || kapan > ada.kapan) hasil.set(r.jenis, { dokumenId: r.id, namaBerkas: r.namaBerkas, dari: r.peserta.training.name, kapan });
  }
  return new Map([...hasil].map(([k, v]) => [k, { dokumenId: v.dokumenId, namaBerkas: v.namaBerkas, dari: v.dari }]));
}

/**
 * Pakai berkas dari diklat sebelumnya: salin berkas DITERIMA milik akun yang sama ke peserta ini (status
 * kembali DIUNGGAH — penyelenggara diklat ini tetap memeriksa). Hanya jenis `DAPAT_DIPAKAI_ULANG`.
 */
export async function pakaiBerkasLama(pesertaId: string, jenis: string, dokumenIdSumber: string, siapa: PeranDokumen): Promise<string> {
  if (siapa.peran !== "PESERTA") throw new ForbiddenError();
  const p = await pesertaDok(pesertaId);
  wajibMilik(p, siapa);
  if (p.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  if (!dapatDipakaiUlang(jenis)) throw new ValidationError("Berkas ini harus diunggah baru untuk setiap pelatihan");
  if (!dokumenWajib(jalurDari(p.jalurDaftar)).includes(jenis as JenisDokumen)) throw new ValidationError("Berkas ini tidak diminta untuk jalur pendaftaran Anda");
  const sumber: (DokRow & { peserta: { akunId: string | null } }) | null = await prisma.dokumenPeserta.findUnique({
    where: { id: dokumenIdSumber },
    include: { peserta: { select: { akunId: true } } },
  });
  if (!sumber || sumber.peserta.akunId !== siapa.akunId || sumber.pesertaId === pesertaId) throw new NotFoundError("Berkas lama tidak ditemukan");
  if (sumber.jenis !== jenis || sumber.status !== "DITERIMA") throw new ValidationError("Hanya berkas sejenis yang sudah diterima yang bisa dipakai ulang");
  const lama: DokRow | null = await prisma.dokumenPeserta.findUnique({ where: { pesertaId_jenis: { pesertaId, jenis } } });
  if (lama?.status === "DITERIMA") throw new ConflictError("Berkas ini sudah diterima — hubungi penyelenggara bila perlu diganti");

  const path = `${p.trainingId}/${p.id}/${jenis}-${Date.now()}.${EKS[sumber.tipe] ?? "pdf"}`;
  await salinBerkas(BUCKET_DOKUMEN_PESERTA, sumber.path, path);
  const data = {
    status: "DIUNGGAH",
    path,
    namaBerkas: sumber.namaBerkas,
    tipe: sumber.tipe,
    ukuran: sumber.ukuran,
    alasan: null,
    diunggahOleh: siapa.akunId,
    diunggahPada: new Date(),
    diverifikasiOleh: null,
    diverifikasiPada: null,
  };
  const r: { id: string } = await prisma.dokumenPeserta.upsert({
    where: { pesertaId_jenis: { pesertaId, jenis } },
    update: data,
    create: { ...data, pesertaId, jenis },
    select: { id: true },
  });
  if (lama && lama.path !== path) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, lama.path);
  return r.id;
}

// ------------------------------------------------------------------ UNGGAH

const EKS: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

export async function unggahDokumen(
  pesertaId: string,
  jenis: string,
  berkas: { nama: string; tipe: string; isi: Uint8Array },
  siapa: PeranDokumen,
): Promise<string> {
  const p = await pesertaDok(pesertaId);
  wajibMilik(p, siapa);
  const t = await trainingDok(p.trainingId);
  if (!getJenjang(t.jenisPelatihan)) throw new ValidationError("Dokumen persyaratan hanya untuk pelatihan PKA/PKP");
  if (siapa.peran === "PESERTA" && p.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const nama = berkas.nama.trim().slice(0, 150) || "berkas";
  const galat = periksaBerkas(jenis, { nama, tipe: berkas.tipe, ukuran: berkas.isi.byteLength });
  if (galat) throw new ValidationError(galat);
  if (!isiSesuaiTipe(berkas.isi, berkas.tipe)) throw new ValidationError("Isi berkas tidak sesuai formatnya (berkas rusak atau bukan PDF/JPG/PNG)");
  if (!dokumenWajib(jalurDari(p.jalurDaftar)).includes(jenis as JenisDokumen)) throw new ValidationError("Berkas ini tidak diminta untuk jalur pendaftaran Anda");

  const lama: DokRow | null = await prisma.dokumenPeserta.findUnique({ where: { pesertaId_jenis: { pesertaId, jenis } } });
  if (lama?.status === "DITERIMA" && siapa.peran === "PESERTA") throw new ConflictError("Berkas ini sudah diterima — hubungi penyelenggara bila perlu diganti");

  const path = `${p.trainingId}/${p.id}/${jenis}-${Date.now()}.${EKS[berkas.tipe]}`;
  await unggahBerkas(BUCKET_DOKUMEN_PESERTA, path, berkas.isi, berkas.tipe);
  const data = {
    status: "DIUNGGAH",
    path,
    namaBerkas: nama,
    tipe: berkas.tipe,
    ukuran: berkas.isi.byteLength,
    alasan: null,
    diunggahOleh: siapa.akunId,
    diunggahPada: new Date(),
    diverifikasiOleh: null,
    diverifikasiPada: null,
  };
  const r: { id: string } = await prisma.dokumenPeserta.upsert({
    where: { pesertaId_jenis: { pesertaId, jenis } },
    update: data,
    create: { ...data, pesertaId, jenis },
    select: { id: true },
  });
  if (lama && lama.path !== path) await hapusBerkas(BUCKET_DOKUMEN_PESERTA, lama.path);
  return r.id;
}

// ------------------------------------------------------------------ PENYELENGGARA

export type BarisDokumenJadwal = {
  pesertaId: string;
  nomor: number;
  nama: string;
  status: string;
  jalur: JalurPendaftaran;
  ringkas: RingkasDokumen;
  item: ItemDokumen[];
};
export type DokumenJadwalRecord = {
  training: { id: string; name: string; mulai: string };
  batas: string | null;
  batasBawaan: string;
  peserta: BarisDokumenJadwal[];
  /** Peserta aktif yang dokumennya sudah lengkap. */
  lengkap: number;
  menungguDiperiksa: number;
};

export async function getDokumenJadwal(trainingId: string, now: Date = new Date()): Promise<DokumenJadwalRecord> {
  const t = await trainingDok(trainingId);
  if (!getJenjang(t.jenisPelatihan)) throw new ValidationError("Dokumen persyaratan hanya untuk pelatihan PKA/PKP");
  const peserta: PesertaDok[] = await prisma.peserta.findMany({ where: { trainingId }, orderBy: { nomor: "asc" }, select: SELECT_PESERTA });
  const rows: DokRow[] = peserta.length ? await prisma.dokumenPeserta.findMany({ where: { pesertaId: { in: peserta.map((p) => p.id) } } }) : [];
  const batas = batasDari(t);
  const baris = peserta.map((p) => {
    const milik = rows.filter((r) => r.pesertaId === p.id);
    const jalur = jalurDari(p.jalurDaftar);
    return { pesertaId: p.id, nomor: p.nomor, nama: p.nama, status: p.status, jalur, ringkas: ringkasDokumen(jalur, milik, batas, hariIni(now)), item: itemDari(jalur, milik) };
  });
  const aktif = baris.filter((b) => b.status === "AKTIF");
  return {
    training: { id: t.id, name: t.name, mulai: isoTanggal(t.startDate) },
    batas,
    batasBawaan: batasBawaan(isoTanggal(t.startDate)),
    peserta: baris,
    lengkap: aktif.filter((b) => b.ringkas.lengkap).length,
    menungguDiperiksa: aktif.reduce((s, b) => s + b.ringkas.menunggu.length, 0),
  };
}

async function dokumenDiJadwal(trainingId: string, dokumenId: string): Promise<DokRow & { peserta: PesertaDok }> {
  const d: DokRow | null = await prisma.dokumenPeserta.findUnique({ where: { id: dokumenId } });
  if (!d) throw new NotFoundError("Dokumen tidak ditemukan");
  const p = await pesertaDok(d.pesertaId);
  if (p.trainingId !== trainingId) throw new NotFoundError("Dokumen tidak ditemukan");
  return { ...d, peserta: p };
}

/** Terima / tolak satu berkas. Mengembalikan teks untuk log audit. */
export async function verifikasiDokumen(
  trainingId: string,
  dokumenId: string,
  input: { status: string; alasan?: string | null },
  akunId: string,
): Promise<string> {
  const galat = periksaKeputusan(input.status, input.alasan);
  if (galat) throw new ValidationError(galat);
  const d = await dokumenDiJadwal(trainingId, dokumenId);
  await prisma.dokumenPeserta.update({
    where: { id: d.id },
    data: { status: input.status, alasan: input.status === "DITOLAK" ? input.alasan!.trim() : null, diverifikasiOleh: akunId, diverifikasiPada: new Date() },
  });
  return `${d.peserta.nama} · ${dataJenisDokumen(d.jenis)?.label ?? d.jenis}: ${input.status === "DITERIMA" ? "diterima" : `ditolak (${input.alasan!.trim()})`}`;
}

/** Batas unggah dokumen jadwal; null = tidak mewajibkan dokumen. */
export async function aturBatasDokumen(trainingId: string, tanggal: string | null): Promise<void> {
  const t = await trainingDok(trainingId);
  if (!getJenjang(t.jenisPelatihan)) throw new ValidationError("Dokumen persyaratan hanya untuk pelatihan PKA/PKP");
  await prisma.training.update({ where: { id: trainingId }, data: { batasDokumen: tanggal ? new Date(`${tanggal}T00:00:00.000Z`) : null } });
}

export async function aturJalur(trainingId: string, pesertaId: string, jalur: JalurPendaftaran): Promise<string> {
  const p = await pesertaDok(pesertaId);
  if (p.trainingId !== trainingId) throw new NotFoundError("Peserta tidak ditemukan");
  await prisma.peserta.update({ where: { id: pesertaId }, data: { jalurDaftar: jalur } });
  return p.nama;
}

/** Tautan unduh berjangka satu berkas + teks log audit. */
export async function tautanDokumen(
  dokumenId: string,
  siapa: PeranDokumen,
  trainingId?: string,
): Promise<{ url: string; audit: string; sensitif: boolean }> {
  const d: DokRow | null = await prisma.dokumenPeserta.findUnique({ where: { id: dokumenId } });
  if (!d) throw new NotFoundError("Dokumen tidak ditemukan");
  const p = await pesertaDok(d.pesertaId);
  wajibMilik(p, siapa);
  if (trainingId && p.trainingId !== trainingId) throw new NotFoundError("Dokumen tidak ditemukan");
  const jenis = dataJenisDokumen(d.jenis);
  return {
    url: await tautanUnduh(BUCKET_DOKUMEN_PESERTA, d.path, d.namaBerkas),
    audit: `${p.nama} · ${jenis?.label ?? d.jenis}`,
    sensitif: !!jenis?.sensitif,
  };
}

/** Akun.id dari email sesi. */
export async function akunIdDariEmail(email: string): Promise<string> {
  const a: { id: string } | null = await prisma.akun.findUnique({ where: { email }, select: { id: true } });
  if (!a) throw new ForbiddenError();
  return a.id;
}
