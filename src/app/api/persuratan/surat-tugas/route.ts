import { ok, failFromError } from "@/lib/server/http";
import { PENOMOR, PENYUSUN_NASKAH, pengguna } from "@/lib/server/akses-persuratan";
import { daftarSuratTugas } from "@/lib/server/repositories/surat-tugas-semua";

/** Satu daftar surat tugas (mengajar + umum) per tahun (?tahun=). Penyusun naskah & TU. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna([...PENYUSUN_NASKAH, ...PENOMOR]);
    const tahun = Number(url.searchParams.get("tahun") ?? "") || new Date().getUTCFullYear();
    return ok(await daftarSuratTugas(tahun));
  } catch (e) {
    return failFromError(e);
  }
}
