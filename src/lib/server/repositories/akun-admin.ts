import "server-only";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { catatAudit, AKSI_AUDIT, type Pelaku } from "@/lib/server/audit";
import { bacaCatatanSandi, dataSandiSementara } from "@/lib/server/catatan-sandi";
import { buatSandiSementara } from "@/lib/server/sandi-awal";
import { roleProfiles, type UserRole } from "@/lib/roles";
import { statusMenutupAkun } from "@/lib/plt";
import { awalHariWib } from "@/lib/tanggal";

export { buatSandiSementara };

/**
 * Kelola Akun (khusus admin): daftar akun, buat akun, aktif/nonaktif, reset
 * kata sandi sementara, ubah peran. Semua perubahan dicatat di log audit.
 *
 * Kata sandi sementara tampil sekali setelah dibuat dan tetap bisa dilihat admin di
 * Catatan sandi awal sampai pemiliknya menggantinya (EB-040). Pemilik wajib
 * menggantinya saat masuk — ditegakkan di server.
 */

const LABEL_PERAN = new Map(roleProfiles.map((p) => [p.id, p.label]));
const labelPeran = (r: string) => LABEL_PERAN.get(r as UserRole) ?? r;

export type AkunAdminRecord = {
  id: string;
  email: string;
  name: string;
  role: string;
  aktif: boolean;
  wajibGantiSandi: boolean;
  pegawaiId: string | null;
  nip: string | null;
  jabatan: string | null;
  statusPegawai: string | null;
  /** Registrasi mandiri yang belum diputuskan (diputuskan di halaman Registrasi Peserta). */
  menungguRegistrasi: boolean;
  updatedAt: string;
};

export type PegawaiTanpaAkunRecord = { id: string; nama: string; nip: string | null; jabatan: string | null };

export async function listAkunAdmin(): Promise<{ akun: AkunAdminRecord[]; pegawaiTanpaAkun: PegawaiTanpaAkunRecord[] }> {
  const [akun, pegawai, menunggu] = await Promise.all([
    prisma.akun.findMany({
      select: { id: true, email: true, name: true, role: true, aktif: true, wajibGantiSandi: true, pegawaiId: true, updatedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.pegawai.findMany({
      select: { id: true, nama: true, nip: true, jabatan: true, status: true },
      orderBy: { nama: "asc" },
    }),
    prisma.profilPeserta.findMany({ where: { status: "MENUNGGU" }, select: { akunId: true } }),
  ]);
  const akunMenunggu = new Set(menunggu.map((m: { akunId: string }) => m.akunId));
  const pegawaiById = new Map<string, (typeof pegawai)[number]>(pegawai.map((p: (typeof pegawai)[number]) => [p.id, p]));
  const punyaAkun = new Set(akun.map((a: { pegawaiId: string | null }) => a.pegawaiId).filter(Boolean));
  return {
    akun: akun.map((a: (typeof akun)[number]) => {
      const p = a.pegawaiId ? pegawaiById.get(a.pegawaiId) : undefined;
      return {
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        aktif: a.aktif,
        wajibGantiSandi: a.wajibGantiSandi === true,
        pegawaiId: a.pegawaiId,
        nip: p?.nip ?? null,
        jabatan: p?.jabatan ?? null,
        statusPegawai: p ? (p.status ?? "AKTIF") : null,
        menungguRegistrasi: akunMenunggu.has(a.id),
        updatedAt: a.updatedAt.toISOString(),
      };
    }),
    pegawaiTanpaAkun: pegawai
      .filter((p: (typeof pegawai)[number]) => !punyaAkun.has(p.id) && !statusMenutupAkun(p.status))
      .map((p: (typeof pegawai)[number]) => ({ id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan })),
  };
}

export type BuatAkunInput =
  | { pegawaiId: string; role: UserRole; email?: string | null }
  | { pegawaiId?: null; role: UserRole; email: string; nama: string };

export async function buatAkun(input: BuatAkunInput, pelaku: Pelaku): Promise<{ id: string; sandiSementara: string }> {
  let email: string;
  let name: string;
  let pegawaiId: string | null = null;
  let sasaran: string;

  if (input.pegawaiId) {
    const p = await prisma.pegawai.findUnique({
      where: { id: input.pegawaiId },
      select: { id: true, nama: true, nip: true, status: true },
    });
    if (!p) throw new NotFoundError("Pegawai tidak ditemukan.");
    if (statusMenutupAkun(p.status)) throw new ValidationError(`Status pegawai ${p.status}: akun tidak dapat dibuat.`);
    if (!p.nip) throw new ValidationError("Pegawai ini belum memiliki NIP; login memakai NIP.");
    const ada = await prisma.akun.count({ where: { pegawaiId: p.id } });
    if (ada > 0) throw new ConflictError("Pegawai ini sudah memiliki akun.");
    pegawaiId = p.id;
    name = p.nama;
    email = (input.email?.trim().toLowerCase() || `${p.id}@pegawai.invalid`);
    sasaran = `${p.nama} (NIP ${p.nip})`;
  } else {
    const lain = input as { email: string; nama: string };
    email = lain.email.trim().toLowerCase();
    name = lain.nama.trim();
    if (!name) throw new ValidationError("Nama wajib diisi.");
    sasaran = `${name} <${email}>`;
  }

  if (await prisma.akun.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("Email sudah dipakai akun lain.");
  }
  const sandi = buatSandiSementara();
  try {
    const akun = await prisma.akun.create({
      data: { email, name, role: input.role, pegawaiId, aktif: true, ...dataSandiSementara(sandi) },
      select: { id: true },
    });
    await catatAudit(pelaku, AKSI_AUDIT.AKUN_DIBUAT, sasaran, `Peran: ${labelPeran(input.role)}`);
    return { id: akun.id, sandiSementara: sandi };
  } catch (e) {
    if (kodePrisma(e) === "P2002") throw new ConflictError("Email sudah dipakai akun lain.");
    throw e;
  }
}

async function ambilAkun(id: string) {
  const a = await prisma.akun.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, aktif: true, pegawaiId: true },
  });
  if (!a) throw new NotFoundError("Akun tidak ditemukan.");
  return a;
}

