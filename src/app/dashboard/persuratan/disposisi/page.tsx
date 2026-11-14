import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { hakPersuratan } from "@/lib/server/hak-persuratan";
import { disposisiSaya } from "@/lib/server/repositories/surat-masuk";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TabPersuratan } from "@/components/persuratan/tab-persuratan";
import { DaftarDisposisiSaya } from "@/components/persuratan/disposisi-saya";

export const metadata: Metadata = { title: "Disposisi untuk Saya" };

/** Disposisi surat masuk yang ditujukan kepada pegawai yang login (sama dengan aplikasi lama). */
export default async function HalamanDisposisi() {
  const p = await wajibPengguna();
  const hak = await hakPersuratan();
  return (
    <HalamanDasbor judul="Disposisi untuk Saya" keterangan="Disposisi surat masuk yang ditujukan kepada Anda." lebar="penuh">
      <TabPersuratan aktif="disposisi" hak={hak} />
      {p.pegawaiId ? (
        <DaftarDisposisiSaya daftar={await disposisiSaya(p.pegawaiId)} hariIni={isoTanggal(awalHariWib())} />
      ) : (
        <EmptyState title="Belum tertaut" description="Akun ini belum tertaut ke data pegawai." />
      )}
    </HalamanDasbor>
  );
}
