/**
 * Penugasan per angkatan (EB-035, Rancangan Langkah 3): coach, mentor, penguji, penguji akademik,
 * dan pendamping studi lapangan pada satu diklat PKA/PKP. Logika MURNI, diuji di uji/murni.test.ts.
 *
 * Larangan rangkap (Pedoman Anak Lampiran 2, persyaratan Coach dan Penguji): dalam satu angkatan,
 * orang yang sama tidak boleh menjadi Coach dan Penguji, Coach dan Mentor, atau Penguji dan Mentor.
 * Penguji akademik ikut dihitung sebagai penguji (keputusan Hamzah 5 Nov 2026, EB-036).
 */
export const PERAN_ANGKATAN = [
  { kode: "COACH", label: "Coach", butuhLingkup: true },
  { kode: "MENTOR", label: "Mentor", butuhLingkup: true },
  { kode: "PENGUJI", label: "Penguji aktualisasi", butuhLingkup: true },
  { kode: "PENGUJI_AKADEMIK", label: "Penguji akademik", butuhLingkup: false },
  { kode: "PENDAMPING_STULA", label: "Pendamping studi lapangan", butuhLingkup: false },
] as const;
export type PeranAngkatan = (typeof PERAN_ANGKATAN)[number]["kode"];

export const STATUS_PENUGASAN = ["USULAN", "AKTIF", "DITOLAK", "DICABUT"] as const;
export type StatusPenugasan = (typeof STATUS_PENUGASAN)[number];
export const LABEL_STATUS_PENUGASAN: Record<StatusPenugasan, string> = {
  USULAN: "Usulan peserta",
  AKTIF: "Aktif",
  DITOLAK: "Ditolak",
  DICABUT: "Dicabut",
};

export function isPeranAngkatan(v: unknown): v is PeranAngkatan {
  return typeof v === "string" && PERAN_ANGKATAN.some((p) => p.kode === v);
}
export function labelPeranAngkatan(kode: string): string {
  return PERAN_ANGKATAN.find((p) => p.kode === kode)?.label ?? kode;
}

/** Kelompok larangan rangkap: peran berbeda kelompok tidak boleh dipegang orang yang sama. */
function kelompokRangkap(peran: string): string | null {
  if (peran === "COACH") return "coach";
  if (peran === "MENTOR") return "mentor";
  if (peran === "PENGUJI" || peran === "PENGUJI_AKADEMIK") return "penguji";
  return null;
}

export type OrangPenugasan = { pegawaiId?: string | null; nama: string; email?: string | null };

/** Kunci pembanding orang: pegawai balai lewat id, orang luar lewat email lalu nama. */
export function kunciOrang(o: OrangPenugasan): string {
  if (o.pegawaiId) return `P:${o.pegawaiId}`;
  if (o.email && o.email.trim()) return `E:${o.email.trim().toLowerCase()}`;
  return `N:${o.nama.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * Cek rangkap terhadap penugasan yang masih berlaku (AKTIF) di angkatan yang sama.
 * Hasil: null = boleh, string = pesan penolakan.
 */
export function periksaRangkap(
  ada: { peran: string; status: string; orang: OrangPenugasan }[],
  baru: { peran: string; orang: OrangPenugasan },
): string | null {
  const kb = kelompokRangkap(baru.peran);
  if (!kb) return null;
  const k = kunciOrang(baru.orang);
  const bentrok = ada.find((a) => {
    const ka = kelompokRangkap(a.peran);
    return a.status === "AKTIF" && ka !== null && ka !== kb && kunciOrang(a.orang) === k;
  });
  if (!bentrok) return null;
  return `${baru.orang.nama} sudah menjadi ${labelPeranAngkatan(bentrok.peran)} pada angkatan ini. ${labelPeranAngkatan(bentrok.peran)} dan ${labelPeranAngkatan(baru.peran)} tidak boleh dirangkap orang yang sama (Pedoman, Anak Lampiran 2).`;
}

export type IsianPenugasan = {
  peran: unknown;
  pegawaiId?: string | null;
  namaLuar?: string | null;
  pesertaIds?: string[];
  kelompokIds?: string[];
  mulai?: string | null; // "YYYY-MM-DD"
  selesai?: string | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Periksa isian penugasan baru terhadap periode diklat. Hasil: null = sah, string = pesan galat. */
export function periksaIsianPenugasan(isian: IsianPenugasan, periode: { mulai: string; selesai: string | null }): string | null {
  if (!isPeranAngkatan(isian.peran)) return "Pilih peran penugasan.";
  if (!isian.pegawaiId && !(isian.namaLuar && isian.namaLuar.trim().length >= 3)) {
    return "Pilih pegawai, atau isi nama orang luar (minimal 3 huruf).";
  }
  const peran = PERAN_ANGKATAN.find((p) => p.kode === isian.peran)!;
  if (peran.butuhLingkup && !(isian.pesertaIds?.length || isian.kelompokIds?.length)) {
    return `${peran.label} perlu lingkup: pilih peserta atau kelompok yang ditugaskan.`;
  }
  for (const [nama, v] of [["mulai", isian.mulai], ["selesai", isian.selesai]] as const) {
    if (v && !ISO.test(v)) return `Tanggal ${nama} tidak sah.`;
  }
  if (isian.mulai && isian.selesai && isian.selesai < isian.mulai) return "Tanggal selesai lebih awal dari tanggal mulai.";
  const akhir = periode.selesai ?? periode.mulai;
  if ((isian.mulai && (isian.mulai < periode.mulai || isian.mulai > akhir)) || (isian.selesai && (isian.selesai < periode.mulai || isian.selesai > akhir))) {
    return `Masa penugasan harus di dalam periode diklat (${periode.mulai} s.d. ${akhir}).`;
  }
  return null;
}

export type IsianUsulanMentor = { nama?: string; jabatan?: string; instansi?: string; email?: string; ponsel?: string };

/** Usulan mentor dari peserta (keputusan Hamzah 5 Nov 2026). Hasil: null = sah, string = pesan galat. */
export function periksaUsulanMentor(isian: IsianUsulanMentor): string | null {
  if (!isian.nama || isian.nama.trim().length < 3) return "Isi nama mentor (minimal 3 huruf).";
  if (!isian.jabatan || isian.jabatan.trim().length < 3) return "Isi jabatan mentor.";
  if (isian.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(isian.email.trim())) return "Alamat email mentor tidak sah.";
  if (isian.ponsel && !/^\+?[0-9 ()-]{8,20}$/.test(isian.ponsel.trim())) return "Nomor ponsel mentor tidak sah.";
  return null;
}
