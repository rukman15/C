/**
 * Pembantu MURNI untuk daftar peserta pelatihan — dipakai server (validasi) dan
 * halaman (tempel banyak baris dari Excel), supaya aturannya satu tempat.
 */
import type { BarisGalat } from "@/lib/sesi";

export const STATUS_PESERTA = ["AKTIF", "MENGUNDURKAN_DIRI", "DIBERHENTIKAN"] as const;
export type StatusPeserta = (typeof STATUS_PESERTA)[number];

export const LABEL_STATUS_PESERTA: Record<StatusPeserta, string> = {
  AKTIF: "Aktif",
  MENGUNDURKAN_DIRI: "Mengundurkan diri",
  DIBERHENTIKAN: "Diberhentikan",
};

export function isStatusPeserta(v: unknown): v is StatusPeserta {
  return typeof v === "string" && (STATUS_PESERTA as readonly string[]).includes(v);
}

/** Batas banyaknya peserta dalam satu kali simpan. */
export const PESERTA_MAKS_PER_PERMINTAAN = 200;
export const NAMA_PESERTA_MAKS = 150;
export const TEKS_PESERTA_MAKS = 200; // jabatan, instansi

export type PesertaInput = {
  nama: string;
  nip?: string | null;
  jabatan?: string | null;
  instansi?: string | null;
};

/**
 * Rapikan tulisan NIP/NRP: buang spasi, titik, strip, dan tanda petik awal
 * (cara Excel menyimpan angka panjang sebagai teks). Kosong = tidak diisi.
 * Hasil harus 5–20 angka. Excel yang mengubah NIP menjadi "1,98E+17" ditolak
 * dengan pesan yang menyebut sebabnya.
 */
const ANGKA_ILMIAH = /^\d+([.,]\d+)?e\+?\d+$/i;

export function rapikanNip(teks: string | null | undefined): { nip: string | null; galat?: string } {
  const mentah = (teks ?? "").trim();
  if (!mentah || mentah === "-") return { nip: null };
  if (ANGKA_ILMIAH.test(mentah)) {
    return {
      nip: null,
      galat: `NIP "${mentah}" sudah diubah Excel menjadi angka ilmiah — ubah kolom NIP ke format Teks lalu salin ulang`,
    };
  }
  // "198501012010011001.0" / ",00": desimal kosong buatan spreadsheet, bukan bagian NIP.
  const nip = mentah
    .replace(/^'/, "")
    .replace(/[.,]0+$/, "")
    .replace(/[\s.\-]/g, "");
  if (!/^\d{5,20}$/.test(nip)) return { nip: null, galat: `NIP "${mentah}" harus 5–20 angka` };
  return { nip };
}

const SEL_JUDUL = /^(no\.?|nomor|nama(\s+(lengkap|peserta))?|nip|nrp|nip\s*\/\s*nrp|jabatan|instansi(\s+asal)?|asal\s+instansi|unit\s+kerja)$/i;

/**
 * Baris judul kolom? Hanya diperiksa pada baris PERTAMA yang berisi, dan harus
 * jelas: satu kolom bertuliskan "Nama"/"Nama lengkap", atau sedikitnya dua
 * kolom yang persis kata judul. (Peserta bernama "Nip Suryani" bukan judul.)
 */
function adalahJudul(kol: string[]): boolean {
  if (kol.length === 1) return /^nama(\s+(lengkap|peserta))?$/i.test(kol[0]);
  return kol.filter((c) => SEL_JUDUL.test(c)).length >= 2;
}

/**
 * Baca banyak peserta dari teks tempelan (satu baris = satu peserta). Kolom
 * dipisah Tab, "|" atau ";" (koma tidak dipakai: nama bergelar memuat koma,
 * mis. "Dr. Arya, M.Si"). Baris tanpa pemisah dianggap nama saja.
 *
 *   Urutan kolom: [No] | Nama | NIP | Jabatan | Instansi
 *   - kolom "No" di depan boleh ada, otomatis dilewati;
 *   - kalau NIP ada di kolom pertama dan nama di kolom kedua, otomatis ditukar.
 *
 * Baris judul (hanya di baris pertama) dilewati. Baris yang salah dilaporkan di `galat` dengan nomor
 * barisnya; baris yang benar tetap diproses. NIP kembar di dalam tempelan
 * dilaporkan sebagai galat pada baris kedua.
 */
export function parseTempelanPeserta(teks: string): { baris: PesertaInput[]; galat: BarisGalat[] } {
  const baris: PesertaInput[] = [];
  const galat: BarisGalat[] = [];
  const nipTerlihat = new Set<string>();
  let barisPertama = true;

  teks.split(/\r?\n/).forEach((mentah, i) => {
    if (!mentah.trim()) return;
    // Tab di depan TIDAK dibuang: itu kolom pertama yang kosong (nama kosong), bukan spasi.
    const line = mentah.replace(/^ +/, "").trimEnd();
    const nomor = i + 1;

    const pemisah = line.includes("\t") ? "\t" : line.includes("|") ? "|" : line.includes(";") ? ";" : null;
    let kol = (pemisah ? line.split(pemisah) : [line]).map((c) => c.trim());

    const pertama = barisPertama;
    barisPertama = false;
    if (pertama && adalahJudul(kol)) return;

    if (kol.length >= 2 && /^\d{1,4}[.)]?$/.test(kol[0])) kol = kol.slice(1); // kolom "No"
    if (kol.length >= 2 && /^'?[\d\s.\-]{5,}$/.test(kol[0]) && /\p{L}/u.test(kol[1])) {
      kol = [kol[1], kol[0], ...kol.slice(2)]; // NIP | Nama -> Nama | NIP
    }

    const [nama, nipTeks, jabatan, instansi] = kol;
    if (!nama) {
      galat.push({ nomor, teks: line, alasan: "Nama kosong" });
      return;
    }
    if (nama.length > NAMA_PESERTA_MAKS) {
      galat.push({ nomor, teks: line, alasan: `Nama terlalu panjang (maks ${NAMA_PESERTA_MAKS} karakter)` });
      return;
    }
    if (ANGKA_ILMIAH.test(nama)) {
      galat.push({ nomor, teks: line, alasan: rapikanNip(nama).galat ?? "Kolom nama berisi angka" });
      return;
    }
    if (!/\p{L}/u.test(nama)) {
      galat.push({ nomor, teks: line, alasan: "Kolom nama berisi angka — periksa urutan kolom (Nama, NIP, Jabatan, Instansi)" });
      return;
    }
    const { nip, galat: galatNip } = rapikanNip(nipTeks);
    if (galatNip) {
      galat.push({ nomor, teks: line, alasan: galatNip });
      return;
    }
    if (nip) {
      if (nipTerlihat.has(nip)) {
        galat.push({ nomor, teks: line, alasan: `NIP ${nip} muncul dua kali di tempelan` });
        return;
      }
      nipTerlihat.add(nip);
    }
    if ((jabatan ?? "").length > TEKS_PESERTA_MAKS || (instansi ?? "").length > TEKS_PESERTA_MAKS) {
      galat.push({ nomor, teks: line, alasan: `Jabatan/instansi terlalu panjang (maks ${TEKS_PESERTA_MAKS} karakter)` });
      return;
    }

    baris.push({
      nama,
      ...(nip ? { nip } : {}),
      ...(jabatan ? { jabatan } : {}),
      ...(instansi ? { instansi } : {}),
    });
  });

  return { baris, galat };
}
