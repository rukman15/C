import "server-only";
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

export type HakPersuratan = {
  susun: boolean;
  nomor: boolean;
  catatMasuk: boolean;
  bacaMasuk: boolean;
  disposisi: boolean;
  kelolaCuti: boolean;
  putusCuti: boolean;
  spd: boolean;
};

/** Hak modul persuratan pengguna yang login (untuk tampilan; API tetap memeriksa). Sama dengan /api/persuratan/pilihan. */
export async function hakPersuratan(): Promise<HakPersuratan> {
  const p = await pengguna();
  return {
    susun: termasuk(p, PENYUSUN_NASKAH),
    nomor: termasuk(p, PENOMOR),
    catatMasuk: termasuk(p, PENCATAT_SURAT_MASUK),
    bacaMasuk: termasuk(p, PEMBACA_SURAT_MASUK),
    disposisi: termasuk(p, PEMBERI_DISPOSISI),
    kelolaCuti: termasuk(p, PENGELOLA_CUTI),
    putusCuti: termasuk(p, PEMUTUS_CUTI),
    spd: termasuk(p, PEMBACA_SPD),
  };
}
