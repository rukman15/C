import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { listRegistrasi } from "@/lib/server/repositories/registrasi";
import { STATUS_REGISTRASI, type StatusRegistrasi } from "@/lib/registrasi";

/** Daftar registrasi peserta (?status=MENUNGGU|DISETUJUI) — admin & Ketua Diklat. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await requireRole(["admin", "ketua-diklat"]);
    const s = url.searchParams.get("status");
    const status = STATUS_REGISTRASI.includes(s as StatusRegistrasi) ? (s as StatusRegistrasi) : undefined;
    return ok(await listRegistrasi(status));
  } catch (e) {
    return failFromError(e);
  }
}
