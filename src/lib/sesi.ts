/**
 * Helper MURNI (tanpa import) untuk sesi mengajar Widyaiswara — dasar data
 * KARKEN (Kartu Kendali Kegiatan Widyaiswara). Dipakai server (validasi
 * tanggal) DAN client (input cepat: rentang tanggal + tempel banyak baris),
 * jadi aturannya cuma satu tempat.
 *
 * Semua tanggal diperlakukan sebagai tanggal-saja berformat ISO "YYYY-MM-DD"
 * dan dihitung dengan UTC — sengaja tidak memakai zona waktu lokal supaya
 * "1 September" tidak pernah bergeser jadi "31 Agustus".
 */

export const TEMPAT_DEFAULT = "BBPKA-PDN II Jatinangor";
/** Batas JP satu baris sesi (contoh KARKEN: satu hari bisa 12 JP). */
export const JP_SESI_MAKS = 24;
/** Batas banyaknya sesi dalam satu kali simpan. */
export const SESI_MAKS_PER_PERMINTAAN = 100;
/** Batas panjang rentang tanggal untuk pembuat sesi otomatis. */
export const RENTANG_MAKS_HARI = 62;

export type SesiInput = {
  tanggal: string; // "YYYY-MM-DD"
  kegiatan: string;
  jp: number;
  tempat?: string;
  keterangan?: string;
};

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const BULAN_ALIAS: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, agt: 8, agus: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, desember: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Susun "YYYY-MM-DD" dari bagian-bagiannya; null kalau tanggalnya tidak ada di kalender. */
export function buatIso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function isTanggalIsoValid(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return !!m && buatIso(Number(m[1]), Number(m[2]), Number(m[3])) === iso;
}

/**
 * Baca tanggal dari tulisan bebas, hasilnya "YYYY-MM-DD" atau null. Format yang
 * dikenali: 2026-09-01 · 1/9/2026 · 01-09-2026 · 1.9.26 · 1 September 2026 ·
 * 1 Sep 2026 · "Senin, 1 September 2026". Tanpa tahun (1/9, 1 September) →
 * pakai `tahunDefault` kalau ada. Urutan angka mengikuti kebiasaan Indonesia:
 * hari/bulan/tahun.
 */
export function parseTanggalFleksibel(teks: string, tahunDefault?: number): string | null {
  const t = teks
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad),?\s*/, "");
  if (!t) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return buatIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/.exec(t);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : tahunDefault;
    return y === undefined ? null : buatIso(y, Number(m[2]), Number(m[1]));
  }

  m = /^(\d{1,2}) ([a-z]+)\.?(?: (\d{4}))?$/.exec(t);
  if (m) {
    const bulan = BULAN_ALIAS[m[2]];
    const y = m[3] ? Number(m[3]) : tahunDefault;
    return bulan && y !== undefined ? buatIso(y, bulan, Number(m[1])) : null;
  }

  return null;
}

