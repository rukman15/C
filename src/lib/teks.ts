/** Dua huruf awal nama untuk avatar, tanpa gelar depan (dr., drs., ir., prof., h.). */
export function inisial(nama: string): string {
  const kata = nama
    .replace(/^(dr|drs|ir|prof|h)\.\s*/i, "")
    .split(/[\s,]+/)
    .filter((k) => /^\p{L}/u.test(k));
  return ((kata[0]?.[0] ?? "") + (kata[1]?.[0] ?? "")).toUpperCase() || "?";
}
