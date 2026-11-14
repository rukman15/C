import { ok, fail, failFromError } from "@/lib/server/http";
import { PENYUSUN_NASKAH, pengguna } from "@/lib/server/akses-persuratan";
import { bawaanNaskahBaru } from "@/lib/server/repositories/persuratan";
import { isJenisNaskah } from "@/lib/persuratan";

/**
 * Isian awal naskah baru: ?jenis=…&trainingId=…&suratMasukId=…&notaId=… (teks bawaan, data diklat, penanda tangan;
 * surat tugas dari disposisi: dasar = surat masuk, penerima = pegawai yang didisposisi; dari nota usulan:
 * penerima = pegawai usulan, tanggal = sesi studi lapangan).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const p = await pengguna(PENYUSUN_NASKAH);
    const jenis = url.searchParams.get("jenis");
    if (!isJenisNaskah(jenis)) return fail("Jenis naskah tidak dikenal");
    return ok(
      await bawaanNaskahBaru(jenis, url.searchParams.get("trainingId") || null, p, url.searchParams.get("suratMasukId") || null, url.searchParams.get("notaId") || null),
    );
  } catch (e) {
    return failFromError(e);
  }
}
