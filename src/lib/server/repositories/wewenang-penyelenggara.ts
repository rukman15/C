import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { rapikanWewenang } from "@/lib/wewenang-penyelenggara";

/**
 * Admin Penyelenggara (EB-034): wewenang per pegawai yang diberikan Super Admin (akun admin).
 * Aturan kode wewenang di src/lib/wewenang-penyelenggara.ts.
 */
export type WewenangRecord = {
  pegawaiId: string;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  punyaAkun: boolean;
  wewenang: string[];
  dasar: string | null;
  diubahOleh: string;
  diubahPada: string;
};
export type PilihanPegawaiRecord = { id: string; nama: string; nip: string | null; jabatan: string | null; punyaAkun: boolean };

/**
 * Daftar wewenang pegawai ini (kosong bila tidak ditunjuk). Dibaca ulang tiap permintaan.
 * Dipanggil di jalur sesi & semua akses diklat, jadi TIDAK boleh menjatuhkan aplikasi bila migrasi
 * `20261105090000_penugasan_angkatan` belum dijalankan: tabel belum ada (Prisma P2021) = tanpa wewenang.
 */
let peringatanTabel = false;
export async function wewenangPegawai(pegawaiId: string | null | undefined): Promise<string[]> {
  if (!pegawaiId) return [];
  try {
    const r: { wewenang: string[] } | null = await prisma.wewenangPenyelenggara.findUnique({ where: { pegawaiId }, select: { wewenang: true } });
    return r?.wewenang ?? [];
  } catch (e) {
    if ((e as { code?: string })?.code === "P2021") {
      if (!peringatanTabel) console.warn("[wewenang] tabel wewenang_penyelenggara belum ada — jalankan `npx prisma migrate deploy`.");
      peringatanTabel = true;
      return [];
    }
    throw e;
  }
}

async function pegawaiBerakun(): Promise<Set<string>> {
  const akun: { pegawaiId: string | null; aktif: boolean }[] = await prisma.akun.findMany({ select: { pegawaiId: true, aktif: true } });
  return new Set(akun.filter((a) => a.pegawaiId && a.aktif).map((a) => a.pegawaiId as string));
}

export async function listWewenang(): Promise<{ daftar: WewenangRecord[]; pilihanPegawai: PilihanPegawaiRecord[] }> {
  const [baris, pegawai, berakun] = await Promise.all([
    prisma.wewenangPenyelenggara.findMany({ include: { pegawai: { select: { nama: true, nip: true, jabatan: true } } } }),
    prisma.pegawai.findMany({ where: { status: "AKTIF" }, select: { id: true, nama: true, nip: true, jabatan: true }, orderBy: { nama: "asc" } }),
    pegawaiBerakun(),
  ]);
  const daftar = (baris as any[])
    .map((b) => ({
      pegawaiId: b.pegawaiId,
      nama: b.pegawai?.nama ?? "(pegawai dihapus)",
      nip: b.pegawai?.nip ?? null,
      jabatan: b.pegawai?.jabatan ?? null,
      punyaAkun: berakun.has(b.pegawaiId),
      wewenang: b.wewenang,
      dasar: b.dasar,
      diubahOleh: b.diubahOleh,
      diubahPada: new Date(b.updatedAt).toISOString(),
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const pilihanPegawai = (pegawai as { id: string; nama: string; nip: string | null; jabatan: string | null }[]).map((p) => ({ ...p, punyaAkun: berakun.has(p.id) }));
  return { daftar, pilihanPegawai };
}

/** Tunjuk atau ubah wewenang satu pegawai. Mengembalikan nama pegawai (untuk log audit). */
export async function simpanWewenang(pegawaiId: string, wewenang: unknown, dasar: string | null, oleh: string): Promise<string> {
  const rapi = rapikanWewenang(wewenang);
  if (!rapi.ok) throw new ValidationError(rapi.pesan);
  const p: { nama: string } | null = await prisma.pegawai.findUnique({ where: { id: pegawaiId }, select: { nama: true } });
  if (!p) throw new NotFoundError("Pegawai tidak ditemukan");
  const ada = await prisma.wewenangPenyelenggara.findUnique({ where: { pegawaiId }, select: { id: true } });
  const data = { wewenang: rapi.wewenang, dasar: dasar?.trim() || null, diubahOleh: oleh };
  if (ada) await prisma.wewenangPenyelenggara.update({ where: { pegawaiId }, data });
  else await prisma.wewenangPenyelenggara.create({ data: { pegawaiId, ...data } });
  return p.nama;
}

/** Cabut semua wewenang Admin Penyelenggara pegawai ini. Mengembalikan nama pegawai. */
export async function hapusWewenang(pegawaiId: string): Promise<string> {
  const ada: { id: string; pegawai: { nama: string } | null } | null = await prisma.wewenangPenyelenggara.findUnique({
    where: { pegawaiId },
    select: { id: true, pegawai: { select: { nama: true } } },
  });
  if (!ada) throw new NotFoundError("Pegawai ini bukan Admin Penyelenggara");
  await prisma.wewenangPenyelenggara.deleteMany({ where: { pegawaiId } });
  return ada.pegawai?.nama ?? pegawaiId;
}
