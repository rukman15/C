"use client";

/** Tema tampilan (Arc: data-theme di <html>), disimpan di perangkat ini. */
export type Tema = "light" | "dark";
export type PilihanTema = Tema | "system";

const KUNCI = "tema";

export function temaSekarang(): Tema {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function pilihanTersimpan(): PilihanTema {
  try {
    const v = localStorage.getItem(KUNCI);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function terapkan(t: Tema) {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
}

/**
 * Pasang tema; dengan `asal` (tombol yang ditekan) tema baru "membuka" dari posisi tombol
 * lewat View Transition. Tanpa dukungan browser atau dengan gerak dikurangi: langsung berganti.
 */
export function pasangTema(pilihan: PilihanTema, asal?: HTMLElement) {
  try {
    if (pilihan === "system") localStorage.removeItem(KUNCI);
    else localStorage.setItem(KUNCI, pilihan);
  } catch {
    // Penyimpanan diblokir: tema tetap berganti untuk kunjungan ini.
  }
  const t: Tema = pilihan === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pilihan;
  const gerakKurang = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!asal || gerakKurang || !document.startViewTransition) return terapkan(t);
  const { left, top, width, height } = asal.getBoundingClientRect();
  document.documentElement.style.setProperty("--x", `${left + width / 2}px`);
  document.documentElement.style.setProperty("--y", `${top + height / 2}px`);
  document.startViewTransition(() => terapkan(t));
}
