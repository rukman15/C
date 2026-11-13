import type { Metadata } from "next";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { judulDariAlamat } from "@/lib/navigasi";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor, Kartu } from "@/components/dasbor/halaman";

type Props = { params: Promise<{ halaman: string[] }> };

function alamat(segmen: string[]) {
  return "/dashboard/" + segmen.map(encodeURIComponent).join("/");
}

/** Judul halaman yang tidak punya butir menu sendiri (dibuka dari halaman lain). */
function judul(path: string): string | null {
  if (/^\/dashboard\/diklat\/[^/]+\/penilaian$/.test(path)) return "Penilaian Peserta";
  if (/^\/dashboard\/diklat\/[^/]+/.test(path)) return "Rincian Diklat";
  return judulDariAlamat(path);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { halaman } = await params;
  return { title: judul(alamat(halaman)) ?? "Belum tersedia" };
}

/** Halaman menu yang belum dibangun ulang di v2. */
export default async function BelumDibangun({ params }: Props) {
  await wajibPengguna();
  const { halaman } = await params;
  const path = alamat(halaman);
  const teksJudul = judul(path) ?? "Halaman tidak ditemukan";

  return (
    <HalamanDasbor judul={teksJudul} lebar="sempit">
      <Kartu className="flex flex-col items-start gap-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Hammer className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-medium">Belum dibangun ulang</h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Halaman ini masih tersedia di aplikasi lama pada alamat <span className="font-mono text-foreground">{path}</span>. Versi barunya
            menyusul di tahap berikutnya.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Kembali ke Beranda
        </Link>
      </Kartu>
    </HalamanDasbor>
  );
}
