/**
 * Ruang Coaching (23 Okt 2026, CATATAN-RUANG-COACHING.md) — logika MURNI, diuji di uji/murni.test.ts.
 *
 * Satu ruang per kelompok ELEARNING (pembimbingan aksi perubahan, KepKa LAN 2/2023: 4 kelompok @ 1 coach).
 * Isi: pustaka video milik WI (YouTube — video TIDAK diunggah ke aplikasi), sesi coaching + catatan coach per
 * peserta, dan forum tanya-jawab per kelompok. Tidak ada chat pribadi (keputusan 23 Okt 2026: forum lebih
 * terekam & semua anggota ikut belajar dari jawaban coach).
 */
import { bacaTautan, isTanggalIsoValid } from "@/lib/sesi";

// ------------------------------------------------------------------ BATAS ISIAN

export const JUDUL_MAKS = 150;
export const KETERANGAN_MAKS = 1000;
export const ISI_FORUM_MAKS = 5000;
export const CATATAN_MAKS = 2000;

// ------------------------------------------------------------------ PERAN

/**
 * Peran akun di satu ruang coaching (dihitung server, lihat src/lib/server/akses-coaching.ts):
 *  - coach          : WI yang menjadi coach kelompok ini
 *  - penyelenggara  : pengelola jadwal diklatnya (admin, Ketua Diklat, anggota tim pemegang diklat)
 *  - peserta        : anggota AKTIF kelompok ini
 *  - pembaca        : pimpinan / Koordinator WI — lihat saja
 */
export type PeranCoaching = "coach" | "penyelenggara" | "peserta" | "pembaca";
/** Kelola sesi, video, catatan, dan moderasi forum. */
export const bolehKelola = (p: PeranCoaching) => p === "coach" || p === "penyelenggara";
/** Menulis topik/balasan forum. */
export const bolehMenulis = (p: PeranCoaching) => p !== "pembaca";

export type PeranPenulis = "COACH" | "PESERTA" | "PENYELENGGARA";
export const peranPenulis = (p: PeranCoaching): PeranPenulis =>
  p === "coach" ? "COACH" : p === "peserta" ? "PESERTA" : "PENYELENGGARA";
export const LABEL_PERAN_PENULIS: Record<PeranPenulis, string> = { COACH: "Coach", PESERTA: "Peserta", PENYELENGGARA: "Penyelenggara" };

// ------------------------------------------------------------------ VIDEO (YOUTUBE)

export type JenisVideo = "PENGANTAR" | "MATERI" | "REKAMAN";
export const JENIS_VIDEO: { kode: JenisVideo; label: string }[] = [
  { kode: "PENGANTAR", label: "Pengantar" },
  { kode: "MATERI", label: "Materi" },
  { kode: "REKAMAN", label: "Rekaman sesi" },
];
export const isJenisVideo = (v: unknown): v is JenisVideo => JENIS_VIDEO.some((j) => j.kode === v);
export const labelJenisVideo = (kode: string) => JENIS_VIDEO.find((j) => j.kode === kode)?.label ?? kode;

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const HOST_YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/**
 * ID video (11 karakter) dari tautan YouTube; selain YouTube / tidak dikenali → null.
 * Diterima: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts|embed|live/ID (http/https,
 * dengan atau tanpa "www."/"m."). Tautan playlist tanpa `v=` ditolak (bukan satu video).
 */
export function bacaYoutube(tautan: string | null | undefined): string | null {
  const t = (tautan ?? "").trim();
  if (!t || t.length > 500 || /\s/.test(t)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (HOST_YOUTUBE.has(host)) {
    const bagian = u.pathname.split("/").filter(Boolean);
    if (bagian[0] === "watch") id = u.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(bagian[0] ?? "")) id = bagian[1] ?? null;
  }
  return id && ID_YOUTUBE.test(id) ? id : null;
}

export const isIdYoutube = (v: unknown): v is string => typeof v === "string" && ID_YOUTUBE.test(v);
export const tautanYoutube = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** Pemutar sematan mode privasi (tanpa cookie sampai diputar); rel=0 = saran akhir dari channel yang sama. */
export const sematanYoutube = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
export const gambarYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export type IsianVideo = { judul: string; tautan: string; jenis: string; keterangan?: string | null };

/** Periksa isian pustaka video. Hasil: `{ youtubeId }` atau pesan galat. */
export function periksaVideo(v: IsianVideo): { youtubeId: string } | { galat: string } {
  const judul = v.judul.trim();
  if (!judul) return { galat: "Judul video wajib diisi" };
  if (judul.length > JUDUL_MAKS) return { galat: `Judul maksimal ${JUDUL_MAKS} karakter` };
  if (!isJenisVideo(v.jenis)) return { galat: "Jenis video tidak dikenal" };
  if ((v.keterangan ?? "").trim().length > KETERANGAN_MAKS) return { galat: `Keterangan maksimal ${KETERANGAN_MAKS} karakter` };
  const youtubeId = bacaYoutube(v.tautan);
  if (!youtubeId) return { galat: "Tautan harus alamat satu video YouTube (youtube.com/watch?v=… atau youtu.be/…)" };
  return { youtubeId };
}

// ------------------------------------------------------------------ SESI & CATATAN

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type IsianSesiCoaching = { judul: string; tanggal?: string | null; jamMulai?: string | null; tautanRapat?: string | null; keterangan?: string | null };

