import { redirect } from "next/navigation";
import { getPengguna } from "@/lib/server/pengguna";

/** Tahap 1 belum membangun ulang situs publik: langsung ke dasbor atau halaman masuk. */
export default async function Home() {
  const p = await getPengguna();
  redirect(p ? "/dashboard" : "/login");
}
