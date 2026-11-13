import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { AppError } from "@/lib/server/errors";
import { aksesRuangCoaching } from "@/lib/server/akses-coaching";
import { getRuang } from "@/lib/server/repositories/coaching";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { RuangCoaching } from "@/components/coaching/ruang-coaching";

export const metadata: Metadata = { title: "Ruang Coaching" };

/** Ruang Coaching satu kelompok; hak (coach, penyelenggara, peserta, pembaca) dihitung server seperti aplikasi lama. */
export default async function HalamanRuangCoaching({ params, searchParams }: { params: Promise<{ kelompokId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ kelompokId }, { tab }] = await Promise.all([params, searchParams]);
  await wajibPengguna();
  try {
    const data = await getRuang(await aksesRuangCoaching(kelompokId));
    const tabAwal = tab === "forum" || (tab === "pantauan" && data.peran !== "peserta") ? tab : "sesi";
    return <RuangCoaching data={data} tabAwal={tabAwal} />;
  } catch (e) {
    if (e instanceof AppError) return <EmptyState title="Ruang coaching tidak bisa dibuka" description={e.message} />;
    throw e;
  }
}