const namaSasaran = (a: { name: string; email: string }) => `${a.name} <${a.email}>`;

export async function setAktifAkun(id: string, aktif: boolean, pelaku: Pelaku): Promise<void> {
  const a = await ambilAkun(id);
  if (!aktif && a.email === pelaku.email) throw new ValidationError("Tidak dapat menonaktifkan akun sendiri.");
  if (a.aktif === aktif) return;
  if (aktif) {
    const reg: { status: string } | null = await prisma.profilPeserta.findUnique({ where: { akunId: id }, select: { status: true } });
    if (reg?.status === "MENUNGGU") {
      throw new ValidationError("Akun ini registrasi peserta yang menunggu persetujuan — putuskan di halaman Registrasi Peserta.");
    }
  }
  if (aktif && a.pegawaiId) {
    const p = await prisma.pegawai.findUnique({ where: { id: a.pegawaiId }, select: { status: true } });
    if (p && statusMenutupAkun(p.status)) {
      throw new ValidationError(`Status pegawai ${p.status}: ubah status pegawai dulu sebelum mengaktifkan akun.`);
    }
  }
  await prisma.akun.update({ where: { id }, data: { aktif, sesiVersi: { increment: 1 } } });
  await catatAudit(pelaku, aktif ? AKSI_AUDIT.AKUN_DIAKTIFKAN : AKSI_AUDIT.AKUN_DINONAKTIFKAN, namaSasaran(a));
}

export async function resetSandiAkun(id: string, pelaku: Pelaku): Promise<{ sandiSementara: string }> {
  const a = await ambilAkun(id);
  if (a.email === pelaku.email) throw new ValidationError("Untuk akun sendiri, gunakan halaman Ganti Kata Sandi.");
  if (!a.aktif) throw new ValidationError("Akun nonaktif. Aktifkan dulu sebelum mereset kata sandi.");
  const sandi = buatSandiSementara();
  await prisma.akun.update({ where: { id }, data: { ...dataSandiSementara(sandi), sesiVersi: { increment: 1 } } });
  await catatAudit(pelaku, AKSI_AUDIT.SANDI_DIRESET, namaSasaran(a), "Kata sandi sementara, wajib diganti saat masuk");
  return { sandiSementara: sandi };
}

