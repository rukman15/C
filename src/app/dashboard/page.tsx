import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { menuAkun, pintasan } from "@/lib/navigasi";
import { roleProfiles } from "@/lib/roles";
import { rapikanJabatanSurat } from "@/lib/jabatan";
import { labelWewenang } from "@/lib/wewenang-penyelenggara";
import { wajibPengguna } from "@/lib/server/halaman";
import { HalamanDasbor, Kartu } from "@/components/dasbor/halaman";
import { IKON_MENU } from "@/components/dasbor/ikon";
import { BerandaPeserta } from "@/components/peserta/beranda-peserta";
import { listDiklatSaya } from "@/lib/server/repositories/belajar";

export const metadata: Metadata = { title: "Beranda" };

function namaDepan(nama: string): string {
  return nama.replace(/^(dr|drs|ir|prof|h)\.\s*/i, "").split(/[\s,]+/)[0] ?? "";
}

export default async function Beranda() {
  const p = await wajibPengguna();
  // Peserta: beranda ruang belajar (sama dengan aplikasi lama).
  if (p.role === "peserta") return <BerandaPeserta nama={p.name} list={await listDiklatSaya(p.email)} />;
  const menu = menuAkun({ role: p.role, pegawaiId: p.pegawaiId, koordinatorWi: p.koordinatorWi, anggotaTimDiklat: p.timDiklat.length > 0 });
  const butir = pintasan(menu, 8);
  const peran = roleProfiles.find((r) => r.id === p.role);
  const hariIni = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const depan = namaDepan(p.name);

  const keanggotaan = [
    p.sebagai ? `Bertindak sebagai ${p.sebagai}` : null,
    p.koordinatorWi ? "Koordinator Widyaiswara" : null,
    ...p.timDiklat.map((t) => `Tim ${t.nama}`),
    ...p.wewenang.map((w) => `Admin Penyelenggara: ${labelWewenang(w)}`),
  ].filter((x): x is string => !!x);

  return (
    <HalamanDasbor judul="Beranda" keterangan={`${depan ? `Selamat datang, ${depan} · ` : ""}${hariIni}`} lebar="penuh">
      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-1">
          <h2 className="text-sm text-muted-foreground">Akun Anda</h2>
          <p className="mt-3 text-lg font-medium">{p.name}</p>
          <p className="text-sm text-muted-foreground">{p.jabatan ? rapikanJabatanSurat(p.jabatan) : (peran?.label ?? p.role)}</p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Peran</dt>
              <dd className="text-right">{peran?.label ?? p.role}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate text-right font-mono text-xs leading-5">{p.email}</dd>
            </div>
          </dl>
          {keanggotaan.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {keanggotaan.map((k) => (
                <li key={k} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {k}
                </li>
              ))}
            </ul>
          ) : null}
        </Kartu>

        <Kartu className="lg:col-span-2">
          <h2 className="text-sm text-muted-foreground">Pintasan</h2>
          {butir.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada pintasan untuk peran ini.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {butir.map((b) => {
                const Ikon = IKON_MENU[b.ikon];
                return (
                  <li key={b.href}>
                    <Link
                      href={b.href}
                      className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-border-strong hover:bg-muted"
                    >
                      <Ikon className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">{b.label}</span>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Kartu>
      </div>

      <Kartu className="mt-4">
        <h2 className="text-sm text-muted-foreground">Versi baru sedang dibangun</h2>
        <p className="mt-2 max-w-2xl text-sm text-pretty">
          Tahap pertama berisi halaman masuk, menu sesuai peran, Beranda, dan Akun &amp; Kata Sandi. Halaman kerja lain (jadwal diklat, LMS,
          persuratan, kepegawaian) masih memakai aplikasi lama sampai dibangun ulang satu per satu.
        </p>
      </Kartu>
    </HalamanDasbor>
  );
}
