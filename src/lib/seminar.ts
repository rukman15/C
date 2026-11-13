/**
 * Seminar aksi perubahan PKA/PKP (Agenda IV) — logika MURNI, diuji di uji/murni.test.ts.
 * CATATAN-SEMINAR-AKSI-PERUBAHAN.md.
 *  - RAP = Rancangan Aksi Perubahan: akhir Klasikal I, dinilai aspek PERENCANAAN (AKTUALISASI_RANCANGAN).
 *  - LAP = Laporan Aksi Perubahan: Klasikal II setelah aktualisasi, dinilai aspek IMPLEMENTASI.
 * Jadwal diambil dari sesi Jadwal Pembelajaran yang kegiatannya seminar aksi perubahan.
 */
import { getJenjang, tahapKurikulum, type JenisEvaluasi } from "@/lib/kurikulum";
import { bacaTautan, isTanggalIsoValid } from "@/lib/sesi";

export type JenisSeminar = "RAP" | "LAP";

/** Peran yang hadir dalam seminar (keterangan Hamzah, 23 Okt 2026). */
export const PERAN_SEMINAR: { peran: string; tugas: string }[] = [
  { peran: "Peserta", tugas: "mempresentasikan aksi perubahannya" },
  { peran: "Penguji", tugas: "menguji dan memberi nilai" },
  { peran: "Coach", tugas: "mendampingi peserta" },
  { peran: "Mentor", tugas: "atasan langsung peserta, mendampingi" },
  { peran: "Evaluator", tugas: "panitia — memanggil peserta sesuai giliran dan mengumpulkan nilai" },
];

/**
 * Jenis seminar dari nama kegiatan jadwal: "Seminar Rancangan Aksi Perubahan …" / "Seminar RAP" = RAP;
 * "Seminar Aksi Perubahan …" (Klasikal II) / "Seminar Laporan …" / "Seminar LAP" = LAP. Selain itu null.
 */
export function jenisSeminar(kegiatan: string | null | undefined): JenisSeminar | null {
  const k = (kegiatan ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!k.includes("seminar")) return null;
  if (/\brap\b/.test(k) || k.includes("rancangan aksi perubahan")) return "RAP";
  if (/\blap\b/.test(k) || k.includes("laporan aksi perubahan") || k.includes("aksi perubahan")) return "LAP";
  return null;
}

const INFO: Record<JenisSeminar, { judul: string; tahap: string; evaluasi: JenisEvaluasi; aspekLabel: string }> = {
  RAP: { judul: "Seminar Rancangan Aksi Perubahan (RAP)", tahap: "Klasikal I", evaluasi: "AKTUALISASI_RANCANGAN", aspekLabel: "Perencanaan aksi perubahan" },
  LAP: { judul: "Seminar Laporan Aksi Perubahan (LAP)", tahap: "Klasikal II, setelah aktualisasi di tempat kerja", evaluasi: "AKTUALISASI_IMPLEMENTASI", aspekLabel: "Implementasi aksi perubahan" },
};

export type StatusSeminar = "belum-dijadwalkan" | "akan-datang" | "hari-ini" | "selesai";

export type InfoSeminar = {
  jenis: JenisSeminar;
  judul: string;
  tahap: string;
  /** JP seminar menurut kurikulum (null bila tidak ditemukan). */
  jp: number | null;
  aspekLabel: string;
  aspek: { nama: string; bobot: number }[];
  bobotTotal: number;
  jadwal: { tanggal: string; jamMulai: string | null; tautan: string | null }[];
  status: StatusSeminar;
};

/** Ringkasan kedua seminar untuk satu program (PKA/PKP) & mode; [] bila bukan PKA/PKP. */
export function infoSeminar(
  kodeProgram: string | null | undefined,
  mode: string | null | undefined,
  sesi: { tanggal: string; jamMulai?: string | null; kegiatan: string; tautan?: string | null }[],
  hariIni: string,
): InfoSeminar[] {
  const j = getJenjang(kodeProgram);
  if (!j) return [];
  const m = mode === "KLASIKAL" ? "KLASIKAL" : "BLENDED";
  const aspekSemua = j.aspek[m] ?? [];
  const kegiatan = tahapKurikulum(kodeProgram, m).flatMap((t) => t.kegiatan ?? []);
  return (["RAP", "LAP"] as const).map((jenis) => {
    const i = INFO[jenis];
    const aspek = aspekSemua.filter((a) => a.jenisEvaluasi === i.evaluasi).map((a) => ({ nama: a.nama, bobot: a.bobot }));
    const jadwal = sesi
      .filter((s) => jenisSeminar(s.kegiatan) === jenis)
      .map((s) => ({ tanggal: s.tanggal, jamMulai: s.jamMulai ?? null, tautan: s.tautan ?? null }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.jamMulai ?? "").localeCompare(b.jamMulai ?? ""));
    const status: StatusSeminar = !jadwal.length
      ? "belum-dijadwalkan"
      : jadwal.some((x) => x.tanggal === hariIni)
        ? "hari-ini"
        : jadwal.some((x) => x.tanggal > hariIni)
          ? "akan-datang"
          : "selesai";
    return {
      jenis,
      judul: i.judul,
      tahap: i.tahap,
      jp: kegiatan.find((k) => jenisSeminar(k.nama) === jenis)?.jp ?? null,
      aspekLabel: i.aspekLabel,
      aspek,
      bobotTotal: aspek.reduce((s, a) => s + a.bobot, 0),
      jadwal,
      status,
    };
  });
}

