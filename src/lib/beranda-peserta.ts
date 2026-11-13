/**
 * Beranda peserta (gaya halaman peserta SIMANTAP: sambutan, kotak angka,
 * "Lanjutkan belajar", pembelajaran mandiri, daftar pelatihan, sertifikat) —
 * logika murni, diuji di uji/murni.test.ts. Tanggal = teks "YYYY-MM-DD" (WIB).
 */

/**
 * Pembelajaran mandiri PKA/PKP blended berlangsung di SiBangkom ASN milik LAN
 * (mengikuti situs PKA/PKP balai: "Akses Modul Kompetensi Dasar"). Peserta masuk
 * dengan akun LAN-nya sendiri; sertifikat self learning didapat dari sana.
 */
export const TAUTAN_MANDIRI_LAN = "https://sibangkom.lan.go.id/";

const HARI_MS = 86_400_000;
const keMs = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);

export type HariPelatihan = { ke: number; total: number; status: "belum" | "berjalan" | "selesai" };

/** Hari ke-berapa dari total hari pelatihan; null bila tanggal selesai tidak ada. */
export function hariPelatihan(mulai: string, selesai: string | null | undefined, hariIni: string): HariPelatihan | null {
  if (!selesai) return null;
  const m = keMs(mulai);
  const s = Math.max(keMs(selesai), m);
  const k = keMs(hariIni);
  const total = Math.round((s - m) / HARI_MS) + 1;
  const ke = Math.round((k - m) / HARI_MS) + 1;
  return { ke: Math.min(Math.max(ke, 0), total), total, status: k < m ? "belum" : k > s ? "selesai" : "berjalan" };
}

/** Persen JP hadir dari JP wajib hadir yang sudah dicatat (dispensasi tidak dihitung); null bila belum ada catatan. */
export function persenHadir(r: { jpHadir: number; jpTidakHadir: number }): number | null {
  const dasar = r.jpHadir + r.jpTidakHadir;
  return dasar > 0 ? Math.round((r.jpHadir / dasar) * 100) : null;
}

type SesiRingkas = { tanggal: string; jamMulai?: string | null };

/** Sesi hari ini (urut jam) dan sesi pertama sesudah hari ini. */
export function sesiTerdekat<T extends SesiRingkas>(sesi: T[], hariIni: string): { hariIni: T[]; berikutnya: T | null } {
  const urut = [...sesi].sort((a, b) =>
    a.tanggal === b.tanggal ? (a.jamMulai ?? "99").localeCompare(b.jamMulai ?? "99") : a.tanggal.localeCompare(b.tanggal),
  );
  return {
    hariIni: urut.filter((s) => s.tanggal === hariIni),
    berikutnya: urut.find((s) => s.tanggal > hariIni) ?? null,
  };
}

export type RingkasDiklat = {
  status: string; // status pelatihan: Terjadwal | Berjalan | Selesai
  statusPeserta: string; // AKTIF | MENGUNDURKAN_DIRI | DIBERHENTIKAN
  kehadiranPersen: number | null;
};

/** Angka di kotak beranda. Rata-rata kehadiran hanya dari diklat yang sudah punya catatan. */
export function ringkasBeranda(list: RingkasDiklat[]): {
  berjalan: number;
  terjadwal: number;
  selesai: number;
  rataKehadiran: number | null;
} {
  const aktif = list.filter((d) => d.statusPeserta === "AKTIF");
  const ada = aktif.map((d) => d.kehadiranPersen).filter((x): x is number => x !== null);
  return {
    berjalan: aktif.filter((d) => d.status === "Berjalan").length,
    terjadwal: aktif.filter((d) => d.status === "Terjadwal").length,
    selesai: aktif.filter((d) => d.status === "Selesai").length,
    rataKehadiran: ada.length ? Math.round(ada.reduce((s, x) => s + x, 0) / ada.length) : null,
  };
}

/** Diklat untuk kartu "Lanjutkan belajar": yang berjalan, kalau tidak ada yang terjadwal paling dekat. */
export function diklatUtama<T extends { status: string; statusPeserta: string; mulai: string }>(list: T[]): T | null {
  const aktif = list.filter((d) => d.statusPeserta === "AKTIF");
  const berjalan = aktif.filter((d) => d.status === "Berjalan").sort((a, b) => b.mulai.localeCompare(a.mulai));
  if (berjalan.length) return berjalan[0];
  const terjadwal = aktif.filter((d) => d.status === "Terjadwal").sort((a, b) => a.mulai.localeCompare(b.mulai));
  return terjadwal[0] ?? null;
}

/**
 * Penerbit sertifikat (balai tidak menerbitkan sertifikat): PKA/PKP oleh LAN —
 * versi TTE diunduh peserta di SiBangkom LAN; diklat lain (teknis, ±1 minggu)
 * oleh BPSDM Kemendagri. Versi fisik diambil balai di BPSDM.
 */