/** "2026-09-01" → "1 September 2026" (tanpa objek Date lokal, jadi bebas geser zona waktu). */
export function formatTanggalId(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${NAMA_BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

export function tambahHari(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Selisih hari (b - a) antara dua tanggal ISO. */
export function selisihHari(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function isAkhirPekan(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Minggu, 6 = Sabtu
  return hari === 0 || hari === 6;
}

/**
 * Semua tanggal dari `mulai` sampai `selesai` (inklusif). Mengembalikan []
 * kalau salah satu tanggal tidak valid, urutannya terbalik, atau rentangnya
 * lebih dari RENTANG_MAKS_HARI (cegah salah ketik tahun menghasilkan ratusan baris).
 */
export function hariDalamRentang(
  mulai: string,
  selesai: string,
  opsi: { lewatiAkhirPekan?: boolean } = {},
): string[] {
  if (!isTanggalIsoValid(mulai) || !isTanggalIsoValid(selesai)) return [];
  const span = selisihHari(mulai, selesai);
  if (span < 0 || span + 1 > RENTANG_MAKS_HARI) return [];
  const hasil: string[] = [];
  for (let i = 0; i <= span; i++) {
    const tgl = tambahHari(mulai, i);
    if (opsi.lewatiAkhirPekan && isAkhirPekan(tgl)) continue;
    hasil.push(tgl);
  }
  return hasil;
}

/** Sesi di luar periode pelatihan? Tanpa tanggal selesai, hanya batas awal yang dicek. */
export function diluarPeriode(tanggal: string, mulai: string, selesai?: string | null): boolean {
  if (tanggal < mulai) return true;
  return !!selesai && tanggal > selesai;
}

export function totalJp(daftar: { jp: number }[]): number {
  return daftar.reduce((sum, s) => sum + s.jp, 0);
}

export type BarisGalat = { nomor: number; teks: string; alasan: string };

/**
 * Baca banyak sesi dari teks tempelan (satu baris = satu sesi), kolom dipisah
 * Tab, "|" atau ";" (koma tidak dipakai karena nama kegiatan sering memuat
 * koma, mis. "PKA 4, Agenda II").
 *
 *   Urutan biasa : Tanggal | Kegiatan | JP | Keterangan (opsional)
 *   Urutan KARKEN: No | Kegiatan | JP | Tanggal | Tempat | Keterangan
 *                  (otomatis dikenali kalau kolom pertama berupa nomor — jadi
 *                   tabel KARKEN lama bisa langsung disalin dari Word/Excel)
 *
 * Baris judul kolom dilewati. Baris yang salah dilaporkan di `galat` dengan
 * nomor barisnya, baris yang benar tetap diproses.
 */
export function parseTempelan(
  teks: string,
  opsi: { tahunDefault?: number } = {},
): { baris: SesiInput[]; galat: BarisGalat[] } {
  const baris: SesiInput[] = [];
  const galat: BarisGalat[] = [];

  teks.split(/\r?\n/).forEach((mentah, i) => {
    const line = mentah.trim();
    if (!line) return;
    const nomor = i + 1;

    if (/^(no\.?|tanggal)\b/i.test(line) && /(kegiatan|jp)/i.test(line)) return; // baris judul

    const pemisah = line.includes("\t") ? "\t" : line.includes("|") ? "|" : line.includes(";") ? ";" : null;
    if (!pemisah) {
      galat.push({ nomor, teks: line, alasan: "Pisahkan kolom dengan Tab, | atau ;" });
      return;
    }
    const kol = line.split(pemisah).map((c) => c.trim());

    let tanggalTeks: string | undefined;
    let kegiatan: string | undefined;
    let jpTeks: string | undefined;
    let tempat: string | undefined;
    let keterangan: string | undefined;
    if (/^\d+\.?$/.test(kol[0] ?? "")) {
      [, kegiatan, jpTeks, tanggalTeks, tempat, keterangan] = kol;
    } else {
      [tanggalTeks, kegiatan, jpTeks, keterangan] = kol;
    }

    const tanggal = parseTanggalFleksibel(tanggalTeks ?? "", opsi.tahunDefault);
    if (!tanggal) {
      galat.push({ nomor, teks: line, alasan: `Tanggal "${tanggalTeks ?? ""}" tidak dikenali` });
      return;
    }
    if (!kegiatan) {
      galat.push({ nomor, teks: line, alasan: "Nama kegiatan kosong" });
      return;
    }
    if (kegiatan.length > 200) {
      galat.push({ nomor, teks: line, alasan: "Nama kegiatan terlalu panjang (maks 200 karakter)" });
      return;
    }
    const jp = Number(jpTeks);
    if (!Number.isInteger(jp) || jp < 1 || jp > JP_SESI_MAKS) {
      galat.push({ nomor, teks: line, alasan: `JP harus bilangan bulat 1–${JP_SESI_MAKS}` });
      return;
    }

    baris.push({
      tanggal,
      kegiatan,
      jp,
      ...(tempat ? { tempat } : {}),
      ...(keterangan ? { keterangan } : {}),
    });
  });

  return { baris, galat };
}

export const TAUTAN_MAKS = 500;
/**
 * Tautan rapat daring (Zoom/Meet/Teams) sebuah sesi: hanya http(s), tanpa spasi.
 * Kosong -> null. Tidak valid -> undefined (pemanggil menolak).
 */
export function bacaTautan(teks: string | null | undefined): string | null | undefined {
  const t = (teks ?? "").trim();
  if (!t) return null;
  if (t.length > TAUTAN_MAKS || /\s/.test(t)) return undefined;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
