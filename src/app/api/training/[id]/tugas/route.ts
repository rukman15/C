import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { penggunaTugas } from "@/lib/server/pengguna-tugas";
import * as repo from "@/lib/server/repositories/tugas";

/**
 * Tugas satu diklat (EB-038), sama dengan aplikasi lama. Pengelola diklat & Admin Penyelenggara "atur-penugasan": semua
 * jenis tugas; pengampu (penugasan WI disetujui): tugas pembelajaran mata pelatihannya; Kepala Balai/Kabag TU: baca.
 *  GET — daftar + rekap kiriman.  POST — buat.  PATCH — ubah { id, ... }.  DELETE ?tugasId= (ditolak bila sudah ada kiriman).
 */
type Ctx = { params: Promise<{ id: string }> };
const skemaIsian = z.object({
  jenis: z.string().max(40),
  judul: z.string().max(200),
  petunjuk: z.string().max(4000).nullish(),
  tenggat: z.string().max(10).nullish(),
  mataPelatihan: z.string().max(60).nullish(),
});

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return ok(await repo.getTugasDiklat(await penggunaTugas(), id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await penggunaTugas();
    const parsed = skemaIsian.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    await repo.tambahTugas(p, id, parsed.data);
    return ok(await repo.getTugasDiklat(p, id), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await penggunaTugas();
    const parsed = skemaIsian.extend({ id: z.string().min(1) }).safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const { id: tugasId, ...isian } = parsed.data;
    await repo.ubahTugas(p, id, tugasId, isian);
    return ok(await repo.getTugasDiklat(p, id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const p = await penggunaTugas();
    const tugasId = new URL(request.url).searchParams.get("tugasId");
    if (!tugasId) return fail("Tugas belum dipilih");
    await repo.hapusTugas(p, id, tugasId);
    return ok(await repo.getTugasDiklat(p, id));
  } catch (e) {
    return failFromError(e);
  }
}