export function penerbitSertifikat(jenisPelatihan: string | null | undefined): { penerbit: string; tautan: string | null } {
  return jenisPelatihan === "PKA" || jenisPelatihan === "PKP"
    ? { penerbit: "LAN", tautan: TAUTAN_MANDIRI_LAN }
    : { penerbit: "BPSDM Kemendagri", tautan: null };
}

// --- Bilah tahapan -------------------------------------------------------------

export type TahapRingkas = { kode: string; hari?: number };

/** Bentuk sesi -> tipe tahap kurikulum tempat sesi itu biasanya berada. */
const TIPE_DARI_BENTUK: Record<string, string> = {
  MANDIRI: "MANDIRI",
  SINKRON: "ELEARNING",
  ASINKRON: "ELEARNING",
  KLASIKAL: "KLASIKAL",
  LAPANGAN: "KLASIKAL",
};

/**
 * Tahap yang sedang berjalan (indeks), untuk bilah tahapan.
 *   -1 = pelatihan belum mulai (atau tidak ada data);  tahap.length = semua selesai.
 * Perkiraan dasar: posisi hari pelatihan dipetakan ke sebaran hari kurikulum
 * (proporsional bila jumlah hari di kalender berbeda dari kurikulum). Bila hari
 * ini ada sesi, bentuknya dipakai untuk memilih tahap bertipe sama yang paling
 * dekat dengan perkiraan (mis. "Klasikal I" vs "Klasikal II").
 */
export function tahapAktif(tahap: TahapRingkas[], hari: HariPelatihan | null, bentukHariIni?: string | null): number {
  if (tahap.length === 0 || !hari) return -1;
  if (hari.status === "belum") return -1;
  if (hari.status === "selesai") return tahap.length;
  const totalKur = tahap.reduce((s, t) => s + (t.hari ?? 0), 0);
  if (totalKur <= 0 || hari.total <= 0) return 0;
  // Posisi hari ini pada skala hari kurikulum, dan rentang [awal, akhir) tiap tahap.
  const posisi = ((hari.ke - 0.5) / hari.total) * totalKur;
  const rentang: [number, number][] = [];
  let kum = 0;
  for (const t of tahap) {
    rentang.push([kum, kum + (t.hari ?? 0)]);
    kum += t.hari ?? 0;
  }
  const jarak = (i: number) => (posisi < rentang[i][0] ? rentang[i][0] - posisi : posisi >= rentang[i][1] ? posisi - rentang[i][1] : 0);
  let perkiraan = rentang.findIndex(([a, b]) => posisi >= a && posisi < b);
  if (perkiraan < 0) perkiraan = tahap.length - 1;
  const tipe = bentukHariIni ? TIPE_DARI_BENTUK[bentukHariIni] : undefined;
  if (tipe && tahap[perkiraan].kode !== tipe) {
    let terbaik = -1;
    for (let i = 0; i < tahap.length; i++) {
      if (tahap[i].kode === tipe && (terbaik < 0 || jarak(i) < jarak(terbaik))) terbaik = i;
    }
    if (terbaik >= 0) return terbaik;
  }
  return perkiraan;
}

const LABEL_PENDEK: Record<string, string> = {
  MANDIRI: "Mandiri",
  ELEARNING: "E-learning",
  KOMITMEN_BERSAMA: "Komitmen",
  KLASIKAL: "Klasikal",
  STUDI_LAPANGAN: "Studi lapangan",
  AKTUALISASI: "Aktualisasi",
};

/** Label pendek per tahap; tahap bertipe sama diberi nomor (Klasikal I, Klasikal II). */
export function labelPendekTahap(tahap: { kode: string }[]): string[] {
  const jumlah = new Map<string, number>();
  for (const t of tahap) jumlah.set(t.kode, (jumlah.get(t.kode) ?? 0) + 1);
  const ke = new Map<string, number>();
  const ROMAWI = ["I", "II", "III", "IV", "V"];
  return tahap.map((t) => {
    const dasar = LABEL_PENDEK[t.kode] ?? t.kode;
    if ((jumlah.get(t.kode) ?? 0) < 2) return dasar;
    const n = (ke.get(t.kode) ?? 0) + 1;
    ke.set(t.kode, n);
    return `${dasar} ${ROMAWI[n - 1] ?? n}`;
  });
}

// --- Tugas & checklist peserta (Beranda HP, 26 Okt 2026) ----------------------

export type StatusTugas = "selesai" | "perlu" | "nanti" | "terlewat";
export type ButirTugas = { kunci: string; label: string; keterangan: string; status: StatusTugas; href: string | null };
export type FaktaTugas = {
  pesertaId: string;
  /** null = jadwal tidak mewajibkan dokumen. */
  dokumen: { lengkap: boolean; kurang: number; menunggu: number; ditolak: number; sisaHari: number | null } | null;
  /** Pre/post-test yang sudah diterbitkan (bukan draf). `buka` = "YYYY-MM-DD" atau null. */
  tes: { jenis: "PRE" | "POST"; status: "TERJADWAL" | "DIBUKA" | "DITUTUP"; selesai: boolean; buka: string | null }[];
  evaluasi: { tertunda: number; terisi: number };
  /** Jadwal seminar pribadi (tab Seminar). */
  seminar: { jenis: "RAP" | "LAP"; tanggal: string | null; status: string }[];
};

