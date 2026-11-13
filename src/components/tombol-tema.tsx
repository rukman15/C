"use client";

import { useEffect, useState } from "react";
import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";
import { pasangTema, temaSekarang } from "@/lib/tema";

/** Tombol tema Arc (ikon saja); tema baru membuka dari posisi tombol. */
export function TombolTema() {
  const [tema, setTema] = useState<Theme>("light");
  useEffect(() => setTema(temaSekarang()), []);

  return (
    <ThemeSwitch
      theme={tema}
      iconOnly
      label={tema === "dark" ? "Pakai tema terang" : "Pakai tema gelap"}
      onThemeChange={(next, _varian, tombol) => {
        setTema(next);
        pasangTema(next, tombol);
      }}
    />
  );
}
