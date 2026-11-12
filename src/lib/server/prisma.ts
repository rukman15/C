import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Satu Prisma Client untuk seluruh aplikasi, lewat driver adapter `pg` (sama seperti
 * aplikasi lama, src/lib/server/prisma.ts). Disimpan di globalThis saat dev supaya
 * muat ulang modul tidak membuka koneksi baru terus-menerus.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function buatKlien() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? buatKlien();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