const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");
const NIP_EMAIL_PESERTA = /^(\d{18})@peserta\.invalid$/;

/**
 * NIP pemilik tiap akun (dipakai untuk login): dari data pegawai, dari email sintetis akun
 * peserta (`<NIP>@peserta.invalid`), atau dari profil registrasi mandiri.
 */
async function nipAkun(akun: { id: string; email: string; pegawaiId: string | null }[]): Promise<Map<string, string>> {
  const idPegawai = akun.map((a) => a.pegawaiId).filter((x): x is string => !!x);
  const tanpaPegawai = akun.filter((a) => !a.pegawaiId).map((a) => a.id);
  const [pegawai, profil]: [{ id: string; nip: string | null }[], { akunId: string; nip: string }[]] = await Promise.all([
    idPegawai.length ? prisma.pegawai.findMany({ where: { id: { in: idPegawai } }, select: { id: true, nip: true } }) : [],
    tanpaPegawai.length ? prisma.profilPeserta.findMany({ where: { akunId: { in: tanpaPegawai } }, select: { akunId: true, nip: true } }) : [],
  ]);
  const nipPegawai = new Map(pegawai.map((p) => [p.id, p.nip]));
  const nipProfil = new Map(profil.map((p) => [p.akunId, p.nip]));
  const hasil = new Map<string, string>();
  for (const a of akun) {
    const nip = a.pegawaiId ? nipPegawai.get(a.pegawaiId) : (NIP_EMAIL_PESERTA.exec(a.email)?.[1] ?? nipProfil.get(a.id));
    if (nip && tanpaSpasi(nip)) hasil.set(a.id, tanpaSpasi(nip));
  }
  return hasil;
}

export type CatatanSandiRecord = {
  id: string;
  nama: string;
  /** Yang diketik di kolom login: NIP, nama pengguna, atau email. */
  login: string;
  role: string;
  aktif: boolean;
  /** null: catatan tidak ada (sandi dibuat sebelum EB-040) atau tidak terbaca (rahasia server berganti). */
  sandi: string | null;
  keadaan: "ADA" | "TIDAK_TERBACA" | "BELUM_TERCATAT";
  sejak: string | null;
};

/**
 * Catatan sandi awal: semua akun yang kata sandi sementaranya belum diganti pemiliknya.
 * Setiap kali dibuka dicatat di Log Audit.
 */
export async function catatanSandiAwal(pelaku: Pelaku): Promise<CatatanSandiRecord[]> {
  const akun: { id: string; email: string; username: string | null; name: string; role: string; aktif: boolean; pegawaiId: string | null; sandiAwal: string | null; sandiAwalAt: Date | null }[] =
    await prisma.akun.findMany({
      where: { wajibGantiSandi: true },
      select: { id: true, email: true, username: true, name: true, role: true, aktif: true, pegawaiId: true, sandiAwal: true, sandiAwalAt: true },
      orderBy: { name: "asc" },
    });
  const nip = await nipAkun(akun);
  const hasil = akun.map((a): CatatanSandiRecord => {
    const sandi = a.sandiAwal ? bacaCatatanSandi(a.sandiAwal) : null;
    return {
      id: a.id,
      nama: a.name,
      login: nip.get(a.id) ?? a.username ?? a.email,
      role: a.role,
      aktif: a.aktif,
      sandi,
      keadaan: !a.sandiAwal ? "BELUM_TERCATAT" : sandi === null ? "TIDAK_TERBACA" : "ADA",
      sejak: a.sandiAwalAt ? a.sandiAwalAt.toISOString() : null,
    };
  });
  await catatAudit(pelaku, AKSI_AUDIT.CATATAN_SANDI_DIBUKA, "Catatan sandi awal", `${hasil.length} akun`);
  return hasil;
}

