import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { pemilikPustaka } from "@/lib/server/akses-coaching";
import { listPustaka } from "@/lib/server/repositories/coaching";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PustakaVideo } from "@/components/coaching/pustaka-video";

export const metadata: Metadata = { title: "Pustaka Video Saya" };

/** Pustaka Video Saya: video YouTube milik WI/pengelola untuk dipasang di Ruang Coaching (sama dengan aplikasi lama). */
export default async function HalamanPustaka() {
  await wajibPengguna();
  try {
    const { pegawaiId } = await pemilikPustaka();
    const daftar = await listPustaka(pegawaiId);
    return (
      <HalamanDasbor judul="Pustaka Video Saya" keterangan="Video YouTube Anda untuk dipasang di Ruang Coaching kelompok mana pun, di angkatan mana pun.">
        <PustakaVideo awal={daftar} />
      </HalamanDasbor>
    );
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Pustaka video belum tersedia" description={e.message} />;
    throw e;
  }
}
