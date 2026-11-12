import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPengguna } from "@/lib/server/pengguna";
import { HALAMAN_AKUN } from "@/lib/akun";
import { INDUK_LEMBAGA, LEMBAGA_SINGKAT, NAMA_APLIKASI, NAMA_LENGKAP } from "@/lib/aplikasi";
import { FormMasuk } from "./form-masuk";
import { TombolTema } from "@/components/tombol-tema";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  const p = await getPengguna();
  if (p) redirect(p.wajibGantiSandi ? HALAMAN_AKUN : "/dashboard");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <TombolTema />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-6 flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground">
            eB
          </div>
          <h1 className="text-2xl font-medium tracking-tight">Masuk ke {NAMA_APLIKASI}</h1>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">{NAMA_LENGKAP}</p>
        </div>
        <FormMasuk />
        <p className="mt-8 text-xs text-muted-foreground">
          Lupa kata sandi? Hubungi admin {LEMBAGA_SINGKAT} untuk mengatur ulang.
        </p>
      </div>
      <p className="absolute bottom-4 px-4 text-center text-xs text-muted-foreground">
        {INDUK_LEMBAGA} · {LEMBAGA_SINGKAT}
      </p>
    </main>
  );
}
