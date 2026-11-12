import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { roleProfiles } from "@/lib/roles";
import { rapikanJabatanSurat } from "@/lib/jabatan";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor, Kartu } from "@/components/dasbor/halaman";
import { FormGantiSandi } from "./form-ganti-sandi";

export const metadata: Metadata = { title: "Akun & Kata Sandi" };

export default async function HalamanAkun() {
  const p = await wajibPengguna({ bolehSandiSementara: true });
  const peran = roleProfiles.find((r) => r.id === p.role)?.label ?? p.role;

  return (
    <HalamanDasbor judul="Akun & Kata Sandi" lebar="sempit">
      {p.wajibGantiSandi ? (
        <div role="alert" className="mb-4 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-pretty">
            Kata sandi Anda masih sementara atau sama dengan NIP. Ganti dulu sebelum memakai aplikasi; NIP tercantum di SK dan surat tugas
            sehingga mudah ditebak orang lain.
          </p>
        </div>
      ) : null}

      <Kartu>
        <h2 className="text-sm text-muted-foreground">Data akun</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Nama</dt>
          <dd>{p.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-mono text-xs leading-5">{p.email}</dd>
          <dt className="text-muted-foreground">Peran</dt>
          <dd>{p.sebagai ?? peran}</dd>
          {p.jabatan ? (
            <>
              <dt className="text-muted-foreground">Jabatan</dt>
              <dd>{rapikanJabatanSurat(p.jabatan)}</dd>
            </>
          ) : null}
        </dl>
      </Kartu>

      <Kartu className="mt-4">
        <h2 className="text-sm text-muted-foreground">Ganti kata sandi</h2>
        <p className="mt-1 text-sm text-muted-foreground">Setelah diganti, sesi di perangkat lain otomatis berakhir.</p>
        <FormGantiSandi wajib={p.wajibGantiSandi} />
      </Kartu>
    </HalamanDasbor>
  );
}
