import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { isUserRole, requireRole } from "@/lib/server/auth";
import * as updatesRepo from "@/lib/server/repositories/updates";

// `role` harus salah satu peran yang ada (dulu teks apa pun diterima, sehingga
// salah ketik menghasilkan notifikasi yang tidak pernah terbaca siapa pun), dan
// panjang teks dibatasi.
const createSchema = z.object({
  role: z.string().refine((v) => isUserRole(v), "Role tujuan tidak dikenal"),
  type: z.enum(["jadwal", "penugasan", "memo", "pengumuman"]),
  priority: z.enum(["penting", "segera", "sedang"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  time: z.string().trim().min(1).max(60),
  unread: z.boolean().optional().default(true),
});

/**
 * GET wajib login (requireRole([]), role apa pun boleh), non-admin dikunci
 * cuma bisa lihat update role dia sendiri — `?role=` dari query diabaikan
 * kecuali yang login admin, pola sama seperti preview `?role=`/`?jabatan=`
 * di dashboard/+page.svelte.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const { role: sessionRole } = await requireRole([]);
    const requestedRole = url.searchParams.get("role") ?? undefined;
    const role = sessionRole === "admin" ? requestedRole : sessionRole;
    return ok(await updatesRepo.listUpdates(role));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["kepala-balai"]);
    const body = await parseJson<unknown>(request);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const created = await updatesRepo.createUpdate(parsed.data);
    return ok(created, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
