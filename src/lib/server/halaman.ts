import "server-only";
import { redirect } from "next/navigation";
import { HALAMAN_AKUN } from "@/lib/akun";
import { getPengguna, type Pengguna } from "@/lib/server/pengguna";

/**
 * Penjaga halaman dasbor: belum login -> /login; kata sandi masih sementara/= NIP -> halaman akun
 * (kecuali halaman akun itu sendiri). Penjaga tampilan saja; API tetap memeriksa sendiri.
 */
export async function wajibPengguna(opsi: { bolehSandiSementara?: boolean } = {}): Promise<Pengguna> {
  const p = await getPengguna();
  if (!p) redirect("/login");
  if (p.wajibGantiSandi && !opsi.bolehSandiSementara) redirect(HALAMAN_AKUN);
  return p;
}
