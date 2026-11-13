import type { Metadata } from "next";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { IsiRincian } from "@/components/rincian/isi-rincian";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  return { title: h.boleh ? h.rincian.name : "Rincian Diklat" };
}

/** Bagian Rincian: ringkasan, kurikulum LAN, mata pelatihan & pengampu, dan daftar pengampu. */
export default async function HalamanRincian({ params }: Props) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null; // pesan sudah ditampilkan layout
  if (!h.lihatPenuh) {
    return <EmptyState title="Bagian ini bukan untuk Anda" description="Sebagai pengampu, buka bagian Tugas, Seminar, atau Penilaian." />;
  }
  return <IsiRincian rincian={h.rincian} bolehAtur={h.bolehAtur} />;
}