// ------------------------------------------------------------------ JADWAL PER PESERTA & PELAKSANAAN

export const isJenisSeminar = (v: unknown): v is JenisSeminar => v === "RAP" || v === "LAP";

/** Status panggilan yang diubah evaluator (panitia) di panel pelaksanaan. */
export type StatusPanggil = "MENUNGGU" | "DIPANGGIL" | "PRESENTASI" | "SELESAI" | "TIDAK_HADIR";
export const STATUS_PANGGIL: { kode: StatusPanggil; label: string }[] = [
  { kode: "MENUNGGU", label: "Menunggu" },
  { kode: "DIPANGGIL", label: "Dipanggil" },
  { kode: "PRESENTASI", label: "Presentasi" },
  { kode: "SELESAI", label: "Selesai" },
  { kode: "TIDAK_HADIR", label: "Tidak hadir" },
];
export const isStatusPanggil = (v: unknown): v is StatusPanggil => STATUS_PANGGIL.some((s) => s.kode === v);
export const labelStatusPanggil = (k: string) => STATUS_PANGGIL.find((s) => s.kode === k)?.label ?? k;

/** Mentor bisa hadir langsung di ruang seminar atau daring lewat Zoom (keterangan Hamzah, 23 Okt 2026). */
export type MentorHadir = "LANGSUNG" | "DARING";
export const MENTOR_HADIR: { kode: MentorHadir; label: string }[] = [
  { kode: "LANGSUNG", label: "Hadir langsung" },
  { kode: "DARING", label: "Daring (Zoom)" },
];
export const isMentorHadir = (v: unknown): v is MentorHadir => v === "LANGSUNG" || v === "DARING";

export const NAMA_SEMINAR_MAKS = 150;
export const RUANG_MAKS = 100;
const JAM_SEMINAR = /^([01]\d|2[0-3]):[0-5]\d$/;

export type IsianJadwalSeminar = {
  pesertaId: string;
  tanggal?: string | null;
  jamMulai?: string | null;
  urutan?: number | null;
  ruang?: string | null;
  tautanDaring?: string | null;
  pengujiPegawaiId?: string | null;
  pengujiNama?: string | null;
  mentorNama?: string | null;
  mentorJabatan?: string | null;
  mentorHadir?: string | null;
  evaluatorNama?: string | null;
};

/** Periksa satu baris jadwal seminar. Hasil: tautan daring yang dirapikan (atau null) / pesan galat. */
export function periksaJadwalSeminar(i: IsianJadwalSeminar): { tautanDaring: string | null } | { galat: string } {
  if (i.tanggal && !isTanggalIsoValid(i.tanggal)) return { galat: "Tanggal tidak valid" };
  if (i.jamMulai && !JAM_SEMINAR.test(i.jamMulai)) return { galat: "Jam tidak valid (JJ:MM)" };
  if (i.urutan != null && (!Number.isInteger(i.urutan) || i.urutan < 1 || i.urutan > 500)) return { galat: "Urutan harus 1–500" };
  if ((i.ruang ?? "").trim().length > RUANG_MAKS) return { galat: `Ruang maksimal ${RUANG_MAKS} karakter` };
  for (const [nilai, label] of [
    [i.pengujiNama, "Nama penguji"],
    [i.mentorNama, "Nama mentor"],
    [i.mentorJabatan, "Jabatan mentor"],
    [i.evaluatorNama, "Nama evaluator"],
  ] as const) {
    if ((nilai ?? "").trim().length > NAMA_SEMINAR_MAKS) return { galat: `${label} maksimal ${NAMA_SEMINAR_MAKS} karakter` };
  }
  if (i.mentorHadir && !isMentorHadir(i.mentorHadir)) return { galat: "Kehadiran mentor: langsung atau daring" };
  const tautanDaring = bacaTautan(i.tautanDaring);
  if (tautanDaring === undefined) return { galat: "Tautan daring harus alamat web (https://…)" };
  return { tautanDaring };
}

/** Jam mulai berurutan: jamBerurutan("08:00", 30, 3) = ["08:00", "08:30", "09:00"]. Lewat 23:59 → berhenti (null). */
export function jamBerurutan(mulai: string, durasiMenit: number, n: number): (string | null)[] {
  if (!JAM_SEMINAR.test(mulai) || !(durasiMenit > 0)) return Array(n).fill(null);
  const [h, m] = mulai.split(":").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = h * 60 + m + i * Math.round(durasiMenit);
    return t >= 24 * 60 ? null : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  });
}

/** Urut baris seminar untuk panel: tanggal, ruang, urutan, jam, lalu nama. */
export function urutkanJadwalSeminar<T extends { tanggal: string | null; ruang: string | null; urutan: number | null; jamMulai: string | null; nama: string }>(rows: T[]): T[] {
  const n = (x: number | null) => (x == null ? Number.MAX_SAFE_INTEGER : x);
  return [...rows].sort(
    (a, b) =>
      (a.tanggal ?? "9999").localeCompare(b.tanggal ?? "9999") ||
      (a.ruang ?? "").localeCompare(b.ruang ?? "", "id", { numeric: true }) ||
      n(a.urutan) - n(b.urutan) ||
      (a.jamMulai ?? "99").localeCompare(b.jamMulai ?? "99") ||
      a.nama.localeCompare(b.nama, "id"),
  );
}
