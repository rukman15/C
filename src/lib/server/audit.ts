import "server-only";
import { prisma } from "@/lib/server/prisma";

/**
 * Log audit (tabel log_audit) — sama dengan src/lib/server/audit.ts aplikasi lama. Tindakan yang
 * menyangkut hak akses dicatat; kegagalan mencatat tidak menggagalkan tindakannya.
 */
export type Pelaku = { email: string; name: string; sebagai?: string | null };

export const AKSI_AUDIT = {
  AKUN_PESERTA: "Akun peserta dibuat/ditautkan",
} as const;

export async function catatAudit(pelaku: Pelaku, aksi: string, sasaran?: string | null, rincian?: string | null): Promise<void> {
  try {
    await prisma.logAudit.create({
      data: { pelaku: pelaku.email, pelakuNama: pelaku.name, sebagai: pelaku.sebagai ?? null, aksi, sasaran: sasaran ?? null, rincian: rincian ?? null },
    });
  } catch (e) {
    console.error("[audit] gagal mencatat:", aksi, sasaran, e);
  }
}
