import { z } from "zod";
import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { pelakuSesi } from "@/lib/server/audit";
import { buatAkun, listAkunAdmin } from "@/lib/server/repositories/akun-admin";
import { roleProfiles, type UserRole } from "@/lib/roles";

const PERAN = roleProfiles.map((p) => p.id) as [UserRole, ...UserRole[]];

/** Kelola Akun — khusus admin. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await listAkunAdmin());
  } catch (e) {
    return failFromError(e);
  }
}

const schema = z.union([
  z.object({
    pegawaiId: z.string().min(1),
    role: z.enum(PERAN),
    email: z.string().trim().email("Email tidak valid").max(254).nullable().optional().or(z.literal("")),
  }),
  z.object({
    pegawaiId: z.null().optional(),
    role: z.enum(PERAN),
    email: z.string().trim().email("Email tidak valid").max(254),
    nama: z.string().trim().min(1, "Nama wajib diisi").max(200),
  }),
]);

/** Buat akun baru dengan kata sandi sementara (ditampilkan sekali di balasan). */
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const d = parsed.data;
    const hasil = d.pegawaiId
      ? await buatAkun({ pegawaiId: d.pegawaiId, role: d.role, email: d.email || null }, await pelakuSesi())
      : await buatAkun(
          { role: d.role, email: d.email as string, nama: (d as { nama: string }).nama },
          await pelakuSesi(),
        );
    return ok(hasil, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
