/**
 * Tren JP mengajar seluruh Widyaiswara, dihitung dari SESI MENGAJAR yang dicatat
 * (tabel `penugasan_sesi`, sesi mengajar WI).
 *
 * PERBAIKAN: sebelumnya file ini berisi angka contoh yang ditulis tangan
 * (harian/mingguan/bulanan) dan tampil di dashboard seolah-olah data asli —
 * termasuk "… JP bulan ini" yang sebenarnya jumlah angka contoh. Sekarang
 * isinya fungsi murni penyusun tren; datanya diambil server dari database
 * (lihat repositories/jp-trend.ts). Kalau belum ada sesi yang dicatat, semua
 * titik bernilai 0 — itu memang keadaan sebenarnya.
 */

export type JpTrendPoint = { periode: string; jam: number };

export type JpTrendRange = "harian" | "mingguan" | "bulanan";

export const JP_TREND_RANGE_LABELS: Record<JpTrendRange, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
};

/** Banyaknya bulan (termasuk bulan berjalan) pada tren bulanan. */
export const BULAN_TREN = 6;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dariIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/**
 * Rentang tanggal yang perlu diambil dari database untuk menyusun tren pada
 * `hariIni` ("YYYY-MM-DD"): dari awal bulan ke-(BULAN_TREN-1) sebelumnya sampai
 * akhir pekan/bulan berjalan. `sampai` eksklusif.
 */
export function rentangTrenJp(hariIni: string): { dari: string; sampai: string } {
  const t = dariIso(hariIni);
  const dari = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - (BULAN_TREN - 1), 1));
  const awalBulanDepan = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1));
  // Pekan berjalan (Senin–Minggu) bisa melewati akhir bulan.
  const hariKe = (t.getUTCDay() + 6) % 7; // 0 = Senin
  const seninDepan = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - hariKe + 7));
  return { dari: iso(dari), sampai: iso(seninDepan > awalBulanDepan ? seninDepan : awalBulanDepan) };
}

/**
 * Susun tiga tren dari daftar sesi (`tanggal` "YYYY-MM-DD", `jp`):
 *   harian   : 7 hari pekan berjalan (Senin–Minggu)
 *   mingguan : bulan berjalan per minggu ke-1..5 (tgl 1–7, 8–14, 15–21, 22–28, 29–akhir)
 *              — jumlah semua titiknya = total JP bulan berjalan
 *   bulanan  : BULAN_TREN bulan terakhir, termasuk bulan berjalan
 */
export function susunTrenJp(
  sesi: { tanggal: string; jp: number }[],
  hariIni: string,
): { data: Record<JpTrendRange, JpTrendPoint[]>; totalBulanIni: number } {
  const t = dariIso(hariIni);
  const tahun = t.getUTCFullYear();
  const bulan = t.getUTCMonth();

  // Harian: Senin–Minggu pekan berjalan.
  const hariKe = (t.getUTCDay() + 6) % 7;
  const tanggalPekan = HARI_PENDEK.map((_, i) => iso(new Date(Date.UTC(tahun, bulan, t.getUTCDate() - hariKe + i))));
  const harian: JpTrendPoint[] = HARI_PENDEK.map((periode) => ({ periode, jam: 0 }));

  // Mingguan: bulan berjalan.
  const hariDalamBulan = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  const jumlahMinggu = hariDalamBulan > 28 ? 5 : 4;
  const mingguan: JpTrendPoint[] = Array.from({ length: jumlahMinggu }, (_, i) => ({
    periode: `Ming ${i + 1}`,
    jam: 0,
  }));
  const awalanBulanIni = `${tahun}-${pad(bulan + 1)}-`;

  // Bulanan: BULAN_TREN bulan terakhir.
  const kunciBulan: string[] = [];
  const bulanan: JpTrendPoint[] = [];
  for (let i = BULAN_TREN - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(tahun, bulan - i, 1));
    kunciBulan.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    bulanan.push({ periode: BULAN_PENDEK[d.getUTCMonth()], jam: 0 });
  }

  let totalBulanIni = 0;
  for (const s of sesi) {
    const iHari = tanggalPekan.indexOf(s.tanggal);
    if (iHari >= 0) harian[iHari].jam += s.jp;

    if (s.tanggal.startsWith(awalanBulanIni)) {
      const tgl = Number(s.tanggal.slice(8, 10));
      mingguan[Math.min(jumlahMinggu - 1, Math.floor((tgl - 1) / 7))].jam += s.jp;
      totalBulanIni += s.jp;
    }

    const iBulan = kunciBulan.indexOf(s.tanggal.slice(0, 7));
    if (iBulan >= 0) bulanan[iBulan].jam += s.jp;
  }

  return { data: { harian, mingguan, bulanan }, totalBulanIni };
}
