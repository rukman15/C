import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { pengguna } from "@/lib/server/akses-persuratan";
import { getCuti, hapusCuti, isiNomorCuti, putuskanCuti } from "@/lib/server/repositories/cuti";
import { skemaKeputusanCuti } from "@/lib/server/skema-persuratan";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Satu surat cuti (GET); isi nomor (PATCH { aksi: "nomor" }); hapus (DELETE). Setujui/tolak/batal hanya untuk
 * pengajuan LAMA yang masih "DIAJUKAN" — sejak 28 Okt 2026 cuti tidak diajukan/diputuskan di aplikasi.
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    return ok(await getCuti(params.id, await pengguna()));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pengguna();
    const parsed = skemaKeputusanCuti.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const k = parsed.data;
    if (k.aksi === "nomor") return ok(await isiNomorCuti(params.id, k, p));
    const r = await putuskanCuti(params.id, k, p);
    if (k.aksi !== "batal") await catatAudit(await pelakuSesi(), AKSI_AUDIT.CUTI_DIPUTUSKAN, r.pegawaiNama, `${r.label} ${r.mulai} s.d. ${r.selesai}: ${r.labelStatus}`);
    return ok(r);
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await hapusCuti(params.id, await pengguna());
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
