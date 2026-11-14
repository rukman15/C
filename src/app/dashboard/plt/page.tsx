import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listPegawai } from "@/lib/server/repositories/pegawai";
import { listPenugasanSementara } from "@/lib/server/repositories/plt";
import { statusMenutupAkun } from "@/lib/plt";
import { awalHariWib, isoTanggal } from "@/lib/tanggal";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Plt } from "@/components/menu/plt";

export const metadata: Metadata = { title: "Plt / Plh" };

/** Plt / Plh — Administrator dan Kepegawaian (sama dengan aplikasi lama). */
export default async function HalamanPlt() {
  const p = await wajibPengguna();
  if (p.role !== "admin" && p.role !== "kepegawaian")
    return (
      <HalamanDasbor judul="Plt / Plh">
        <EmptyState title="Tidak berwenang" description="Halaman ini untuk Administrator dan Kepegawaian." />
      </HalamanDasbor>
    );
  const [list, pegawai] = await Promise.all([listPenugasanSementara(), listPegawai()]);
  return (
    <HalamanDasbor judul="Plt / Plh">
      <Plt
        awal={list}
        isAdmin={p.role === "admin"}
        hariIni={isoTanggal(awalHariWib())}
        pegawai={pegawai.filter((x) => !statusMenutupAkun(x.status)).map((x) => ({ id: x.id, nama: x.nama, nip: x.nip ?? null, jabatan: x.jabatan ?? null }))}
      />
    </HalamanDasbor>
  );
}
