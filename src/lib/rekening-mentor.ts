/**
 * Rekening mentor daring (EB-045): diisi peserta, hanya bila mentornya hadir daring (Zoom) di seminar. Nomor lengkap hanya
 * dibuka admin dan Ketua Diklat; peserta melihat tersamar. Rekening melekat pada mentor: bila mentor diganti, isian lama
 * tidak berlaku dan diisi ulang.
 */
export type IsianRekening = { namaBank: string; nomorRekening: string; atasNama: string; ponsel: string };

export const NAMA_BANK_MAKS = 80;
export const ATAS_NAMA_MAKS = 120;

/** Hanya angka: spasi, titik, dan tanda hubung dibuang. */
export const rapikanNomor = (v: string) => v.replace(/[\s.-]/g, "");

/** Periksa isian; hasil: isian rapi atau pesan galat. */
export function periksaRekening(i: IsianRekening): { rapi: IsianRekening } | { galat: string } {
  const namaBank = i.namaBank.trim();
  const atasNama = i.atasNama.trim().replace(/\s+/g, " ");
  const nomorRekening = rapikanNomor(i.nomorRekening);
  const ponsel = rapikanNomor(i.ponsel);
  if (namaBank.length < 2 || namaBank.length > NAMA_BANK_MAKS) return { galat: "Isi nama bank" };
  if (!/^\d{6,20}$/.test(nomorRekening)) return { galat: "Nomor rekening 6–20 angka" };
  if (atasNama.length < 3 || atasNama.length > ATAS_NAMA_MAKS) return { galat: "Isi nama pemilik rekening" };
  if (!/^(\+62|62|0)8\d{7,12}$/.test(ponsel)) return { galat: "Nomor HP mentor tidak valid (contoh 0812…)" };
  return { rapi: { namaBank, nomorRekening, atasNama, ponsel } };
}

/** "1234567890" → "•••• 7890" (peserta dan daftar pengelola). */
export const samarkan = (nomor: string) => (nomor.length <= 4 ? "••••" : `•••• ${nomor.slice(-4)}`);

const normal = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Rekening masih milik mentor sekarang? (nama dibandingkan tanpa beda huruf besar, spasi, gelar bertanda baca). */
export const milikMentor = (rekeningMentorNama: string, mentorSekarang: string | null | undefined) => !!mentorSekarang && normal(rekeningMentorNama) === normal(mentorSekarang);

export type StatusRekening = "TIDAK_PERLU" | "BELUM" | "PERLU_ULANG" | "TERISI";
/** Status rekening satu peserta: perlu hanya bila mentor hadir daring pada salah satu seminar. */
export function statusRekening(o: { mentorDaring: boolean; mentorNama: string | null; rekening: { mentorNama: string } | null }): StatusRekening {
  if (!o.mentorDaring) return "TIDAK_PERLU";
  if (!o.rekening) return "BELUM";
  return milikMentor(o.rekening.mentorNama, o.mentorNama) ? "TERISI" : "PERLU_ULANG";
}
