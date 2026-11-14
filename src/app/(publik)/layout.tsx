import { getPengguna } from "@/lib/server/pengguna";
import { KepalaPublik } from "@/components/publik/kepala";
import { KakiPublik } from "@/components/publik/bagian";

/** Kerangka situs publik: bilah atas, isi, kaki halaman (halaman dasbor, cetak, dan masuk tidak memakainya). */
export default async function LayoutPublik({ children }: { children: React.ReactNode }) {
  const p = await getPengguna();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <KepalaPublik masuk={!!p} />
      <main className="flex-1">{children}</main>
      <KakiPublik />
    </div>
  );
}
