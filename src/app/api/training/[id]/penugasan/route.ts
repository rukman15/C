import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { ForbiddenError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { hakPenugasan } from "@/lib/server/hak-penugasan";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { catatAktivitas } from "@/lib/server/aktivitas";
import * as repo from "@/lib/server/repositories/penugasan-angkatan";

/**
 * Penugasan per angkatan (EB-035): coach, mentor, penguji, penguji akademik, pendamping studi lapangan. Sama dengan aplikasi lama.
 *  GET — kelola & baca.  POST — tambah (lolos larangan rangkap).  PATCH { id, aksi: setujui | tolak | cabut, alasan? }.
 */
type Ctx = { params: Promise<{ id: string }> };
const skemaTambah = z.object({
  peran: z.string(),
  pegawaiId: z.string().min(1).nullish(),
  namaLuar: z.string().max(120).nullish(),
  jabatanLuar: z.string().max(160).nullish(),
  instansiLuar: z.string().max(160).nullish(),
  emailLuar: z.string().max(160).nullish(),
  ponselLuar: z.string().max(30).nullish(),
  pesertaIds: z.array(z.string()).max(200).default([]),
  kelompokIds: z.array(z.string()).max(50).default([]),
  mulai: z.string().max(10).nullish(),
  selesai: z.string().max(10).nullish(),
  dasar: z.string().max(200).nullish(),
});
const skemaAksi = z.object({ id: z.string().min(1), aksi: z.enum(["setujui", "tolak", "cabut"]), alasan: z.string().max(300).nullish() });

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const h = await hakPenugasan(id);
    if (!h.baca) throw new ForbiddenError();
    return ok(await repo.getPenugasanAngkatan(id, h.kelola));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const h = await hakPenugasan(id);
    if (!h.kelola) throw new ForbiddenError();
    const parsed = skemaTambah.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const ringkas = await repo.tambahPenugasan(id, parsed.data, h.a.email);
    const pelaku = await pelakuSesi();
    await catatAudit(pelaku, AKSI_AUDIT.PENUGASAN_ANGKATAN, ringkas, "Ditambahkan");
    await catatAktivitas({ trainingId: id, aktor: pelaku, jenis: "PENUGASAN_DIUBAH", objekTipe: "penugasan", ringkasan: `Penugasan ditambahkan: ${ringkas}` });
    return ok(await repo.getPenugasanAngkatan(id, true), { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const h = await hakPenugasan(id);
    if (!h.kelola) throw new ForbiddenError();
    const parsed = skemaAksi.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const ringkas = await repo.ubahStatusPenugasan(id, parsed.data.id, parsed.data.aksi, parsed.data.alasan ?? null, h.a.email);
    const pelaku = await pelakuSesi();
    await catatAudit(pelaku, AKSI_AUDIT.PENUGASAN_ANGKATAN, ringkas);
    await catatAktivitas({ trainingId: id, aktor: pelaku, jenis: "PENUGASAN_DIUBAH", objekTipe: "penugasan", ringkasan: ringkas });
    return ok(await repo.getPenugasanAngkatan(id, true));
  } catch (e) {
    return failFromError(e);
  }
}
