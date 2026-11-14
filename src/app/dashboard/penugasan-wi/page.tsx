import { redirect } from "next/navigation";

/**
 * Halaman Penugasan WI dihapus (27 Okt 2026): pengampu ditetapkan langsung di Rincian Diklat. Tautan lama tetap jalan:
 * ?tugaskan=<id diklat>[&mp=<kode>] -> Rincian Diklat; selain itu -> Jadwal Diklat.
 */
export default async function PenugasanWi({ searchParams }: { searchParams: Promise<{ tugaskan?: string; mp?: string }> }) {
  const { tugaskan, mp } = await searchParams;
  if (tugaskan) redirect(`/dashboard/diklat/${encodeURIComponent(tugaskan)}?tugaskan=1${mp ? `&mp=${encodeURIComponent(mp)}` : ""}`);
  redirect("/dashboard/jadwal");
}
