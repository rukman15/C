/**
 * Pembatas percobaan login (anti brute-force dan password spraying).
 *
 * File ini hanya berisi LOGIKA, tanpa import apa pun, supaya bisa diuji
 * terpisah. Penyimpanan counter ada di `rate-limit-pg.ts` (tabel
 * `login_attempt`). Counter disimpan di database, bukan di memori, supaya
 * tetap benar di Vercel/serverless (banyak instance, tidak ada memori
 * bersama) maupun di server Node biasa.
 *
 * Cara kerja: "ambil jatah dulu, kembalikan kalau berhasil".
 * Setiap percobaan menaikkan counter SEBELUM kata sandi dicek. Ini penting:
 * kalau dicek dulu baru dihitung, 50 request paralel bisa lolos bersamaan
 * sebelum satu pun tercatat. Kalau login berhasil, counter NIP dan
 * pasangan NIP+IP dihapus dan counter IP dikembalikan satu.
 *
 * Tiga ember, masing-masing jendela tetap 15 menit:
 *   pair  NIP + IP yang sama  -> menahan tebakan beruntun dari satu perangkat
 *   nip   NIP yang sama       -> menahan tebakan terdistribusi (banyak IP)
 *   ip    IP yang sama        -> menahan penyapuan banyak NIP dari satu sumber
 *
 * Catatan kompromi: ember `nip` bisa dipakai orang lain untuk mengunci NIP
 * korban paling lama 15 menit. Itu harga yang disengaja; ubah angkanya di
 * LOGIN_LIMITS kalau terasa terlalu ketat/longgar.
 */

export const WINDOW_SEC = 15 * 60;

export const LOGIN_LIMITS = {
  pair: 5,
  nip: 10,
  // Longgar karena satu kantor bisa berbagi satu IP (NAT) dan hanya
  // KEGAGALAN yang dihitung (sukses mengembalikan jatah).
  ip: 50,
} as const;

export type Hit = { hits: number; retryAfter: number };

export interface RateStore {
  /** Naikkan counter ember secara atomik; mulai jendela baru kalau sudah lewat. */
  hit(bucket: string): Promise<Hit>;
  /** Hapus counter ember. */
  reset(buckets: string[]): Promise<void>;
  /** Kurangi counter ember satu (tidak di bawah 0). */
  refund(bucket: string): Promise<void>;
}

export type LoginGuard =
  | { allowed: true; succeeded: () => Promise<void> }
  | { allowed: false; retryAfter: number };

export function normalizeNip(nip: string): string {
  return nip.replace(/\s+/g, "");
}

export function createLoginLimiter(store: RateStore, limits: typeof LOGIN_LIMITS = LOGIN_LIMITS) {
  return {
    async begin(nip: string, ip: string): Promise<LoginGuard> {
      const n = normalizeNip(nip);
      const ipBucket = `ip:${ip}`;
      const nipBucket = `nip:${n}`;
      const pairBucket = `pair:${n}|${ip}`;

      // IP dicek lebih dulu: kalau sudah melewati batas, ember NIP/pasangan
      // tidak disentuh sehingga satu sumber tidak bisa menggelembungkan
      // jumlah baris di tabel dengan NIP acak.
      const ipHit = await store.hit(ipBucket);
      if (ipHit.hits > limits.ip) return { allowed: false, retryAfter: ipHit.retryAfter };

      const [nipHit, pairHit] = await Promise.all([store.hit(nipBucket), store.hit(pairBucket)]);
      const waits: number[] = [];
      if (nipHit.hits > limits.nip) waits.push(nipHit.retryAfter);
      if (pairHit.hits > limits.pair) waits.push(pairHit.retryAfter);
      if (waits.length > 0) return { allowed: false, retryAfter: Math.max(...waits) };

      return {
        allowed: true,
        succeeded: async () => {
          // Kegagalan membersihkan counter tidak boleh menggagalkan login
          // yang kata sandinya sudah benar.
          try {
            await Promise.all([store.reset([nipBucket, pairBucket]), store.refund(ipBucket)]);
          } catch (error) {
            console.error("[rate-limit] gagal membersihkan counter setelah login sukses:", error);
          }
        },
      };
    },
  };
}

/**
 * Pembatas registrasi mandiri (POST /api/auth/daftar): per IP, jendela yang sama
 * (15 menit). Setiap kiriman dihitung — termasuk yang berhasil — supaya formulir
 * tidak bisa dipakai menebak NIP/nama pengguna yang sudah terdaftar atau membanjiri
 * antrean persetujuan. Cukup longgar untuk satu kantor (NAT) yang mendaftarkan
 * beberapa orang sekaligus.
 */
export const DAFTAR_LIMIT_IP = 20;

export function createDaftarLimiter(store: RateStore, batas = DAFTAR_LIMIT_IP) {
  return {
    async begin(ip: string): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
      const h = await store.hit(`daftar:${ip}`);
      return h.hits > batas ? { allowed: false, retryAfter: h.retryAfter } : { allowed: true };
    },
  };
}
