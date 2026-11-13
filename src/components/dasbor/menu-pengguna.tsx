"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, UserRound } from "lucide-react";
import { UserMenu, type ThemePreference } from "@/components/arc/user-menu/user-menu";
import { kirimJson } from "@/lib/api-klien";
import { HALAMAN_AKUN } from "@/lib/akun";
import { pasangTema, pilihanTersimpan } from "@/lib/tema";

export type InfoPengguna = { nama: string; email: string; keterangan: string };

/** Menu akun Arc: nama dan jabatan, tema (terang/gelap/sistem), akun, keluar dari semua perangkat, keluar. */
export function MenuPengguna({ pengguna }: { pengguna: InfoPengguna }) {
  const router = useRouter();
  const [tema, setTema] = useState<ThemePreference>("system");
  useEffect(() => setTema(pilihanTersimpan()), []);

  async function keluar(semua: boolean) {
    const res = await kirimJson("/api/auth/session" + (semua ? "?semua=1" : ""), "DELETE");
    if (!res.ok && res.status !== 401) return;
    router.replace("/login");
    router.refresh();
  }

  return (
    <UserMenu
      user={{ name: pengguna.nama, email: pengguna.email, plan: pengguna.keterangan }}
      theme={tema}
      onThemeChange={(t) => {
        setTema(t);
        pasangTema(t);
      }}
      items={[
        { label: "Akun & kata sandi", icon: <UserRound size={16} />, onSelect: () => router.push(HALAMAN_AKUN) },
        { label: "Keluar dari semua perangkat", icon: <MonitorSmartphone size={16} />, onSelect: () => void keluar(true) },
      ]}
      onSignOut={() => keluar(false)}
      showName
    />
  );
}
