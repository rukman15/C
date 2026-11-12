import { prisma } from "@/lib/server/prisma";
import type { UserRole } from "@/lib/roles";
import { UnauthorizedError, ValidationError } from "@/lib/server/errors";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { PANJANG_SANDI_MIN } from "@/lib/akun";
// Sama dengan HAPUS_CATATAN_SANDI di src/lib/server/catatan-sandi.ts aplikasi lama (EB-040).
const HAPUS_CATATAN_SANDI = { sandiAwal: null, sandiAwalAt: null };

export type UserRecord = {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  /** Pegawai.id kalau akun ini punya padanan pegawai formal (mis. "pegawai-8"). */
  pegawaiId?: string | null;
  /** NIP pegawai yang tertaut (kalau ada) — dipakai mengenali kata sandi bawaan (= NIP). */
  nip?: string | null;
  /** Kata sandi sementara dari admin yang belum diganti (B15). */
  sandiSementara?: boolean;
  sesiVersi?: number;
};

type AkunRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  pegawaiId: string | null;
  wajibGantiSandi?: boolean;
  sesiVersi?: number;
};

function toRecord(a: AkunRow, nip: string | null): UserRecord {
  return {
    email: a.email,
    name: a.name,
    role: a.role as UserRole,
    passwordHash: a.passwordHash,
    pegawaiId: a.pegawaiId,
    nip,
    sandiSementara: a.wajibGantiSandi === true,
    sesiVersi: a.sesiVersi ?? 0,
  };
}

/** Hanya akun aktif yang ditautkan ke pegawai dengan NIP tersebut. */
export async function findUserByNip(nip: string): Promise<UserRecord | undefined> {
  const pegawai = await prisma.pegawai.findUnique({
    where: { nip: nip.trim() },
    select: { id: true, nip: true },
  });
  if (!pegawai) return (await findAkunPeserta(nip.trim())) ?? findAkunRegistrasi(nip.trim());

  // Satu pegawai bisa (sementara) punya lebih dari satu akun aktif, mis. akun impor massal
  // berperan "peserta" + akun admin/staf. Pilih yang pasti: peran selain peserta dulu, lalu terbaru.
  const semua: AkunRow[] = await prisma.akun.findMany({
    where: { pegawaiId: pegawai.id, aktif: true },
    orderBy: { createdAt: "desc" },
  });
  const akun = semua.find((a) => a.role !== "peserta") ?? semua[0];
  if (!akun) return undefined;
  return toRecord(akun, pegawai.nip);
}

/**
 * Peserta diklat dari instansi lain (bukan pegawai balai) juga masuk dengan NIP:
 * akunnya ber-email `<NIP>@peserta.invalid` (lihat repositories/akun-peserta.ts).
 */
async function findAkunPeserta(nip: string): Promise<UserRecord | undefined> {
  if (!/^\d{18}$/.test(nip)) return undefined;
  const akun: (AkunRow & { aktif: boolean }) | null = await prisma.akun.findUnique({
    where: { email: `${nip}@peserta.invalid` },
  });
  if (!akun || !akun.aktif || akun.role !== "peserta") return undefined;
  return toRecord(akun, nip);
}

/** NIP pendaftar mandiri (profil registrasi) milik akun tersebut, kalau ada. */
async function nipProfil(akunId: string): Promise<string | null> {
  const p: { nip: string } | null = await prisma.profilPeserta.findUnique({ where: { akunId }, select: { nip: true } });
  return p?.nip ?? null;
}

/** Peserta yang mendaftar sendiri (/registrasi) masuk dengan NIP di profilnya. */
async function findAkunRegistrasi(nip: string): Promise<UserRecord | undefined> {
  if (!/^\d{18}$/.test(nip)) return undefined;
  const p: { akunId: string } | null = await prisma.profilPeserta.findUnique({ where: { nip }, select: { akunId: true } });
  if (!p) return undefined;
  const akun: (AkunRow & { aktif: boolean }) | null = await prisma.akun.findUnique({ where: { id: p.akunId } });
  if (!akun || !akun.aktif) return undefined;
  return toRecord(akun, nip);
}

/** Akun aktif dengan nama pengguna tersebut (registrasi mandiri; huruf kecil). */
export async function findUserByUsername(username: string): Promise<UserRecord | undefined> {
  const akun: (AkunRow & { aktif: boolean }) | null = await prisma.akun.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!akun || !akun.aktif) return undefined;
  return toRecord(akun, await nipProfil(akun.id));
}

/** Akun aktif dengan email tersebut (email selalu disimpan huruf kecil). */
export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  const akun: (AkunRow & { aktif: boolean }) | null = await prisma.akun.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!akun || !akun.aktif) return undefined;

  let nip: string | null = null;
  if (akun.pegawaiId) {
    const pegawai = await prisma.pegawai.findUnique({
      where: { id: akun.pegawaiId },
      select: { nip: true },
    });
    nip = pegawai?.nip ?? null;
  } else {
    nip = await nipProfil(akun.id);
  }
  return toRecord(akun, nip);
}