const tglSingkat = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Daftar tugas peserta untuk satu diklat, urut sesuai alur: dokumen → pre-test → seminar RAP → seminar LAP →
 * post-test → evaluasi. Hanya butir yang relevan (tes yang belum diterbitkan & seminar yang belum dijadwalkan tidak muncul).
 */
export function tugasPeserta(f: FaktaTugas, hariIni: string): ButirTugas[] {
  const dasar = `/dashboard/belajar/${encodeURIComponent(f.pesertaId)}`;
  const out: ButirTugas[] = [];
  const d = f.dokumen;
  if (d) {
    const belumUnggah = Math.max(d.kurang - d.menunggu - d.ditolak, 0);
    const batas = d.sisaHari === null ? "" : d.sisaHari < 0 ? " · batas sudah lewat" : d.sisaHari === 0 ? " · batas hari ini" : ` · batas ${d.sisaHari} hari lagi`;
    out.push({
      kunci: "dokumen",
      label: "Dokumen persyaratan",
      href: `${dasar}/dokumen`,
      ...(d.lengkap
        ? { status: "selesai" as const, keterangan: "Semua berkas diterima" }
        : d.ditolak
          ? { status: "perlu" as const, keterangan: `${d.ditolak} berkas ditolak — unggah ulang${batas}` }
          : belumUnggah
            ? { status: "perlu" as const, keterangan: `${belumUnggah} berkas belum diunggah${batas}` }
            : { status: "nanti" as const, keterangan: `${d.menunggu} berkas menunggu diperiksa penyelenggara` }),
    });
  }
  const butirTes = (jenis: "PRE" | "POST") => {
    const t = f.tes.find((x) => x.jenis === jenis);
    if (!t) return;
    const label = jenis === "PRE" ? "Pre-test" : "Post-test";
    const href = `${dasar}/tes/${jenis.toLowerCase()}`;
    out.push(
      t.selesai
        ? { kunci: `tes-${jenis}`, label, status: "selesai", keterangan: "Sudah dikerjakan", href }
        : t.status === "DIBUKA"
          ? { kunci: `tes-${jenis}`, label, status: "perlu", keterangan: "Sedang dibuka — kerjakan sekarang", href }
          : t.status === "TERJADWAL"
            ? { kunci: `tes-${jenis}`, label, status: "nanti", keterangan: t.buka ? `Dibuka ${tglSingkat(t.buka)}` : "Belum dibuka", href: null }
            : { kunci: `tes-${jenis}`, label, status: "terlewat", keterangan: "Sudah ditutup, tidak dikerjakan", href: null },
    );
  };
  const butirSeminar = (jenis: "RAP" | "LAP") => {
    const s = f.seminar.find((x) => x.jenis === jenis);
    if (!s || !s.tanggal) return;
    const label = jenis === "RAP" ? "Seminar Rancangan Aksi Perubahan" : "Seminar Laporan Aksi Perubahan";
    out.push(
      s.status === "SELESAI"
        ? { kunci: `seminar-${jenis}`, label, status: "selesai", keterangan: "Sudah dilaksanakan", href: dasar }
        : s.status === "TIDAK_HADIR"
          ? { kunci: `seminar-${jenis}`, label, status: "terlewat", keterangan: "Tercatat tidak hadir", href: dasar }
          : s.tanggal === hariIni
            ? { kunci: `seminar-${jenis}`, label, status: "perlu", keterangan: "Hari ini — pantau giliran Anda", href: dasar }
            : s.tanggal < hariIni
              ? { kunci: `seminar-${jenis}`, label, status: "nanti", keterangan: "Menunggu pembaruan penyelenggara", href: dasar }
              : { kunci: `seminar-${jenis}`, label, status: "nanti", keterangan: `Terjadwal ${tglSingkat(s.tanggal)}`, href: dasar },
    );
  };
  butirTes("PRE");
  butirSeminar("RAP");
  butirSeminar("LAP");
  butirTes("POST");
  out.push(
    f.evaluasi.tertunda > 0
      ? { kunci: "evaluasi", label: "Evaluasi pengajar & penyelenggaraan", status: "perlu", keterangan: `${f.evaluasi.tertunda} evaluasi bisa diisi`, href: `${dasar}/evaluasi` }
      : f.evaluasi.terisi > 0
        ? { kunci: "evaluasi", label: "Evaluasi pengajar & penyelenggaraan", status: "selesai", keterangan: "Sudah diisi", href: `${dasar}/evaluasi` }
        : { kunci: "evaluasi", label: "Evaluasi pengajar & penyelenggaraan", status: "nanti", keterangan: "Dibuka setelah sesi berlangsung", href: null },
  );
  return out;
}
