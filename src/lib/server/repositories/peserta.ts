import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { aturanKehadiran, rekapKehadiran, wajibHadir, type AturanKehadiran, type SesiRingkas } from "@/lib/kehadiran";
import { isStatusPeserta, rapikanNip, type PesertaInput, type StatusPeserta } from "@/lib/peserta";
import { isoTanggal } from "@/lib/tanggal";
import { dataSandiSementara } from "@/lib/server/catatan-sandi";
import { buatSandiSementara } from "@/lib/server/sandi-awal";
import { AKSI_AUDIT, catatAudit, type Pelaku } from "@/lib/server/audit";
import type { DaftarPeserta, HasilAkunPeserta, PesertaBaris } from "@/lib/data-peserta";

/**
 * Peserta satu pelatihan. Aturan disalin dari aplikasi lama (repositories/peserta.ts dan
 * akun-peserta.ts): rekap kehadiran dihitung saat dibaca; tambah banyak = semua atau tidak sama
 * sekali; hapus hanya yang belum punya catatan kehadiran/nilai.
 */
type Baris = { id: string; trainingId: string; nomor: number; nama: string; nip: string | null; jabatan: string | null; instansi: string | null; status: string; catatan: string | null; akunId: string | null };
type Hadir = { sesiId: string; pesertaId: string; status: string };

function keBaris(r: Baris, sesi: SesiRingkas[], catatan: Hadir[], aturan: AturanKehadiran | null): PesertaBaris {
  return {
    id: r.id,
    nomor: r.nomor,
    nama: r.nama,
    nip: r.nip ?? undefined,
    jabatan: r.jabatan ?? undefined,
    instansi: r.instansi ?? undefined,
    status: (isStatusPeserta(r.status) ? r.status : "AKTIF") as StatusPeserta,
    catatan: r.catatan ?? undefined,
    punyaAkun: !!r.akunId,
    rekap: rekapKehadiran(sesi, catatan, aturan),
  };
}

async function training(id: string) {
  const t = await prisma.training.findUnique({ where: { id }, select: { id: true, name: true, jenisPelatihan: true } });
  if (!t) throw new NotFoundError(`Training "${id}" tidak ditemukan`);
  return t;
}

export async function listPeserta(trainingId: string): Promise<DaftarPeserta> {
  const t = await training(trainingId);
  const aturan = aturanKehadiran(t.jenisPelatihan);
  const [rows, sesiRows, hadirRows] = await Promise.all([
    prisma.peserta.findMany({ where: { trainingId }, orderBy: [{ nomor: "asc" }, { nama: "asc" }] }),
    prisma.sesiPembelajaran.findMany({ where: { trainingId }, select: { id: true, tanggal: true, jp: true, bentuk: true } }),
    prisma.kehadiran.findMany({ where: { sesi: { trainingId } }, select: { sesiId: true, pesertaId: true, status: true } }),
  ]);
  const sesi = sesiRows.map((s) => ({ id: s.id, tanggal: isoTanggal(s.tanggal), jp: s.jp, bentuk: s.bentuk }));
  const perPeserta = new Map<string, Hadir[]>();
  for (const h of hadirRows) perPeserta.set(h.pesertaId, [...(perPeserta.get(h.pesertaId) ?? []), h]);
  return {
    peserta: rows.map((r) => keBaris(r, sesi, perPeserta.get(r.id) ?? [], aturan)),
    aturan,
    jumlahSesiWajib: sesi.filter((s) => wajibHadir(s.bentuk)).length,
  };
}

const kosongKeNull = (v: string | null | undefined) => v?.trim() || null;
function bacaNip(teks: string | null | undefined, label: string): string | null {
  const { nip, galat } = rapikanNip(teks);
  if (galat) throw new ValidationError(`${label}: ${galat}`);
  return nip;
}
const PESAN_NIP_KEMBAR = "NIP sudah terdaftar pada pelatihan ini";