/**
 * Cari akun dari isian kolom login: email kalau memuat "@", selain itu NIP atau
 * nama pengguna. Email dibutuhkan untuk akun tanpa NIP (admin pertama, akun
 * non-pegawai).
 */
export async function findUserByLogin(identitas: string): Promise<UserRecord | undefined> {
  const nilai = identitas.trim();
  if (nilai.includes("@")) return findUserByEmail(nilai);
  // Nama pengguna selalu diawali huruf (src/lib/registrasi.ts), NIP selalu angka.
  return /^[A-Za-z]/.test(nilai) ? findUserByUsername(nilai) : findUserByNip(nilai);
}

/**
 * Isian login menunjuk akun pendaftar yang masih MENUNGGU persetujuan? Hasilnya
 * hash kata sandinya (supaya halaman login bisa memberi tahu "menunggu persetujuan"
 * hanya kalau kata sandinya benar), atau null.
 */
export async function hashPendaftarMenunggu(identitas: string): Promise<string | null> {
  const nilai = identitas.trim().toLowerCase();
  let akunId: string | null = null;
  if (/^\d{18}$/.test(nilai)) {
    const p: { akunId: string } | null = await prisma.profilPeserta.findUnique({ where: { nip: nilai }, select: { akunId: true } });
    akunId = p?.akunId ?? null;
  } else {
    const a: { id: string } | null = await prisma.akun.findUnique({
      where: nilai.includes("@") ? { email: nilai } : { username: nilai },
      select: { id: true },
    });
    akunId = a?.id ?? null;
  }
  if (!akunId) return null;
  const [akun, profil]: [{ aktif: boolean; passwordHash: string } | null, { status: string } | null] = await Promise.all([
    prisma.akun.findUnique({ where: { id: akunId }, select: { aktif: true, passwordHash: true } }),
    prisma.profilPeserta.findUnique({ where: { akunId }, select: { status: true } }),
  ]);
  return akun && !akun.aktif && profil?.status === "MENUNGGU" ? akun.passwordHash : null;
}

/** Kata sandi lama tidak cocok — dibedakan supaya hanya ini yang dihitung pembatas percobaan. */
export class SandiLamaSalahError extends ValidationError {
  constructor() {
    super("Kata sandi lama salah");
    this.name = "SandiLamaSalahError";
  }
}

const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");

/**
 * Ganti kata sandi akun yang sedang login. Kata sandi lama wajib benar; yang
 * baru minimal `PANJANG_SANDI_MIN` karakter, berbeda dari yang lama, dan tidak
 * boleh sama dengan NIP pemiliknya (kata sandi bawaan akun pegawai).
 */
export async function gantiKataSandi(
  email: string,
  passwordLama: string,
  passwordBaru: string,
): Promise<number> {
  const akun: { id: string; passwordHash: string; aktif: boolean; pegawaiId: string | null } | null =
    await prisma.akun.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, aktif: true, pegawaiId: true },
    });
  if (!akun || !akun.aktif) throw new UnauthorizedError();
  if (!verifyPassword(passwordLama, akun.passwordHash)) throw new SandiLamaSalahError();
  if (passwordBaru.length < PANJANG_SANDI_MIN) {
    throw new ValidationError(`Kata sandi baru minimal ${PANJANG_SANDI_MIN} karakter`);
  }
  if (passwordBaru === passwordLama) {
    throw new ValidationError("Kata sandi baru harus berbeda dari kata sandi lama");
  }
  if (akun.pegawaiId) {
    const pegawai = await prisma.pegawai.findUnique({
      where: { id: akun.pegawaiId },
      select: { nip: true },
    });
    if (pegawai?.nip && tanpaSpasi(passwordBaru) === tanpaSpasi(pegawai.nip)) {
      throw new ValidationError("Kata sandi baru tidak boleh sama dengan NIP");
    }
  }
  // Akun peserta diklat: NIP ada di email sintetisnya, atau di profil registrasi mandiri.
  const nipPeserta = /^(\d{18})@peserta\.invalid$/.exec(email)?.[1] ?? (akun.pegawaiId ? null : await nipProfil(akun.id));
  if (nipPeserta && tanpaSpasi(passwordBaru) === nipPeserta) {
    throw new ValidationError("Kata sandi baru tidak boleh sama dengan NIP");
  }
  const baru: { sesiVersi: number } = await prisma.akun.update({
    where: { id: akun.id },
    data: { passwordHash: hashPassword(passwordBaru), wajibGantiSandi: false, ...HAPUS_CATATAN_SANDI, sesiVersi: { increment: 1 } },
    select: { sesiVersi: true },
  });
  // Sesi lain (perangkat lain, cookie curian) gugur; pemanggil menandatangani ulang sesi ini.
  return baru.sesiVersi;
}

/** Keluar dari semua perangkat: semua cookie sesi akun ini gugur pada permintaan berikutnya. */
export async function gugurkanSemuaSesi(email: string): Promise<void> {
  await prisma.akun.update({ where: { email }, data: { sesiVersi: { increment: 1 } } });
}
