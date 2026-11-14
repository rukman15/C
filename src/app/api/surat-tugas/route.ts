import { ok, failFromError } from "@/lib/server/http";
import { aksesDiklat } from "@/lib/server/akses";
import { bolehBacaSurat } from "@/lib/server/akses-dokumen";
import { bolehKelolaDiklat } from "@/lib/tim-kerja";
import { listSemuaSuratTugas } from "@/lib/server/repositories/dokumen";

/**
 * Menu Unduh Dokumen: semua surat tugas yang boleh dibaca peminta (?tahun=YYYY).
 * Pembaca surat (Kepala Balai, Kabag TU) & Ketua Diklat/admin: semua; anggota tim: diklat timnya;
 * siapa pun: surat yang ditujukan kepadanya.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const a = await aksesDiklat();
    const t = Number(url.searchParams.get("tahun"));
    const tahun = Number.isInteger(t) && t >= 2000 && t <= 2100 ? t : null;
    const daftar = (await listSemuaSuratTugas(tahun)).filter((s) => bolehBacaSurat(a, s));
    return ok(
      daftar.map(({ pegawaiIds: _p, timKerjaId, ...s }) => ({
        ...s,
        // Rincian diklat hanya bisa dibuka pengelola diklat & pimpinan; penerima cukup mengunduh.
        bolehBukaDiklat: a.global || a.role === "kepala-balai" || bolehKelolaDiklat(a, timKerjaId),
      })),
    );
  } catch (e) {
    return failFromError(e);
  }
}