export async function tambahPeserta(trainingId: string, inputs: PesertaInput[]): Promise<number> {
  if (inputs.length === 0) throw new ValidationError("Tidak ada peserta untuk disimpan");
  await training(trainingId);
  const bersih = inputs.map((p, i) => {
    const nama = p.nama.trim();
    if (!nama) throw new ValidationError(`Peserta ke-${i + 1}: nama wajib diisi`);
    return { nama, nip: bacaNip(p.nip, `Peserta ke-${i + 1} (${nama})`), jabatan: kosongKeNull(p.jabatan), instansi: kosongKeNull(p.instansi) };
  });
  const nipKiriman = bersih.map((p) => p.nip).filter((n): n is string => n !== null);
  const kembar = nipKiriman.find((n, i) => nipKiriman.indexOf(n) !== i);
  if (kembar) throw new ValidationError(`NIP ${kembar} muncul lebih dari sekali`);
  const ada = await prisma.peserta.findMany({ where: { trainingId }, select: { nomor: true, nip: true, nama: true } });
  const sudah = ada.filter((a) => a.nip !== null && nipKiriman.includes(a.nip));
  if (sudah.length > 0) {
    const daftar = sudah.slice(0, 5).map((a) => `${a.nama} (${a.nip})`).join(", ");
    throw new ConflictError(`${PESAN_NIP_KEMBAR}: ${daftar}${sudah.length > 5 ? `, dan ${sudah.length - 5} lainnya` : ""}`);
  }
  let nomor = ada.reduce((m, a) => Math.max(m, a.nomor), 0);
  try {
    await prisma.$transaction(bersih.map((p) => prisma.peserta.create({ data: { trainingId, nomor: ++nomor, ...p } })));
  } catch (e) {
    if (kodePrisma(e) === "P2002") throw new ConflictError(PESAN_NIP_KEMBAR);
    if (kodePrisma(e) === "P2003") throw new NotFoundError("Jadwal diklat ini sudah tidak ada");
    throw e;
  }
  return bersih.length;
}

export type UbahPeserta = { nama?: string; nip?: string | null; jabatan?: string | null; instansi?: string | null; nomor?: number; status?: string; catatan?: string | null };

export async function ubahPeserta(id: string, patch: UbahPeserta): Promise<void> {
  const lama = await prisma.peserta.findUnique({ where: { id } });
  if (!lama) throw new NotFoundError(`Peserta "${id}" tidak ditemukan`);
  const data: Record<string, unknown> = {};
  if (patch.nama !== undefined) {
    const nama = patch.nama.trim();
    if (!nama) throw new ValidationError("Nama wajib diisi");
    data.nama = nama;
  }
  if (patch.nip !== undefined) {
    const nip = bacaNip(patch.nip, "NIP");
    if (nip && nip !== lama.nip && (await prisma.peserta.count({ where: { trainingId: lama.trainingId, nip, id: { not: id } } })) > 0) {
      throw new ConflictError(PESAN_NIP_KEMBAR);
    }
    data.nip = nip;
  }
  if (patch.jabatan !== undefined) data.jabatan = kosongKeNull(patch.jabatan);
  if (patch.instansi !== undefined) data.instansi = kosongKeNull(patch.instansi);
  if (patch.catatan !== undefined) data.catatan = kosongKeNull(patch.catatan);
  if (patch.nomor !== undefined) data.nomor = patch.nomor;
  if (patch.status !== undefined) {
    if (!isStatusPeserta(patch.status)) throw new ValidationError(`Status peserta "${patch.status}" tidak dikenal`);
    data.status = patch.status;
  }
  if (Object.keys(data).length === 0) throw new ValidationError("Tidak ada perubahan yang dikirim");
  try {
    await prisma.peserta.update({ where: { id }, data });
  } catch (e) {
    if (kodePrisma(e) === "P2002") throw new ConflictError(PESAN_NIP_KEMBAR);
    if (kodePrisma(e) === "P2025") throw new NotFoundError(`Peserta "${id}" tidak ditemukan`);
    throw e;
  }
}

