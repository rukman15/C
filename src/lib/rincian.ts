/** Bentuk data halaman Rincian Diklat (sama dengan TrainingDetailRecord aplikasi lama). Murni, aman untuk browser. */
import type { StatusDiklat } from "@/lib/jadwal";

export type Pengampu = {
  id: string;
  instructorName: string;
  instructorId: string;
  jp: number;
  diajukanOleh: string;
  /** Snapshot saat ditetapkan; untuk pengajuan lama yang masih menunggu dihitung ulang dari batas JP bulan itu. */
  overCapacity: boolean;
  status: "menunggu" | "disetujui" | "ditolak";
  jpSesi: number;
  jmlSesi: number;
  mataPelatihan?: string;
  mataPelatihanNama?: string;
  catatan?: string;
  alasanTolak?: string;
};

export type RincianDiklat = {
  id: string;
  name: string;
  category: string;
  participants: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  jpDibutuhkan: number;
  tempat: string;
  status: StatusDiklat;
  jenisPelatihan?: string;
  modePelatihan?: string;
  angkatan?: string;
  timKerjaId?: string;
  timKerjaNama?: string;
  penugasan: Pengampu[];
};

/** Bagian (tab) halaman satu diklat, sama dengan DiklatTab aplikasi lama. */
export type KunciTab =
  | "rincian"
  | "persiapan"
  | "peserta"
  | "dokumen"
  | "kelompok"
  | "penugasan"
  | "tugas"
  | "absensi"
  | "seminar"
  | "penilaian"
  | "tes"
  | "evaluasi";

/**
 * Tab yang tampil. `berprogram` = PKA/PKP (program + mode); `hanyaPenilaian` = Widyaiswara yang
 * hanya membuka bagian penilaian/tugas/seminar.
 */
export function tabDiklat(berprogram: boolean, hanyaPenilaian = false): { kunci: KunciTab; label: string; jalur: string }[] {
  const t = (kunci: KunciTab, label: string, tampil: boolean) => (tampil ? [{ kunci, label, jalur: kunci === "rincian" ? "" : `/${kunci}` }] : []);
  return [
    ...t("rincian", "Rincian", !hanyaPenilaian),
    ...t("persiapan", "Persiapan", berprogram && !hanyaPenilaian),
    ...t("peserta", "Peserta", !hanyaPenilaian),
    ...t("dokumen", "Dokumen", berprogram && !hanyaPenilaian),
    ...t("kelompok", "Kelompok", berprogram && !hanyaPenilaian),
    ...t("penugasan", "Penugasan", berprogram && !hanyaPenilaian),
    ...t("tugas", "Tugas", berprogram || hanyaPenilaian),
    ...t("absensi", "Jadwal & Absensi", !hanyaPenilaian),
    ...t("seminar", "Seminar", berprogram || hanyaPenilaian),
    ...t("penilaian", "Penilaian", berprogram || hanyaPenilaian),
    ...t("tes", "Pre/Post Test", berprogram && !hanyaPenilaian),
    ...t("evaluasi", "Evaluasi", !hanyaPenilaian),
  ];
}

/** Rekap pengampu: yang aktif (bukan ditolak), JP disetujui, dan persen kebutuhan terisi. */
export function rekapPengampu(d: Pick<RincianDiklat, "penugasan" | "jpDibutuhkan">) {
  const aktif = d.penugasan.filter((p) => p.status !== "ditolak");
  const disetujui = aktif.filter((p) => p.status === "disetujui");
  const menunggu = aktif.filter((p) => p.status === "menunggu");
  const jpDisetujui = disetujui.reduce((n, p) => n + p.jp, 0);
  return {
    aktif,
    disetujui,
    menunggu,
    jpDisetujui,
    jpMenunggu: menunggu.reduce((n, p) => n + p.jp, 0),
    // Banyaknya ORANG: satu WI bisa punya beberapa penugasan (per mata pelatihan).
    wiDisetujui: new Set(disetujui.map((p) => p.instructorId)).size,
    persen: d.jpDibutuhkan > 0 ? Math.min(100, Math.round((jpDisetujui / d.jpDibutuhkan) * 100)) : 0,
  };
}
