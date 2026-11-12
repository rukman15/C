import "server-only";
import { cookies } from "next/headers";
import { roleProfiles, type UserRole } from "@/lib/roles";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import { signSession, verifySession, UMUR_SESI_DETIK, type SessionPayload } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { statusSementara } from "@/lib/plt";

/** Nama cookie sama dengan aplikasi lama. */
export const SESSION_COOKIE = "bbpka_session";

const VALID_ROLES = new Set<string>(roleProfiles.map((p) => p.id));

export function isUserRole(value: string | undefined | null): value is UserRole {
  return !!value && VALID_ROLES.has(value);
}

/** Cookie aman (Secure) hanya lewat https; lewat http (mis. jaringan kantor) browser menolaknya. */
export function cookieAman(request?: Request): boolean {
  if (!request) return process.env.NODE_ENV === "production";
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return proto === "https";
}

export async function setSignedSessionCookie(token: string, secure: boolean, maxAge = UMUR_SESI_DETIK) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge });
}

export async function clearSignedSessionCookie(secure: boolean) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 0 });
}

/** Payload sesi tanpa pemeriksaan ke database. Pakai `getActiveSession` untuk keputusan akses. */
export async function getRawSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Sesi yang masih sah: tanda tangan benar, lalu dicocokkan ke tabel akun pada SETIAP permintaan
 * (aktif, peran, tautan pegawai & jabatannya, sesiVersi, sandi sementara, Plt/Plh).
 * Logika sama dengan getActiveSessionFromRequest di aplikasi lama.
 */
export async function getActiveSession(): Promise<SessionPayload | null> {
  let session = await getRawSession();
  if (!session || !isUserRole(session.role)) return null;

  const akun = await prisma.akun.findUnique({
    where: { email: session.email },
    select: { role: true, aktif: true, pegawaiId: true, wajibGantiSandi: true, sesiVersi: true },
  });
  if (!akun?.aktif || (akun.pegawaiId ?? null) !== session.pegawaiId) return null;
  if ((session.sv ?? 0) !== (akun.sesiVersi ?? 0)) return null;
  if (!!akun.wajibGantiSandi !== !!session.sandiSementara) return null;

  if (session.plt) {
    const p = await prisma.penugasanSementara.findUnique({
      where: { id: session.plt.id },
      select: { pegawaiId: true, role: true, jenis: true, jabatan: true, mulai: true, selesai: true, dicabutAt: true },
    });
    const masihBerlaku =
      !!p &&
      !!akun.pegawaiId &&
      p.pegawaiId === akun.pegawaiId &&
      p.role === session.role &&
      statusSementara(
        { jenis: p.jenis, jabatan: p.jabatan, mulai: isoTanggal(p.mulai), selesai: isoTanggal(p.selesai), dicabut: !!p.dicabutAt },
        isoTanggal(awalHariWib()),
      ) === "BERLAKU";
    if (!masihBerlaku) {
      // Plt/Plh berakhir: kembali ke peran akun sendiri, bukan dikeluarkan.
      if (!isUserRole(akun.role)) return null;
      const { exp, plt: _plt, ...dasar } = session;
      session = { ...dasar, role: akun.role, exp };
      try {
        const sisa = Math.max(60, exp - Math.floor(Date.now() / 1000));
        await setSignedSessionCookie(signSession({ ...dasar, role: akun.role }, sisa), process.env.NODE_ENV === "production", sisa);
      } catch {
        // Di Server Component cookie tidak bisa ditulis; pemeriksaan ini tetap berlaku per permintaan.
      }
    }
  } else if (akun.role !== session.role) {
    return null;
  }

  if (akun.pegawaiId) {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: akun.pegawaiId }, select: { jabatan: true } });
    if (!pegawai || pegawai.jabatan !== session.jabatan) return null;
  } else if (session.jabatan !== null) {
    return null;
  }
  return session;
}

/**
 * Untuk route API. `allowed` kosong = semua yang login. Admin selalu lolos (EB-033).
 * Sesi bersandi sementara atau = NIP ditolak (hanya ganti kata sandi yang boleh).
 */
export async function requireRole(allowed: UserRole[]): Promise<SessionPayload> {
  const session = await getActiveSession();
  if (!session) throw new UnauthorizedError();
  if (session.sandiSementara) throw new ForbiddenError("Kata sandi Anda masih sementara. Ganti kata sandi terlebih dahulu.");
  if (session.wajibGantiSandi) throw new ForbiddenError("Kata sandi Anda masih sama dengan NIP. Ganti kata sandi terlebih dahulu.");
  if (allowed.length > 0 && session.role !== "admin" && !allowed.includes(session.role)) throw new ForbiddenError();
  return session;
}
