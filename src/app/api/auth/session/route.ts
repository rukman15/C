import { z } from "zod";
import { alamatKlien, fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { clearSignedSessionCookie, cookieAman, getActiveSession, setSignedSessionCookie } from "@/lib/server/auth";
import { getPengguna } from "@/lib/server/pengguna";
import { findUserByLogin, gugurkanSemuaSesi, hashPendaftarMenunggu } from "@/lib/server/repositories/users";
import { UnauthorizedError } from "@/lib/server/errors";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { signSession } from "@/lib/server/session";
import { createLoginLimiter } from "@/lib/server/rate-limit";
import { pgRateStore } from "@/lib/server/rate-limit-pg";

/**
 * Masuk / keluar / data sesi. Aturan sama dengan aplikasi lama (src/routes/api/auth/session):
 * NIP, email, atau nama pengguna + kata sandi; tidak ada jalur lain (mis. login demo).
 */
const schema = z.object({
  nip: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

/** Kata sandi = NIP wajib diganti dulu (NIP tercantum di SK dan surat tugas). */
const WAJIB_GANTI_SANDI_BAWAAN = true;

const loginLimiter = createLoginLimiter(pgRateStore);

// Hash palsu: identitas yang tidak ditemukan tetap menjalankan scrypt (waktu respons mirip).
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(64)}`;

const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");

export async function GET() {
  try {
    const p = await getPengguna();
    return ok(
      p ?? { role: null, email: null, name: null, pegawaiId: null, jabatan: null, wajibGantiSandi: false, sebagai: null, timDiklat: [], koordinatorWi: false, wewenang: [] },
    );
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail("NIP/nama pengguna/email atau kata sandi tidak valid");

    const identitas = parsed.data.nip.toLowerCase();
    const guard = await loginLimiter.begin(identitas, alamatKlien(request));
    if (!guard.allowed) {
      const menit = Math.max(1, Math.ceil(guard.retryAfter / 60));
      return fail(`Terlalu banyak percobaan masuk. Coba lagi dalam ${menit} menit.`, 429, { "retry-after": String(guard.retryAfter) });
    }

    const user = await findUserByLogin(identitas);
    const passwordOk = verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      // Pendaftar mandiri yang belum disetujui: diberi tahu HANYA bila kata sandinya benar.
      if (!user) {
        const hash = await hashPendaftarMenunggu(identitas);
        if (hash && verifyPassword(parsed.data.password, hash)) {
          return fail("Pendaftaran Anda masih menunggu persetujuan penyelenggara.", 403);
        }
      }
      return fail("NIP/nama pengguna/email atau kata sandi salah", 401);
    }
    await guard.succeeded();

    let jabatan: string | null = null;
    if (user.pegawaiId) {
      try {
        const pegawai = await prisma.pegawai.findUnique({ where: { id: user.pegawaiId }, select: { jabatan: true } });
        jabatan = pegawai?.jabatan ?? null;
      } catch {
        jabatan = null;
      }
    }

    const sandiSementara = user.sandiSementara === true;
    const wajibGantiSandi =
      sandiSementara || (WAJIB_GANTI_SANDI_BAWAAN && !!user.nip && tanpaSpasi(parsed.data.password) === tanpaSpasi(user.nip));

    const token = signSession({
      email: user.email,
      role: user.role,
      name: user.name,
      pegawaiId: user.pegawaiId ?? null,
      jabatan,
      ...(wajibGantiSandi ? { wajibGantiSandi: true } : {}),
      ...(sandiSementara ? { sandiSementara: true } : {}),
      sv: user.sesiVersi ?? 0,
    });
    await setSignedSessionCookie(token, cookieAman(request));
    return ok({ role: user.role, name: user.name, wajibGantiSandi });
  } catch (e) {
    return failFromError(e);
  }
}

/** Keluar. `?semua=1`: semua sesi akun ini di perangkat mana pun ikut berakhir. */
export async function DELETE(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("semua") === "1") {
      const session = await getActiveSession();
      if (!session) throw new UnauthorizedError();
      await gugurkanSemuaSesi(session.email);
    }
    await clearSignedSessionCookie(cookieAman(request));
    return ok({ role: null });
  } catch (e) {
    return failFromError(e);
  }
}
