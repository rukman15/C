import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { tabDiklat } from "@/lib/rincian";
import { EmptyState } from "@/components/arc/empty-state/empty-state";

type Props = { params: Promise<{ id: string; bagian: string }> };

/** Bagian halaman diklat yang belum dibangun ulang (Peserta, Absensi, Penilaian, dan seterusnya). */
export default async function BagianDiklat({ params }: Props) {
  const { id, bagian } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) return null; // pesan sudah ditampilkan layout
  const berprogram = !!h.rincian.jenisPelatihan && !!h.rincian.modePelatihan;
  const tab = tabDiklat(berprogram, h.hanyaPenilaian).find((t) => t.jalur === `/${bagian}`);
  if (!tab) notFound();
  return (
    <EmptyState
      icon={<Hammer size={20} />}
      title={`${tab.label} belum dibangun ulang`}
      description={`Bagian ini masih tersedia di aplikasi lama pada alamat /dashboard/diklat/${id}/${bagian}. Versi barunya menyusul.`}
    />
  );
}
