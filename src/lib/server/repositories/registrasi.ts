import "server-only";
import { prisma } from "@/lib/server/prisma";
import { hashPassword } from "@/lib/server/password";
import { ConflictError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { AKSI_AUDIT, catatAudit, type Pelaku } from "@/lib/server/audit";
import { emailPeserta } from "@/lib/server/repositories/peserta";
import {
  cariWilayah,
  namaLengkap,
  periksaProfil,
  periksaRegistrasi,
  rapikanNamaPengguna,
  type IsianProfil,
  type IsianRegistrasi,
  type StatusRegistrasi,
} from "@/lib/registrasi";

/**
 * Registrasi mandiri peserta (lihat src/lib/registrasi.ts). Akun pendaftar dibuat
 * NONAKTIF (peran peserta) bersama profilnya; baru bisa masuk setelah disetujui.
 */

const rapikan = (s: string) => s.trim().replace(/\s+/g, " ");
const opsional = (s: string) => rapikan(s) || null;

export async function daftar(d: IsianRegistrasi): Promise<{ id: string }> {
  const galat = Object.values(periksaRegistrasi(d));
  if (galat.length) throw new ValidationError(galat[0] as string);

  const username = rapikanNamaPengguna(d.username);
  const email = d.email.trim().toLowerCase();
  const nip = d.nip.replace(/\s+/g, "");

  if (await prisma.akun.findUnique({ where: { username }, select: { id: true } })) {
    throw new ConflictError("Nama pengguna sudah dipakai. Pilih nama pengguna lain.");
  }
  if (await prisma.akun.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("Alamat surel sudah terdaftar.");
  }
  const ada: { status: string } | null = await prisma.profilPeserta.findUnique({ where: { nip }, select: { status: true } });
  if (ada) {
    throw new ConflictError(
      ada.status === "MENUNGGU"
        ? "NIP ini sudah mendaftar dan sedang menunggu persetujuan."
        : "NIP ini sudah terdaftar. Masuk dengan NIP atau nama pengguna Anda.",
    );
  }
  if (await prisma.pegawai.findUnique({ where: { nip }, select: { id: true } })) {
    throw new ConflictError("NIP ini terdaftar sebagai pegawai balai. Masuk dengan akun pegawai Anda.");
  }
  if (await prisma.akun.findUnique({ where: { email: emailPeserta(nip) }, select: { id: true } })) {
    throw new ConflictError("NIP ini sudah punya akun peserta dari penyelenggara. Masuk dengan NIP; lupa kata sandi? Hubungi penyelenggara.");
  }

  const name = namaLengkap(rapikan(d.namaDepan), rapikan(d.namaBelakang));
  try {
    const id: string = await prisma.$transaction(async (tx) => {
      const akun: { id: string } = await tx.akun.create({
        data: { email, username, name, role: "peserta", passwordHash: hashPassword(d.password), pegawaiId: null, aktif: false, wajibGantiSandi: false },
        select: { id: true },
      });
      const profil: { id: string } = await tx.profilPeserta.create({
        data: {
          akunId: akun.id,
          nip,
          namaDepan: rapikan(d.namaDepan),
          namaBelakang: opsional(d.namaBelakang),
          kodeProvinsi: d.kodeProvinsi,
          kodeKabKota: d.kodeKabKota,
          instansi: rapikan(d.instansi),
          unitOrganisasi: rapikan(d.unitOrganisasi),
          unitKerja: opsional(d.unitKerja),
          golongan: d.golongan,
          jabatan: rapikan(d.jabatan),
          telepon: opsional(d.telepon),
          ponsel: d.ponsel.replace(/[\s().-]/g, ""),
          alamat: d.alamat.trim(),
          status: "MENUNGGU",
          persetujuanData: new Date(),
        },
        select: { id: true },
      });
      return profil.id;
    });
    await catatAudit({ email, name }, AKSI_AUDIT.REGISTRASI_DIAJUKAN, `${name} (NIP ${nip})`, `Nama pengguna: ${username}`);
    return { id };
  } catch (e) {
    if (kodePrisma(e) === "P2002") throw new ConflictError("Nama pengguna, surel, atau NIP baru saja dipakai pendaftar lain. Periksa lagi.");
    throw e;
  }
}

export type RegistrasiRecord = {
  id: string;
  status: StatusRegistrasi;
  username: string | null;
  email: string;
  nama: string;
  nip: string;
  provinsi: string;
  kabKota: string;
  instansi: string;
  unitOrganisasi: string;
  unitKerja: string | null;
  golongan: string;
  jabatan: string;
  telepon: string | null;
  ponsel: string;
  alamat: string;
  diajukan: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
};

type ProfilRow = {
  id: string; status: string; nip: string; namaDepan: string; namaBelakang: string | null;
  kodeProvinsi: string; kodeKabKota: string; instansi: string; unitOrganisasi: string; unitKerja: string | null;
  golongan: string; jabatan: string; telepon: string | null; ponsel: string; alamat: string;
  createdAt: Date; diputuskanOleh: string | null; diputuskanPada: Date | null;
  akun: { username: string | null; email: string } | null;
};

export async function listRegistrasi(status?: StatusRegistrasi): Promise<RegistrasiRecord[]> {
  const rows: ProfilRow[] = await prisma.profilPeserta.findMany({
    where: status ? { status } : undefined,
    include: { akun: { select: { username: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => {
    const w = cariWilayah(r.kodeProvinsi, r.kodeKabKota);
    return {
      id: r.id,
      status: r.status as StatusRegistrasi,
      username: r.akun?.username ?? null,
      email: r.akun?.email ?? "",
      nama: namaLengkap(r.namaDepan, r.namaBelakang),
      nip: r.nip,
      provinsi: w?.provinsi ?? r.kodeProvinsi,
      kabKota: w?.kabKota ?? r.kodeKabKota,
      instansi: r.instansi,
      unitOrganisasi: r.unitOrganisasi,
      unitKerja: r.unitKerja,
      golongan: r.golongan,
      jabatan: r.jabatan,
      telepon: r.telepon,
      ponsel: r.ponsel,
      alamat: r.alamat,
      diajukan: r.createdAt.toISOString(),
      diputuskanOleh: r.diputuskanOleh,
      diputuskanPada: r.diputuskanPada ? r.diputuskanPada.toISOString() : null,
    };
  });
}

export async function jumlahRegistrasiMenunggu(): Promise<number> {
  return prisma.profilPeserta.count({ where: { status: "MENUNGGU" } });
}

/**
 * Setujui: akun diaktifkan. Tolak: akun & profil dihapus (pendaftar boleh mendaftar
 * ulang dengan data yang benar); alasan dicatat di log audit. Hanya registrasi yang
 * masih MENUNGGU yang bisa diputuskan.
 */
export async function putuskanRegistrasi(id: string, aksi: "setujui" | "tolak", pelaku: Pelaku, alasan?: string | null): Promise<void> {
  const p: { id: string; akunId: string; nip: string; namaDepan: string; namaBelakang: string | null; status: string } | null =
    await prisma.profilPeserta.findUnique({
      where: { id },
      select: { id: true, akunId: true, nip: true, namaDepan: true, namaBelakang: true, status: true },
    });
  if (!p) throw new NotFoundError("Registrasi tidak ditemukan (mungkin sudah ditolak).");
  if (p.status !== "MENUNGGU") throw new ValidationError("Registrasi ini sudah diputuskan.");
  const sasaran = `${namaLengkap(p.namaDepan, p.namaBelakang)} (NIP ${p.nip})`;

  if (aksi === "setujui") {
    await prisma.$transaction([
      prisma.profilPeserta.update({
        where: { id },
        data: { status: "DISETUJUI", diputuskanOleh: pelaku.name, diputuskanPada: new Date() },
      }),
      prisma.akun.update({ where: { id: p.akunId }, data: { aktif: true, sesiVersi: { increment: 1 } } }),
    ]);
    await catatAudit(pelaku, AKSI_AUDIT.REGISTRASI_DISETUJUI, sasaran);
    return;
  }

  await prisma.$transaction([
    // Kalau sempat ditautkan ke daftar peserta suatu diklat, lepaskan dulu.
    prisma.peserta.updateMany({ where: { akunId: p.akunId }, data: { akunId: null } }),
    prisma.akun.deleteMany({ where: { id: p.akunId } }),
  ]);
  await catatAudit(pelaku, AKSI_AUDIT.REGISTRASI_DITOLAK, sasaran, alasan?.trim() || null);
}

// ------------------------------------------------------------------ PROFIL SAYA (peserta)

export type ProfilSayaRecord = {
  /** Identitas — tidak bisa diubah sendiri. */
  nama: string;
  nip: string;
  username: string | null;
  email: string;
  isian: IsianProfil;
  provinsi: string;
  kabKota: string;
};

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const keTanggal = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : null);

type ProfilLengkap = {
  nip: string; namaDepan: string; namaBelakang: string | null; kodeProvinsi: string; kodeKabKota: string; instansi: string;
  unitOrganisasi: string; unitKerja: string | null; golongan: string; jabatan: string; telepon: string | null; ponsel: string;
  alamat: string; alamatKantor: string | null; tempatLahir: string | null; tanggalLahir: Date | null; jenisKelamin: string | null;
  pendidikanTerakhir: string | null; eselon: string | null; tmtPangkat: Date | null; tmtJabatan: Date | null;
  akun: { username: string | null; email: string };
};

/** Profil registrasi milik akun yang login; null bila akun ini dibuat penyelenggara (tanpa registrasi mandiri). */
export async function getProfilSaya(email: string): Promise<ProfilSayaRecord | null> {
  const p: ProfilLengkap | null = await prisma.profilPeserta.findFirst({ where: { akun: { email } }, include: { akun: { select: { username: true, email: true } } } });
  if (!p) return null;
  const w = cariWilayah(p.kodeProvinsi, p.kodeKabKota);
  return {
    nama: namaLengkap(p.namaDepan, p.namaBelakang),
    nip: p.nip,
    username: p.akun.username,
    email: p.akun.email,
    provinsi: w?.provinsi ?? p.kodeProvinsi,
    kabKota: w?.kabKota ?? p.kodeKabKota,
    isian: {
      kodeProvinsi: p.kodeProvinsi,
      kodeKabKota: p.kodeKabKota,
      instansi: p.instansi,
      unitOrganisasi: p.unitOrganisasi,
      unitKerja: p.unitKerja ?? "",
      golongan: p.golongan,
      jabatan: p.jabatan,
      telepon: p.telepon ?? "",
      ponsel: p.ponsel,
      alamat: p.alamat,
      alamatKantor: p.alamatKantor ?? "",
      tempatLahir: p.tempatLahir ?? "",
      tanggalLahir: iso(p.tanggalLahir),
      jenisKelamin: p.jenisKelamin ?? "",
      pendidikanTerakhir: p.pendidikanTerakhir ?? "",
      eselon: p.eselon ?? "",
      tmtPangkat: iso(p.tmtPangkat),
      tmtJabatan: iso(p.tmtJabatan),
    },
  };
}

/** Simpan Profil Saya. Data peserta per jadwal (nama, jabatan, instansi di daftar peserta) tidak ikut berubah. */
export async function ubahProfilSaya(email: string, d: IsianProfil): Promise<ProfilSayaRecord> {
  const g = periksaProfil(d);
  const salah = Object.values(g);
  if (salah.length) throw new ValidationError(salah.join("; "));
  const ada: { id: string } | null = await prisma.profilPeserta.findFirst({ where: { akun: { email } }, select: { id: true } });
  if (!ada) throw new NotFoundError("Profil registrasi tidak ditemukan untuk akun ini");
  await prisma.profilPeserta.update({
    where: { id: ada.id },
    data: {
      kodeProvinsi: d.kodeProvinsi,
      kodeKabKota: d.kodeKabKota,
      instansi: rapikan(d.instansi),
      unitOrganisasi: rapikan(d.unitOrganisasi),
      unitKerja: opsional(d.unitKerja),
      golongan: d.golongan,
      jabatan: rapikan(d.jabatan),
      telepon: opsional(d.telepon),
      ponsel: d.ponsel.replace(/[\s().-]/g, ""),
      alamat: d.alamat.trim(),
      alamatKantor: opsional(d.alamatKantor),
      tempatLahir: opsional(d.tempatLahir),
      tanggalLahir: keTanggal(d.tanggalLahir),
      jenisKelamin: d.jenisKelamin || null,
      pendidikanTerakhir: opsional(d.pendidikanTerakhir),
      eselon: opsional(d.eselon),
      tmtPangkat: keTanggal(d.tmtPangkat),
      tmtJabatan: keTanggal(d.tmtJabatan),
    },
  });
  return (await getProfilSaya(email))!;
}
