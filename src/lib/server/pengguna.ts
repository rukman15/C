import "server-only";
import { cache } from "react";
import { getActiveSession } from "@/lib/server/auth";
import { koordinatorWiPegawai, timDiklatPegawai, wewenangPegawai } from "@/lib/server/akses";
import type { UserRole } from "@/lib/roles";
import type { TimDiklat } from "@/lib/tim-kerja";

/** Data pengguna yang dipakai tampilan (sama dengan GET /api/auth/session di aplikasi lama). */
export type Pengguna = {
  email: string;
  name: string;
  role: UserRole;
  pegawaiId: string | null;
  jabatan: string | null;
  wajibGantiSandi: boolean;
  /** Label Plt/Plh yang sedang dipakai, kalau ada. */
  sebagai: string | null;
  timDiklat: TimDiklat[];
  koordinatorWi: boolean;
  wewenang: string[];
};

/** Satu kali per permintaan (React cache), dipakai layout dan halaman sekaligus. */
export const getPengguna = cache(async (): Promise<Pengguna | null> => {
  const s = await getActiveSession();
  if (!s) return null;
  const [timDiklat, koordinatorWi, wewenang] = await Promise.all([
    timDiklatPegawai(s.pegawaiId),
    koordinatorWiPegawai(s.pegawaiId),
    wewenangPegawai(s.pegawaiId),
  ]);
  return {
    email: s.email,
    name: s.name,
    role: s.role,
    pegawaiId: s.pegawaiId ?? null,
    jabatan: s.jabatan ?? null,
    wajibGantiSandi: s.wajibGantiSandi === true || s.sandiSementara === true,
    sebagai: s.plt?.sebagai ?? null,
    timDiklat,
    koordinatorWi,
    wewenang,
  };
});
