// Disalin dari src/lib/tata-naskah.ts (aplikasi lama): hanya bagian untuk menampilkan jabatan.
const KATA_SAMBUNG = new Set(["dan", "atau", "serta", "dalam", "di", "ke", "dari", "pada", "untuk", "yang", "bagi", "oleh", "terhadap", "dengan"]);
// Singkatan yang tetap kapital.
const SINGKATAN_JABATAN = new Set(["TU", "SDM", "ASN", "PNS", "PPPK", "UPT", "TI", "IT", "LAN", "BPSDM", "BBPKA", "PDN", "APDN", "DIPA", "SPD", "PPK", "JF", "JFT", "JFU", "BMN", "ULP", "RI", "KDH"]);
const ROMAWI = /^(?:X{0,3})(?:IX|IV|V?I{0,3})$/;

/**
 * Jabatan dari Data Pegawai (kapital semua, mis. "WIDYAISWARA AHLI UTAMA") untuk naskah dinas:
 * huruf awal kapital, kata sambung kecil ("dan", "dalam" …, kecuali di awal), singkatan & angka
 * Romawi tetap kapital, "Dalam Negeri" tetap (nama resmi). Jabatan yang sudah campuran dibiarkan.
 */
export function rapikanJabatanSurat(jabatan: string): string {
  const t = jabatan.trim().replace(/\s+/g, " ");
  if (!t || t !== t.toUpperCase() || !/\p{L}/u.test(t)) return t;
  const kata = t.split(" ");
  return kata
    .map((w, i) => {
      if (w.includes(".")) return w;
      return w
        .split("-")
        .map((bagian) => {
          if (!bagian) return bagian;
          if (SINGKATAN_JABATAN.has(bagian) || (bagian.length > 0 && ROMAWI.test(bagian))) return bagian;
          const kecil = bagian.toLowerCase();
          const dalamNegeri = kecil === "dalam" && kata[i + 1] === "NEGERI";
          if (i > 0 && KATA_SAMBUNG.has(kecil) && !dalamNegeri) return kecil;
          return kecil.charAt(0).toUpperCase() + kecil.slice(1);
        })
        .join("-");
    })
    .join(" ");
}
