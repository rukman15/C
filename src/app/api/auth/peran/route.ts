import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole, setSignedSessionCookie } from "@/lib/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import { prisma } from "@/lib/server/prisma";
import { signSession } from "@/lib/server/session";
import { catatAudit, AKSI_AUDIT } from "@/lib/server/audit";
import { penugasanBerlaku } from "@/lib/server/repositories/plt";
import type { UserRole } from "@/lib/roles";

/**
 * Peralihan peran untuk pemegang Plt/Plh.
 *   GET  -> peran sendiri + Plt/Plh yang sedang berlaku untuk akun ini.
 *   POST { pltId } -> bertindak sebagai Plt/Plh tsb; { pltId: null } -> kembali ke peran sendiri.
 * Sesi ditandatangani ulang; setiap permintaan berikutnya memeriksa ulang bahwa
 * penugasannya masih berlaku (lihat getActiveSession).
 */
async function akunSesi(email: string) {
  const akun = await prisma.akun.findUnique({ where: { email }, select: { role: true, pegawaiId: true } });
  if (!akun) throw new UnauthorizedError();
  return akun;
}

export async function GET() {
  try {
    await requireRole([]);
    const session = (await getActiveSession())!;
    const akun = await akunSesi(session.email);
    return ok({
      peranSendiri: akun.role,
      aktif: session.plt?.id ?? null,
      pilihan: akun.pegawaiId ? await penugasanBerlaku(akun.pegawaiId) : [],
    });
  } catch (e) {
    return failFromError(e);
  }
}

const schema = z.object({ pltId: z.string().min(1).nullable() });

export async function POST(request: Request) {
  const url = new URL(request.url);
  try {
    await requireRole([]);
    const session = (await getActiveSession())!;
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail("Pilihan peran tidak valid");
    const akun = await akunSesi(session.email);
    const pelaku = { email: session.email, name: session.name, sebagai: session.plt?.sebagai ?? null };

    const dasar = {
      email: session.email,
      name: session.name,
      pegawaiId: session.pegawaiId,
      jabatan: session.jabatan,
      ...(session.wajibGantiSandi ? { wajibGantiSandi: true } : {}),
      sv: session.sv ?? 0,
    };

    if (parsed.data.pltId === null) {
      await setSignedSessionCookie(signSession({ ...dasar, role: akun.role as UserRole }), url.protocol === "https:");
      if (session.plt) await catatAudit(pelaku, AKSI_AUDIT.KEMBALI_PERAN, session.plt.sebagai);
      return ok({ role: akun.role, sebagai: null });
    }

    const pilihan = akun.pegawaiId ? await penugasanBerlaku(akun.pegawaiId) : [];
    const p = pilihan.find((x) => x.id === parsed.data.pltId);
    if (!p) throw new ForbiddenError("Penugasan Plt/Plh tidak ditemukan atau tidak sedang berlaku untuk akun ini.");
    await setSignedSessionCookie(
      signSession({ ...dasar, role: p.role as UserRole, plt: { id: p.id, sebagai: p.sebagai } }),
      url.protocol === "https:",
    );
    await catatAudit({ ...pelaku, sebagai: p.sebagai }, AKSI_AUDIT.BERTINDAK_PLT, p.sebagai, `Peran ${p.role}`);
    return ok({ role: p.role, sebagai: p.sebagai });
  } catch (e) {
    return failFromError(e);
  }
}
