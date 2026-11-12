import { prisma } from "@/lib/server/prisma";
import { WINDOW_SEC, type Hit, type RateStore } from "@/lib/server/rate-limit";

/**
 * Penyimpanan counter di tabel `login_attempt` (lihat migrasi
 * 20261005120000_tambah_login_attempt).
 *
 * Sengaja memakai raw SQL, bukan model Prisma: client hasil generate
 * (src/generated/prisma) tidak perlu dibuat ulang, jadi aman untuk alur
 * Termux di PRISMA-SETUP.md. Semua perbandingan waktu memakai now() milik
 * database, bukan jam instance aplikasi, supaya tidak terpengaruh selisih
 * jam antar instance serverless.
 *
 * Kalau tabel belum ada (migrasi belum dijalankan), login akan gagal 500
 * dengan pesan generik, dan penyebabnya tercatat di log server. Itu disengaja
 * (gagal keras, bukan diam-diam tanpa perlindungan).
 */
export const pgRateStore: RateStore = {
  async hit(bucket: string): Promise<Hit> {
    const rows = await prisma.$queryRaw<Array<{ hits: number; retry_after: number }>>`
      INSERT INTO login_attempt AS la (bucket, hits, window_start)
      VALUES (${bucket}, 1, now())
      ON CONFLICT (bucket) DO UPDATE SET
        hits = CASE
          WHEN la.window_start <= now() - make_interval(secs => ${WINDOW_SEC}::int) THEN 1
          ELSE la.hits + 1
        END,
        window_start = CASE
          WHEN la.window_start <= now() - make_interval(secs => ${WINDOW_SEC}::int) THEN now()
          ELSE la.window_start
        END
      RETURNING
        hits,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
          window_start + make_interval(secs => ${WINDOW_SEC}::int) - now()
        ))))::int AS retry_after`;

    const row = rows[0];
    if (!row) throw new Error("rate-limit: upsert tidak mengembalikan baris");

    // Pembersihan baris lama sesekali, tanpa menunggu hasilnya.
    if (Math.random() < 0.02) {
      prisma.$executeRaw`DELETE FROM login_attempt WHERE window_start < now() - interval '1 day'`.catch(
        () => {},
      );
    }
    return { hits: Number(row.hits), retryAfter: Number(row.retry_after) };
  },

  async reset(buckets: string[]): Promise<void> {
    await Promise.all(
      buckets.map((b) => prisma.$executeRaw`DELETE FROM login_attempt WHERE bucket = ${b}`),
    );
  },

  async refund(bucket: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE login_attempt SET hits = GREATEST(hits - 1, 0) WHERE bucket = ${bucket}`;
  },
};
