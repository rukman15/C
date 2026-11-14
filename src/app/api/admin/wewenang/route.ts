import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { requireRole, getActiveSession } from "@/lib/server/auth";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { pesanZod } from "@/lib/server/skema-lms";
import { labelWewenang } from "@/lib/wewenang-penyelenggara";
import * as repo from "@/lib/server/repositories/wewenang-penyelenggara";

/**
 * Admin Penyelenggara (EB-034): Super Admin (akun admin) menunjuk pegawai dan memilih wewenangnya.
 *  GET    — daftar penunjukan + pilihan pegawai aktif.
 *  PUT    — tunjuk/ubah { pegawaiId, wewenang[], dasar? }.
 *  DELETE — cabut ?pegawaiId=.
 * Semua perubahan masuk Log Audit.
 */
const skema = z.object({
  pegawaiId: z.string().min(1),
  wewenang: z.array(z.string()).max(20),
  dasar: z.string().max(200).nullish(),
});

export async function GET() {
  try {
    await requireRole(["admin"]);
    return ok(await repo.listWewenang());
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(["admin"]);
    const s = (await getActiveSession());
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const nama = await repo.simpanWewenang(parsed.data.pegawaiId, parsed.data.wewenang, parsed.data.dasar ?? null, s?.email ?? "admin");
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.WEWENANG_PENYELENGGARA, nama, parsed.data.wewenang.map(labelWewenang).join(", "));
    return ok(await repo.listWewenang());
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  try {
    await requireRole(["admin"]);
    const pegawaiId = url.searchParams.get("pegawaiId");
    if (!pegawaiId) return fail("pegawaiId wajib diisi");
    const nama = await repo.hapusWewenang(pegawaiId);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.WEWENANG_DICABUT, nama);
    return ok(await repo.listWewenang());
  } catch (e) {
    return failFromError(e);
  }
}
