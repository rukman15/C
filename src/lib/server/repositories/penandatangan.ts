import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ValidationError } from "@/lib/server/errors";
import { JABATAN_KEPALA } from "@/lib/aplikasi";
import { getJabatanProfile } from "@/lib/jabatanProfiles";
import { statusMenutupAkun } from "@/lib/plt";
import { getPengaturanDokumen, kepalaBalaiTerisi } from "@/lib/server/repositories/dokumen";
import { KEWENANGAN_TTD, cocokPilihanTtd, pilihanPenandatangan, rapikanNamaSurat, type PejabatSementara, type PejabatTtd, type PilihanTtd } from "@/lib/tata-naskah";

/**
 * Penanda tangan yang sah per jenis naskah pada tanggal surat (Permendagri 18/2024 Lampiran VIII):
 * Kepala Balai & Kabag TU definitif (Pengaturan Dokumen, atau Data Pegawai bila kosong) ditambah
 * Plt./Plh. yang berlaku pada tanggal itu (`PenugasanSementara` berperan kepala-balai / kabag-tu).
 */

type BarisSementara = { jenis: string; role: string; pegawai: { nama: string; nip: string | null; status: string | null } };

async function kabagDefinitif(): Promise<PejabatTtd | null> {
  const kt = (await getPengaturanDokumen()).kabagTu;
  if (kt.nama.trim()) return { nama: kt.nama.trim(), nip: kt.nip.replace(/\s+/g, "") };
  const calon: { nama: string; nip: string | null; jabatan: string | null; status: string | null }[] = await prisma.pegawai.findMany({
    where: { jabatan: { not: null } },
    select: { nama: true, nip: true, jabatan: true, status: true },
  });
  const k = calon.find((p) => !statusMenutupAkun(p.status) && getJabatanProfile(p.jabatan).id === "tata-usaha");
  return k ? { nama: rapikanNamaSurat(k.nama), nip: k.nip ?? "" } : null;
}

export async function pilihanTtd(jenis: string, tanggal: string): Promise<PilihanTtd[]> {
  const kb = await kepalaBalaiTerisi();
  const hari = new Date(`${tanggal.slice(0, 10)}T00:00:00Z`);
  const sementara: BarisSementara[] = await prisma.penugasanSementara.findMany({
    where: { role: { in: ["kepala-balai", "kabag-tu"] }, dicabutAt: null, mulai: { lte: hari }, selesai: { gte: hari } },
    include: { pegawai: { select: { nama: true, nip: true, status: true } } },
    orderBy: { mulai: "asc" },
  });
  const ke = (role: string): PejabatSementara[] =>
    sementara
      .filter((s) => s.role === role && !statusMenutupAkun(s.pegawai.status))
      .map((s) => ({ jenis: s.jenis === "PLH" ? "PLH" : "PLT", nama: rapikanNamaSurat(s.pegawai.nama), nip: s.pegawai.nip ?? "" }));
  return pilihanPenandatangan(jenis, JABATAN_KEPALA, {
    kepala: kb.nama.trim() || kb.nip.trim() ? { nama: kb.nama.trim(), nip: kb.nip.replace(/\s+/g, "") } : null,
    sementaraKepala: ke("kepala-balai"),
    kabag: await kabagDefinitif(),
    sementaraKabag: ke("kabag-tu"),
  });
}

/**
 * Tolak penanda tangan di luar kewenangan untuk jenis yang ditegakkan (surat tugas). Bila belum ada
 * satu pun pejabat terdata (Pengaturan Dokumen & Data Pegawai kosong), tidak diperiksa.
 */
export async function wajibPenandatanganSah(jenis: string, tanggal: string, t: { jabatan: string[]; nama: string; nip: string }): Promise<void> {
  if (!KEWENANGAN_TTD[jenis]?.wajib) return;
  const pilihan = await pilihanTtd(jenis, tanggal);
  if (!pilihan.length || cocokPilihanTtd(pilihan, t)) return;
  throw new ValidationError(
    `Penanda tangan surat tugas pada tanggal itu harus salah satu dari: ${pilihan.map((o) => `${o.label} (${o.nama})`).join("; ")} — Permendagri 18/2024 Lampiran VIII`,
  );
}
