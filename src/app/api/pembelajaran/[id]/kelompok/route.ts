import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { catatAktivitas } from "@/lib/server/aktivitas";
import { aturPerKelompok } from "@/lib/server/repositories/pembelajaran";
import { pesanZod, skemaPerKelompok } from "@/lib/data-pembelajaran";

/** PUT pengajar & tautan Zoom per kelompok e-learning untuk satu sesi (EB-052). Ketua Diklat; admin selalu boleh. */
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaPerKelompok.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const sesi = await aturPerKelompok(id, parsed.data.baris, s.email);
    await catatAktivitas({
      trainingId: sesi.trainingId,
      aktor: s,
      jenis: "SESI_DIUBAH",
      objekTipe: "sesi",
      objekId: sesi.id,
      ringkasan: `Pengajar per kelompok diatur: ${sesi.mataPelatihanNama ?? sesi.kegiatan} (${sesi.tanggal})`,
    });
    return ok(sesi);
  } catch (e) {
    return failFromError(e);
  }
}
