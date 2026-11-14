import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getTrenJp } from "@/lib/server/repositories/jp-trend";

/**
 * Tren JP mengajar seluruh Widyaiswara (harian/mingguan/bulanan) dari sesi
 * mengajar yang dicatat. Wajib login (`[]` = role apa pun).
 *
 * PERBAIKAN: dulu endpoint ini mengembalikan angka contoh yang ditulis tangan
 * di $lib/weeklyJpTrend.ts (hanya titik bulanan terakhir yang diisi data, itu
 * pun total sepanjang masa, bukan bulan berjalan). Sekarang seluruhnya dari
 * tabel `penugasan_sesi`.
 *
 * `currentTotal` dipertahankan untuk pemanggil lama; nilainya sama dengan
 * `totalBulanIni` (total JP sesi pada bulan berjalan).
 */
export async function GET() {
  try {
    await requireRole([]);
    const tren = await getTrenJp();
    return ok({ data: tren.data, totalBulanIni: tren.totalBulanIni, currentTotal: tren.totalBulanIni });
  } catch (e) {
    return failFromError(e);
  }
}