/** Periksa isian sesi coaching. Hasil: tautan rapat yang dirapikan (atau null) / pesan galat. */
export function periksaSesiCoaching(s: IsianSesiCoaching): { tautanRapat: string | null } | { galat: string } {
  const judul = s.judul.trim();
  if (!judul) return { galat: "Judul sesi wajib diisi" };
  if (judul.length > JUDUL_MAKS) return { galat: `Judul maksimal ${JUDUL_MAKS} karakter` };
  if (s.tanggal && !isTanggalIsoValid(s.tanggal)) return { galat: "Tanggal tidak valid" };
  if (s.jamMulai && !JAM.test(s.jamMulai)) return { galat: "Jam mulai tidak valid (JJ:MM)" };
  if (s.jamMulai && !s.tanggal) return { galat: "Isi tanggal bila jam mulai diisi" };
  if ((s.keterangan ?? "").trim().length > KETERANGAN_MAKS) return { galat: `Keterangan maksimal ${KETERANGAN_MAKS} karakter` };
  const tautanRapat = bacaTautan(s.tautanRapat);
  if (tautanRapat === undefined) return { galat: "Tautan rapat harus alamat web (https://…)" };
  return { tautanRapat };
}

/** Urut sesi: bertanggal lebih dulu menurut tanggal & jam, lalu yang belum bertanggal (urut dibuat). */
export function urutkanSesi<T extends { tanggal: string | null; jamMulai: string | null; dibuat: string }>(sesi: T[]): T[] {
  return [...sesi].sort((a, b) => {
    if (!a.tanggal !== !b.tanggal) return a.tanggal ? -1 : 1;
    return (a.tanggal ?? "").localeCompare(b.tanggal ?? "") || (a.jamMulai ?? "").localeCompare(b.jamMulai ?? "") || a.dibuat.localeCompare(b.dibuat);
  });
}

export type IsianCatatan = { hadir?: boolean | null; catatan?: string | null; tindakLanjut?: string | null };

export function periksaCatatan(c: IsianCatatan): string | null {
  if ((c.catatan ?? "").trim().length > CATATAN_MAKS) return `Catatan maksimal ${CATATAN_MAKS} karakter`;
  if ((c.tindakLanjut ?? "").trim().length > CATATAN_MAKS) return `Tindak lanjut maksimal ${CATATAN_MAKS} karakter`;
  return null;
}

/** Catatan tanpa isi apa pun (hadir kosong, teks kosong) = hapus barisnya. */
export const catatanKosong = (c: IsianCatatan) => c.hadir == null && !(c.catatan ?? "").trim() && !(c.tindakLanjut ?? "").trim();

// ------------------------------------------------------------------ FORUM

export function periksaTopik(t: { judul: string; isi: string }): string | null {
  const judul = t.judul.trim();
  if (!judul) return "Judul pertanyaan wajib diisi";
  if (judul.length > JUDUL_MAKS) return `Judul maksimal ${JUDUL_MAKS} karakter`;
  return periksaIsi(t.isi);
}

export function periksaIsi(isi: string): string | null {
  const t = isi.trim();
  if (!t) return "Isi tulisan wajib diisi";
  if (t.length > ISI_FORUM_MAKS) return `Tulisan maksimal ${ISI_FORUM_MAKS} karakter`;
  return null;
}

/** Urut daftar topik: disematkan dulu, lalu yang terakhir aktif. */
export function urutkanTopik<T extends { disematkan: boolean; aktifPada: string }>(topik: T[]): T[] {
  return [...topik].sort((a, b) => Number(b.disematkan) - Number(a.disematkan) || b.aktifPada.localeCompare(a.aktifPada));
}

/**
 * Banyaknya tulisan (topik/balasan) dari ORANG LAIN setelah `terakhirDibaca` (ISO). Belum pernah membuka
 * forum (null) = semua tulisan orang lain. Tulisan tersembunyi tidak dihitung.
 */
export function hitungBelumDibaca(
  tulisan: { waktu: string; akunId: string | null; tersembunyi?: boolean }[],
  akunId: string,
  terakhirDibaca: string | null,
): number {
  return tulisan.filter((t) => !t.tersembunyi && t.akunId !== akunId && (terakhirDibaca === null || t.waktu > terakhirDibaca)).length;
}

/**
 * Pecah teks menjadi potongan teks biasa & tautan http(s) (untuk ditampilkan sebagai <a> tanpa {@html}).
 * Tanda baca penutup di ujung tautan (. , ; : ! ? ) ]) tidak ikut menjadi tautan.
 */
export function pecahTautan(teks: string): { teks: string; href?: string }[] {
  const out: { teks: string; href?: string }[] = [];
  const pola = /https?:\/\/[^\s<>"']+/gi;
  let akhir = 0;
  for (const m of teks.matchAll(pola)) {
    let url = m[0];
    const buang = /[.,;:!?)\]]+$/.exec(url)?.[0] ?? "";
    url = url.slice(0, url.length - buang.length);
    if (!url) continue;
    const mulai = m.index ?? 0;
    if (mulai > akhir) out.push({ teks: teks.slice(akhir, mulai) });
    out.push({ teks: url, href: url });
    akhir = mulai + url.length;
  }
  if (akhir < teks.length) out.push({ teks: teks.slice(akhir) });
  return out;
}
