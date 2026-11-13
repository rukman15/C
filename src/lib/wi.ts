// Disalin dari src/lib/dokumen.ts aplikasi lama: jenjang Widyaiswara dan rentang bulan.
export type JenjangWi = "pertama" | "muda" | "madya" | "utama";

/** "WIDYAISWARA AHLI MADYA" -> "madya". Bukan WI / tak dikenali -> null. */
export function jenjangWi(jabatan: string | null | undefined): JenjangWi | null {
  const j = (jabatan ?? "").toLowerCase();
  if (!j.includes("widyaiswara")) return null;
  for (const k of ["pertama", "muda", "madya", "utama"] as const) if (j.includes(k)) return k;
  return null;
}

/** "2026-09" -> { awal: "2026-09-01", akhirEksklusif: "2026-10-01" }. */
export function rentangBulan(bulan: string): { awal: string; akhirEksklusif: string } {
  const [y, b] = bulan.split("-").map(Number);
  const ny = b === 12 ? y + 1 : y;
  const nb = b === 12 ? 1 : b + 1;
  return { awal: `${bulan}-01`, akhirEksklusif: `${ny}-${String(nb).padStart(2, "0")}-01` };
}
