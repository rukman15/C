import "server-only";
import { requireRole } from "@/lib/server/auth";
import { ForbiddenError } from "@/lib/server/errors";
import { wewenangPegawai } from "@/lib/server/akses";
import { WEWENANG_LIHAT_NILAI, WEWENANG_UBAH_NILAI, punyaWewenang } from "@/lib/wewenang-penyelenggara";
import type { Penilai } from "@/lib/server/repositories/penilaian";

/** Peran penilai dari sesi (sama dengan aplikasi lama): penyelenggara, WI, atau pimpinan (lihat saja). */
export async function penilaiSesi(mode: "baca" | "ubah"): Promise<Penilai> {
  const s = await requireRole([]);
  const wewenang = await wewenangPegawai(s.pegawaiId);
  if (s.role === "ketua-diklat" || s.role === "admin" || punyaWewenang(wewenang, WEWENANG_UBAH_NILAI)) return { peran: "PENYELENGGARA", email: s.email, nama: s.name };
  if (s.role === "widyaiswara") return { peran: "WI", email: s.email, nama: s.name, pegawaiId: s.pegawaiId ?? null };
  if (mode === "baca" && (s.role === "kepala-balai" || punyaWewenang(wewenang, WEWENANG_LIHAT_NILAI))) return { peran: "PIMPINAN", email: s.email };
  throw new ForbiddenError("Penilaian dibuka Ketua Diklat, Kepala Balai, dan Widyaiswara yang ditugaskan.");
}
