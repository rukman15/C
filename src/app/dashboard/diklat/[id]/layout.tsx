import { muatHalamanDiklat } from "@/lib/server/diklat-halaman";
import { tabDiklat } from "@/lib/rincian";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { KepalaDiklat } from "@/components/rincian/kepala-diklat";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

/** Kerangka halaman satu diklat: judul, lencana, aksi, dan tab ke setiap bagian. */
export default async function LayoutDiklat({ params, children }: Props) {
  const { id } = await params;
  const h = await muatHalamanDiklat(id);
  if (!h.boleh) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-medium tracking-tight">Rincian Diklat</h1>
        <EmptyState title="Tidak berwenang" description={h.alasan} />
      </div>
    );
  }
  const berprogram = !!h.rincian.jenisPelatihan && !!h.rincian.modePelatihan;
  return (
    <div className="mx-auto w-full max-w-7xl">
      <KepalaDiklat
        rincian={h.rincian}
        tab={tabDiklat(berprogram, h.hanyaPenilaian)}
        bolehAtur={h.bolehAtur}
        bolehHapus={h.bolehHapus}
        global={h.global}
        pilihanTim={h.pilihanTim}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