export async function hapusPeserta(id: string): Promise<void> {
  if (!(await prisma.peserta.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError(`Peserta "${id}" tidak ditemukan`);
  const [tercatat, bernilai] = await Promise.all([prisma.kehadiran.count({ where: { pesertaId: id } }), prisma.nilaiPeserta.count({ where: { pesertaId: id } })]);
  if (tercatat > 0 || bernilai > 0) {
    throw new ConflictError(
      `Peserta ini sudah punya ${[tercatat > 0 && "catatan kehadiran", bernilai > 0 && "nilai"].filter(Boolean).join(" dan ")}, jadi tidak bisa dihapus. Ubah statusnya menjadi mengundurkan diri atau diberhentikan.`,
    );
  }
  await prisma.peserta.deleteMany({ where: { id } });
}

/** Satu NIP = satu akun lintas angkatan; email sintetis `<NIP>@peserta.invalid`. */
const emailPeserta = (nip: string) => `${nip}@peserta.invalid`;

/**
 * Buat/tautkan akun login peserta (sama dengan buatAkunPeserta aplikasi lama): pegawai balai memakai akun
 * pegawainya; pendaftar mandiri memakai akun registrasinya; alumni memakai akun lamanya; selain itu akun
 * baru dengan kata sandi sementara acak (tampil sekali, wajib diganti, catatannya terenkripsi).
 */
export async function buatAkunPeserta(trainingId: string, pesertaIds: string[] | null, pelaku: Pelaku): Promise<HasilAkunPeserta> {
  const t = await training(trainingId);
  const rows = await prisma.peserta.findMany({
    where: { trainingId, ...(pesertaIds ? { id: { in: pesertaIds } } : {}) },
    select: { id: true, nama: true, nip: true, status: true, akunId: true },
    orderBy: { nomor: "asc" },
  });
  if (pesertaIds && rows.length !== new Set(pesertaIds).size) throw new ValidationError("Ada peserta yang bukan bagian jadwal ini");
  const hasil: HasilAkunPeserta = { dibuat: [], ditautkan: [], dilewati: [] };

  for (const p of rows) {
    if (p.akunId) continue;
    if (p.status !== "AKTIF") {
      hasil.dilewati.push({ pesertaId: p.id, nama: p.nama, alasan: "status bukan aktif" });
      continue;
    }
    const { nip } = rapikanNip(p.nip);
    if (!nip || nip.length !== 18) {
      hasil.dilewati.push({ pesertaId: p.id, nama: p.nama, alasan: "NIP belum diisi (login memakai NIP 18 angka)" });
      continue;
    }
    const tautkan = async (akunId: string, keterangan: string) => {
      await prisma.peserta.update({ where: { id: p.id }, data: { akunId } });
      hasil.ditautkan.push({ pesertaId: p.id, nama: p.nama, keterangan });
    };
    const pegawai = await prisma.pegawai.findUnique({ where: { nip }, select: { id: true } });
    if (pegawai) {
      const akunPeg = await prisma.akun.findFirst({ where: { pegawaiId: pegawai.id, aktif: true }, select: { id: true } });
      if (akunPeg) await tautkan(akunPeg.id, "pegawai balai — memakai akun pegawainya");
      else hasil.dilewati.push({ pesertaId: p.id, nama: p.nama, alasan: "pegawai balai tanpa akun aktif — buat di Kelola Akun" });
      continue;
    }
    const reg = await prisma.profilPeserta.findUnique({ where: { nip }, select: { akunId: true, status: true } });
    if (reg) {
      await tautkan(reg.akunId, reg.status === "MENUNGGU" ? "akun registrasi — masih menunggu persetujuan (Registrasi Peserta)" : "akun registrasi mandiri dipakai");
      continue;
    }
    const email = emailPeserta(nip);
    const lama = await prisma.akun.findUnique({ where: { email }, select: { id: true, aktif: true } });
    if (lama) {
      await tautkan(lama.id, lama.aktif ? "akun lama (angkatan sebelumnya) dipakai lagi" : "akun lama NONAKTIF — aktifkan di Kelola Akun");
      continue;
    }
    const sandi = buatSandiSementara();
    try {
      const akun = await prisma.akun.create({ data: { email, name: p.nama, role: "peserta", pegawaiId: null, aktif: true, ...dataSandiSementara(sandi) }, select: { id: true } });
      await prisma.peserta.update({ where: { id: p.id }, data: { akunId: akun.id } });
      hasil.dibuat.push({ pesertaId: p.id, nama: p.nama, nip, sandiSementara: sandi });
    } catch (e) {
      if (kodePrisma(e) === "P2002") hasil.dilewati.push({ pesertaId: p.id, nama: p.nama, alasan: "akun dengan NIP ini baru saja dibuat — ulangi" });
      else throw e;
    }
  }
  if (hasil.dibuat.length || hasil.ditautkan.length) {
    await catatAudit(pelaku, AKSI_AUDIT.AKUN_PESERTA, t.name, `${hasil.dibuat.length} akun baru, ${hasil.ditautkan.length} ditautkan${hasil.dilewati.length ? `, ${hasil.dilewati.length} dilewati` : ""}`);
  }
  return hasil;
}
