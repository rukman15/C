import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { ValidationError } from "@/lib/server/errors";
import { bacaTanggalIso } from "@/lib/tanggal";
import { KEWENANGAN_TTD } from "@/lib/tata-naskah";
import { pilihanTtd } from "@/lib/server/repositories/penandatangan";

/**
 * Pilihan penanda tangan yang sah untuk jenis naskah pada tanggal surat (Permendagri 18/2024
 * Lampiran VIII): Kepala Balai, Plt./Plh. yang berlaku, dan Kabag TU (a.n./jabatan sendiri) sesuai jenis.
 * Untuk semua akun internal penyusun surat (bukan peserta).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await requireRole(["admin", "kepala-balai", "kabag-tu", "ketua-diklat", "widyaiswara", "kepegawaian", "keuangan", "pamdal"]);
    const jenis = url.searchParams.get("jenis") ?? "";
    const tanggal = url.searchParams.get("tanggal") ?? "";
    if (!(jenis in KEWENANGAN_TTD)) throw new ValidationError("Jenis naskah tidak dikenal");
    if (bacaTanggalIso(tanggal) === null) throw new ValidationError("Tanggal surat tidak valid");
    return ok({ wajib: KEWENANGAN_TTD[jenis].wajib, pilihan: await pilihanTtd(jenis, tanggal) });
  } catch (e) {
    return failFromError(e);
  }
}
