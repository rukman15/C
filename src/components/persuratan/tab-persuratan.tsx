import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HakPersuratan } from "@/lib/server/hak-persuratan";

export type KunciTabPersuratan = "naskah" | "surat-tugas" | "surat-masuk" | "disposisi" | "spd" | "cuti";

/** Baris tab modul persuratan (sama dengan aplikasi lama); tampil menurut hak, server tetap memeriksa. */
export function TabPersuratan({ aktif, hak }: { aktif: KunciTabPersuratan; hak: HakPersuratan }) {
  const tabs = [
    { kunci: "naskah", label: "Naskah Dinas", href: "/dashboard/persuratan", tampil: hak.susun || hak.nomor },
    { kunci: "surat-tugas", label: "Surat Tugas", href: "/dashboard/persuratan/surat-tugas", tampil: hak.susun || hak.nomor },
    { kunci: "surat-masuk", label: "Surat Masuk", href: "/dashboard/persuratan/surat-masuk", tampil: true },
    { kunci: "disposisi", label: "Disposisi untuk Saya", href: "/dashboard/persuratan/disposisi", tampil: true },
    { kunci: "spd", label: "SPD", href: "/dashboard/persuratan/spd", tampil: hak.spd },
    { kunci: "cuti", label: "Cuti", href: "/dashboard/cuti", tampil: hak.kelolaCuti },
  ].filter((t) => t.tampil);
  return (
    <nav aria-label="Bagian persuratan" className="tanpa-bilah -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4">
      {tabs.map((t) => (
        <Link
          key={t.kunci}
          href={t.href}
          aria-current={aktif === t.kunci ? "page" : undefined}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
            aktif === t.kunci ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
