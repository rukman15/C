import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { alamatKlien } from "@/lib/server/http";
import { daftar } from "@/lib/server/repositories/registrasi";
import { createDaftarLimiter } from "@/lib/server/rate-limit";
import { pgRateStore } from "@/lib/server/rate-limit-pg";

/**
 * Registrasi mandiri peserta (PUBLIK, tanpa sesi — terdaftar di OPEN_MUTATION
 * hooks.server.ts). Aturan isian: src/lib/registrasi.ts; akun dibuat nonaktif
 * sampai disetujui admin/Ketua Diklat.
 */
const teks = (maks: number) => z.string().max(maks).default("");
const schema = z.object({
  username: teks(60),
  password: teks(256),
  email: teks(254),
  email2: teks(254),
  namaDepan: teks(200),
  namaBelakang: teks(200),
  kodeProvinsi: teks(10),
  kodeKabKota: teks(10),
  nip: teks(40),
  instansi: teks(400),
  unitOrganisasi: teks(400),
  unitKerja: teks(400),
  golongan: teks(10),
  jabatan: teks(400),
  telepon: teks(40),
  ponsel: teks(40),
  alamat: teks(1000),
  setuju: z.boolean().default(false),
});

const limiter = createDaftarLimiter(pgRateStore);

export async function POST(request: Request) {
  try {
    let ip = "unknown";
    try {
      ip = alamatKlien(request);
    } catch {
      // lihat catatan yang sama di /api/auth/session
    }
    const guard = await limiter.begin(ip);
    if (!guard.allowed) {
      const menit = Math.max(1, Math.ceil(guard.retryAfter / 60));
      return fail(`Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam ${menit} menit.`, 429, {
        "retry-after": String(guard.retryAfter),
      });
    }
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail("Isian formulir tidak valid");
    await daftar(parsed.data);
    return ok({ status: "MENUNGGU" }, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
