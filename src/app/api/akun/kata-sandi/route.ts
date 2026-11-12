import { z } from "zod";
import { alamatKlien, fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { cookieAman, getActiveSession, setSignedSessionCookie } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { gantiKataSandi, SandiLamaSalahError } from "@/lib/server/repositories/users";
import { PANJANG_SANDI_MIN } from "@/lib/akun";
import { signSession } from "@/lib/server/session";
import { createLoginLimiter } from "@/lib/server/rate-limit";
import { pgRateStore } from "@/lib/server/rate-limit-pg";

/**
 * Ganti kata sandi akun yang sedang login. Satu-satunya jalan keluar bagi sesi bersandi
 * sementara atau = NIP. Dibatasi seperti login (kunci "ganti:<email>").
 */
const schema = z.object({
  passwordLama: z.string().min(1, "Kata sandi lama wajib diisi").max(256),
  passwordBaru: z
    .string()
    .min(PANJANG_SANDI_MIN, `Kata sandi baru minimal ${PANJANG_SANDI_MIN} karakter`)
    .max(256, "Kata sandi baru terlalu panjang"),
});

const limiter = createLoginLimiter(pgRateStore);

export async function POST(request: Request) {
  try {
    const session = await getActiveSession();
    if (!session) throw new UnauthorizedError();

    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));

    const guard = await limiter.begin(`ganti:${session.email}`, alamatKlien(request));
    if (!guard.allowed) {
      const menit = Math.max(1, Math.ceil(guard.retryAfter / 60));
      return fail(`Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`, 429, { "retry-after": String(guard.retryAfter) });
    }

    let sv: number;
    try {
      sv = await gantiKataSandi(session.email, parsed.data.passwordLama, parsed.data.passwordBaru);
    } catch (e) {
      // Hanya kata sandi lama yang salah yang dihitung sebagai percobaan gagal.
      if (!(e instanceof SandiLamaSalahError)) await guard.succeeded();
      throw e;
    }
    await guard.succeeded();

    // Sesi ditandatangani ulang tanpa tanda wajib ganti sandi.
    const token = signSession({
      email: session.email,
      role: session.role,
      name: session.name,
      pegawaiId: session.pegawaiId,
      jabatan: session.jabatan,
      ...(session.plt ? { plt: session.plt } : {}),
      sv,
    });
    await setSignedSessionCookie(token, cookieAman(request));
    return ok({ diganti: true });
  } catch (e) {
    return failFromError(e);
  }
}
