import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { catatAktivitas } from "@/lib/server/aktivitas";
import { listSesiPembelajaran, tambahSesiPembelajaran } from "@/lib/server/repositories/pembelajaran";
import { pesanZod, skemaTambahSesiPembelajaran } from "@/lib/data-pembelajaran";

/**
 * Jadwal pembelajaran satu pelatihan (sama dengan aplikasi lama).
 *  GET  — daftar sesi + rekap kehadiran (Ketua Diklat, Kepala Balai; admin selalu boleh).
 *  POST — tambah satu atau banyak sesi (Ketua Diklat; admin selalu boleh).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireRole(["ketua-diklat", "kepala-balai"]);
    return ok(await listSesiPembelajaran(id));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat"]);
    const parsed = skemaTambahSesiPembelajaran.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const dibuat = await tambahSesiPembelajaran(id, parsed.data.sesi, s.email);
    await catatAktivitas({
      trainingId: id,
      aktor: s,
      jenis: "SESI_DIUBAH",
      objekTipe: "sesi",
      ringkasan: dibuat.length === 1 ? `Sesi ditambahkan: ${dibuat[0].mataPelatihanNama ?? dibuat[0].kegiatan} (${dibuat[0].tanggal})` : `${dibuat.length} sesi pembelajaran ditambahkan`,
    });
    return ok(dibuat, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