/** Banyak akun yang diperiksa per permintaan (scrypt ±50 ms per akun ber-NIP). */
export const UKURAN_KELOMPOK_SANDI_NIP = 20;

/**
 * Cari (dan bila `jalankan`, ganti) kata sandi yang masih sama dengan NIP menjadi kata sandi
 * sementara acak yang tercatat di Catatan sandi awal. Diproses per kelompok supaya tiap
 * permintaan singkat: panggil ulang dengan `setelah` = `berikutnya` sampai `berikutnya` null.
 * Sesi lama akun yang diganti langsung gugur.
 */
export async function periksaSandiNip(
  setelah: string | null,
  jalankan: boolean,
  pelaku: Pelaku,
): Promise<{ diperiksa: number; cocok: number; berikutnya: string | null }> {
  const akun: { id: string; email: string; pegawaiId: string | null; passwordHash: string }[] = await prisma.akun.findMany({
    where: setelah ? { id: { gt: setelah } } : undefined,
    select: { id: true, email: true, pegawaiId: true, passwordHash: true },
    orderBy: { id: "asc" },
    take: UKURAN_KELOMPOK_SANDI_NIP,
  });
  const nip = await nipAkun(akun);
  const cocok = akun.filter((a) => nip.has(a.id) && verifyPassword(nip.get(a.id)!, a.passwordHash));
  if (jalankan) {
    for (const a of cocok) {
      await prisma.akun.update({ where: { id: a.id }, data: { ...dataSandiSementara(buatSandiSementara()), sesiVersi: { increment: 1 } } });
    }
    if (cocok.length) {
      await catatAudit(pelaku, AKSI_AUDIT.SANDI_NIP_DIGANTI, "Akun bersandi NIP", `${cocok.length} akun diberi kata sandi sementara acak`);
    }
  }
  return {
    diperiksa: akun.length,
    cocok: cocok.length,
    berikutnya: akun.length === UKURAN_KELOMPOK_SANDI_NIP ? akun[akun.length - 1].id : null,
  };
}

export async function ubahPeranAkun(id: string, role: UserRole, pelaku: Pelaku): Promise<void> {
  const a = await ambilAkun(id);
  if (a.role === role) return;
  if (a.email === pelaku.email && a.role === "admin") {
    throw new ValidationError("Tidak dapat mencabut peran admin dari akun sendiri.");
  }
  await prisma.akun.update({ where: { id }, data: { role, sesiVersi: { increment: 1 } } });
  await catatAudit(pelaku, AKSI_AUDIT.PERAN_DIUBAH, namaSasaran(a), `${labelPeran(a.role)} → ${labelPeran(role)}`);
}

/**
 * Status pegawai berubah menjadi pindah/pensiun/berhenti/nonaktif: semua akun
 * yang tertaut dinonaktifkan dan Plt/Plh yang belum selesai dicabut.
 */
export async function tutupAksesPegawai(
  pegawaiId: string,
  status: string,
  pelaku: Pelaku,
): Promise<{ akunDitutup: number; pltDicabut: number }> {
  const p = await prisma.pegawai.findUnique({ where: { id: pegawaiId }, select: { nama: true, nip: true } });
  const akun = await prisma.akun.updateMany({ where: { pegawaiId, aktif: true }, data: { aktif: false, sesiVersi: { increment: 1 } } });
  const plt = await prisma.penugasanSementara.updateMany({
    where: { pegawaiId, dicabutAt: null, selesai: { gte: awalHariWib() } },
    data: { dicabutAt: new Date() },
  });
  if (akun.count > 0 || plt.count > 0) {
    await catatAudit(
      pelaku,
      AKSI_AUDIT.AKSES_DITUTUP,
      p ? `${p.nama}${p.nip ? ` (NIP ${p.nip})` : ""}` : pegawaiId,
      `Status ${status}: ${akun.count} akun dinonaktifkan, ${plt.count} Plt/Plh dicabut`,
    );
  }
  return { akunDitutup: akun.count, pltDicabut: plt.count };
}
