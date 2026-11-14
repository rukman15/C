import "server-only";
import { prisma } from "@/lib/server/prisma";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { rentangTrenJp, susunTrenJp } from "@/lib/weeklyJpTrend";

/**
 * Tren JP mengajar seluruh Widyaiswara dari sesi yang dicatat (penugasan_sesi)
 * pada penugasan yang disetujui. Hanya membaca; penyusunan angkanya ada di
 * fungsi murni `susunTrenJp` (@/lib/weeklyJpTrend.ts) supaya bisa diuji tanpa
 * database. "Hari ini" memakai kalender WIB.
 */
export async function getTrenJp(now: Date = new Date()) {
  const hariIni = isoTanggal(awalHariWib(now));
  const { dari, sampai } = rentangTrenJp(hariIni);
  const rows: { tanggal: Date; jp: number }[] = await prisma.penugasanSesi.findMany({
    where: {
      // Kolom DATE: dibandingkan dengan tengah malam UTC (sama seperti saat disimpan).
      tanggal: { gte: new Date(`${dari}T00:00:00.000Z`), lt: new Date(`${sampai}T00:00:00.000Z`) },
      penugasan: { status: "disetujui" },
    },
    select: { tanggal: true, jp: true },
  });
  return susunTrenJp(
    rows.map((r) => ({ tanggal: isoTanggal(r.tanggal), jp: r.jp })),
    hariIni,
  );
}
