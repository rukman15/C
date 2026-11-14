import { ok, failFromError } from "@/lib/server/http";
import { ForbiddenError } from "@/lib/server/errors";
import {
  PEMBACA_SPD,
  PEMBERI_DISPOSISI,
  PEMUTUS_CUTI,
  PENCATAT_SURAT_MASUK,
  PEMBACA_SURAT_MASUK,
  PENGELOLA_CUTI,
  PENOMOR,
  PENYUSUN_NASKAH,
  pengguna,
  termasuk,
} from "@/lib/server/akses-persuratan";
import { pilihanPersuratan } from "@/lib/server/repositories/persuratan";

/**
 * Isian pilihan form persuratan + hak pengguna (untuk tampilan; server tetap memeriksa).
 * NIP pegawai hanya dikirim ke penyusun naskah & pengelola cuti.
 */
export async function GET() {
  try {
    const p = await pengguna();
    const hak = {
      susun: termasuk(p, PENYUSUN_NASKAH),
      nomor: termasuk(p, PENOMOR),
      catatMasuk: termasuk(p, PENCATAT_SURAT_MASUK),
      bacaMasuk: termasuk(p, PEMBACA_SURAT_MASUK),
      disposisi: termasuk(p, PEMBERI_DISPOSISI),
      kelolaCuti: termasuk(p, PENGELOLA_CUTI),
      putusCuti: termasuk(p, PEMUTUS_CUTI),
      spd: termasuk(p, PEMBACA_SPD),
    };
    // Daftar pegawai hanya untuk akun internal: punya hak persuratan atau tertaut ke data pegawai
    // (cuti/disposisi). Akun peserta luar (registrasi mandiri) tidak boleh melihat daftar pegawai.
    if (!p.pegawaiId && !Object.values(hak).some(Boolean)) throw new ForbiddenError();
    const data = await pilihanPersuratan();
    const nip = hak.susun || hak.kelolaCuti;
    return ok({
      hak,
      pegawaiId: p.pegawaiId,
      pegawai: data.pegawai.map((x) => ({ ...x, nip: nip ? x.nip : "" })),
      diklat: hak.susun ? data.diklat : [],
    });
  } catch (e) {
    return failFromError(e);
  }
}
