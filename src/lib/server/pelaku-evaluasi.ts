import "server-only";
import type { UserRole } from "@/lib/roles";
import { requireRole } from "@/lib/server/auth";
import type { PelakuEvaluasi } from "@/lib/server/repositories/evaluasi";

/** Peran rekap evaluasi (sama dengan aplikasi lama): admin & Ketua Diklat = penyelenggara, Kepala Balai/Kabag TU = pimpinan. */
export async function pelakuEvaluasi(roles: UserRole[]): Promise<PelakuEvaluasi> {
  const s = await requireRole(roles);
  return { peran: s.role === "admin" || s.role === "ketua-diklat" ? "PENYELENGGARA" : "PIMPINAN", email: s.email, pegawaiId: s.pegawaiId ?? null };
}
