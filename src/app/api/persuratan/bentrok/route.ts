import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENOMOR, PENYUSUN_NASKAH, pengguna } from "@/lib/server/akses-persuratan";
import { bentrokPegawai } from "@/lib/server/repositories/bentrok-tugas";
import { skemaCekBentrok } from "@/lib/server/skema-persuratan";

/**
 * Cek bentrok jadwal pegawai per tanggal (untuk tanda di daftar pilihan surat tugas). Server tetap
 * menolak bentrok tingkat "cegah" saat menyimpan.
 */
export async function POST(request: Request) {
  try {
    await pengguna([...PENYUSUN_NASKAH, ...PENOMOR]);
    const parsed = skemaCekBentrok.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const d = parsed.data;
    return ok(await bentrokPegawai(d.pegawaiIds, d.tanggalTugas, { konteks: d.konteks, naskahId: d.naskahId, suratTugasId: d.suratTugasId, trainingId: d.trainingId }));
  } catch (e) {
    return failFromError(e);
  }
}
