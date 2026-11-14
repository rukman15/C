import "server-only";
import { prisma } from "@/lib/server/prisma";

export type PengaturanJpRecord = {
  batasHijauHarian: number;
  batasKuningHarian: number;
  batasRekapBulanan: number;
  updatedAt: string;
  diubahOleh?: string;
};

const SINGLETON_ID = "singleton";

function toRecord(row: {
  batasHijauHarian: number;
  batasKuningHarian: number;
  batasRekapBulanan: number;
  updatedAt: Date;
  diubahOleh: string | null;
}): PengaturanJpRecord {
  return {
    batasHijauHarian: row.batasHijauHarian,
    batasKuningHarian: row.batasKuningHarian,
    batasRekapBulanan: row.batasRekapBulanan,
    updatedAt: row.updatedAt.toISOString(),
    diubahOleh: row.diubahOleh ?? undefined,
  };
}

/**
 * Baris tunggal ("singleton") — upsert di GET supaya endpoint ini selalu
 * aman dipanggil, bahkan sebelum admin pernah menyimpan apa pun (baris
 * langsung dibuat dengan nilai default dari schema.prisma).
 */
export async function getPengaturanJp(): Promise<PengaturanJpRecord> {
  const row = await prisma.pengaturanJp.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return toRecord(row);
}

export async function updatePengaturanJp(
  input: Partial<Pick<PengaturanJpRecord, "batasHijauHarian" | "batasKuningHarian" | "batasRekapBulanan">>,
  diubahOleh: string,
): Promise<PengaturanJpRecord> {
  const row = await prisma.pengaturanJp.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input, diubahOleh },
    update: { ...input, diubahOleh },
  });
  return toRecord(row);
}
