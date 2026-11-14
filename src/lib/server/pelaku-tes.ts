import "server-only";
import type { UserRole } from "@/lib/roles";
import { requireRole } from "@/lib/server/auth";
import type { Pelaku } from "@/lib/server/repositories/tes";

/** Peran fitur pre/post-test (sama dengan aplikasi lama): admin & Ketua Diklat = penyelenggara, WI = penyusun soal, pimpinan = lihat. */
export async function pelakuTes(roles: UserRole[]): Promise<Pelaku> {
  const s = await requireRole(roles);
  const peran = s.role === "admin" || s.role === "ketua-diklat" ? "PENYELENGGARA" : s.role === "widyaiswara" ? "WI" : "PIMPINAN";
  return { peran, email: s.email, nama: s.name, pegawaiId: s.pegawaiId ?? null };
}
