// Log aktivitas angkatan (EB-039) — kode jenis & aturan murni. Diuji di uji/murni.test.ts.

export const JENIS_AKTIVITAS = {
  TUGAS_DIBUAT: "Tugas dibuat",
  TUGAS_DIUNGGAH: "Berkas tugas diunggah",
  TUGAS_DIKIRIM: "Tugas dikirim",
  TUGAS_DITINJAU: "Tugas ditinjau",
  TUGAS_REVISI: "Revisi diminta",
  TUGAS_DITERIMA: "Tugas diterima",
  TUGAS_CATATAN: "Catatan pada tugas",
  TUGAS_MENTOR_SETUJU: "Mentor menyetujui isu & timeline",
  DOKUMEN_DIUNGGAH: "Dokumen persyaratan diunggah",
  MENTOR_DIUSULKAN: "Mentor diusulkan",
  SESI_DIUBAH: "Jadwal sesi diubah",
  PENUGASAN_DIUBAH: "Penugasan angkatan diubah",
} as const;
export type JenisAktivitas = keyof typeof JENIS_AKTIVITAS;

/** Masa simpan log aktivitas (TG-5): 2 tahun. */
export const MASA_SIMPAN_HARI = 730;

/** Batas waktu hapus: baris yang dibuat sebelum ini dihapus. */
export function batasSimpan(now: Date): Date {
  return new Date(now.getTime() - MASA_SIMPAN_HARI * 86_400_000);
}

/** Ringkasan dipotong supaya tidak menampung isi panjang (tanpa isi dokumen/nilai). */
export function rapikanRingkasan(teks: string, maks = 200): string {
  const t = teks.replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t;
}

/** "5 menit lalu", "kemarin 14.20", "3 Nov" — untuk panel Aktivitas Terbaru. */
export function waktuRelatif(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const detik = Math.max(0, Math.round((now.getTime() - t.getTime()) / 1000));
  if (detik < 60) return "baru saja";
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari lalu`;
  return t.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
}

/** Tautan "buka" untuk satu butir aktivitas; null bila tidak ada halaman tujuan. */
export function tautanAktivitas(a: { trainingId: string | null; objekTipe: string | null; objekId: string | null }): string | null {
  const t = a.trainingId ? `/dashboard/diklat/${encodeURIComponent(a.trainingId)}` : null;
  switch (a.objekTipe) {
    case "kiriman":
      return a.objekId ? `/dashboard/tinjau-tugas/${encodeURIComponent(a.objekId)}` : null;
    case "tugas":
      return t ? `${t}/tugas` : null;
    case "dokumen":
      return t ? `${t}/dokumen` : null;
    case "penugasan":
      return t ? `${t}/penugasan` : null;
    case "sesi":
      return t ? `${t}/absensi` : null;
    default:
      return t;
  }
}
