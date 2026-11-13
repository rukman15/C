import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { catatAktivitas } from "@/lib/server/aktivitas";
import { hapusSesiPembelajaran, ubahSesiPembelajaran } from "@/lib/server/repositories/pembelajaran";
import { pesanZod, skemaUbahSesiPembelajaran } from "@/lib/data-pembelajaran";

/** Ubah / hapus satu sesi pembelajaran (Ketua Diklat; admin selalu boleh). */
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaUbahSesiPembelajaran.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const sesi = await ubahSesiPembelajaran(id, parsed.data);
    await catatAktivitas({
      trainingId: sesi.trainingId,
      aktor: s,
      jenis: "SESI_DIUBAH",
      objekTipe: "sesi",
      objekId: sesi.id,
      ringkasan: `Sesi diubah: ${sesi.mataPelatihanNama ?? sesi.kegiatan} (${sesi.tanggal})`,
    });
    return ok(sesi);
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat"]);
    await hapusSesiPembelajaran(id);
    return ok({ id });
  } catch (e) {
    return failFromError(e);
  }
}
