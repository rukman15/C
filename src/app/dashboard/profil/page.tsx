import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/server/halaman";
import { getProfilSaya } from "@/lib/server/repositories/registrasi";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { ProfilSaya } from "@/components/peserta/profil-saya";

export const metadata: Metadata = { title: "Profil Saya" };

/** Profil Saya: peserta hasil registrasi mandiri (sama dengan aplikasi lama; API hanya untuk peran peserta). */
export default async function HalamanProfil() {
  const p = await wajibPengguna();
  if (p.role !== "peserta") redirect("/dashboard");
  const data = await getProfilSaya(p.email);
  return (
    <HalamanDasbor judul="Profil Saya" keterangan="Data ini dipakai saat Anda mendaftar dan mengikuti pelatihan berikutnya.">
      {data ? (
        <ProfilSaya awal={data} />
      ) : (
        <p className="max-w-2xl text-sm text-muted-foreground">
          Akun Anda dibuat oleh penyelenggara, jadi belum punya profil registrasi. Perubahan data dilakukan melalui penyelenggara pelatihan.
        </p>
      )}
    </HalamanDasbor>
  );
}
