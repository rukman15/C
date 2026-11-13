// Alur tugas peserta (EB-038; docs/spesifikasi/Rancangan_Dasbor_Pengelola_dan_Tugas.md bagian 5).
// Logika murni — diuji di uji/murni.test.ts.

export const JENIS_TUGAS = [
  { kode: "RANCANGAN_AKSI", label: "Rancangan Aksi Perubahan", peninjau: ["COACH", "MENTOR"] },
  { kode: "LAPORAN_PROGRES", label: "Laporan progres", peninjau: ["COACH", "MENTOR"] },
  { kode: "TUGAS_PEMBELAJARAN", label: "Tugas pembelajaran", peninjau: ["PENGAMPU"] },
] as const;
export type JenisTugas = (typeof JENIS_TUGAS)[number]["kode"];
export type PeranPeninjau = "COACH" | "MENTOR" | "PENGAMPU";
export const LABEL_PERAN_PENINJAU: Record<PeranPeninjau | "PESERTA" | "PENGELOLA", string> = {
  COACH: "Coach",
  MENTOR: "Mentor",
  PENGAMPU: "Pengampu",
  PESERTA: "Peserta",
  PENGELOLA: "Penyelenggara",
};

export const isJenisTugas = (v: unknown): v is JenisTugas => JENIS_TUGAS.some((j) => j.kode === v);
export const labelJenisTugas = (kode: string) => JENIS_TUGAS.find((j) => j.kode === kode)?.label ?? kode;
export function peninjauJenis(kode: string): readonly PeranPeninjau[] {
  return JENIS_TUGAS.find((j) => j.kode === kode)?.peninjau ?? [];
}

export const STATUS_KIRIMAN = ["DRAF", "DIKIRIM", "DITINJAU", "PERLU_REVISI", "DITERIMA"] as const;
export type StatusKiriman = (typeof STATUS_KIRIMAN)[number];
export const LABEL_STATUS_KIRIMAN: Record<StatusKiriman, string> = {
  DRAF: "Draf",
  DIKIRIM: "Dikirim",
  DITINJAU: "Dalam tinjauan",
  PERLU_REVISI: "Perlu revisi",
  DITERIMA: "Diterima",
};
/** Belum ada kiriman sama sekali (baris belum dibuat). */
export const LABEL_BELUM = "Belum dikerjakan";
export const labelStatusKiriman = (s: string | null | undefined) => (s ? (LABEL_STATUS_KIRIMAN[s as StatusKiriman] ?? s) : LABEL_BELUM);

/** Kiriman yang menunggu peninjau. */
export const menungguTinjauan = (s: string) => s === "DIKIRIM" || s === "DITINJAU";

// --- Tindakan & perpindahan status -------------------------------------------------------

export type AksiPeserta = "UNGGAH" | "KIRIM";
export type AksiPeninjau = "MULAI_TINJAU" | "REVISI" | "TERIMA" | "CATATAN" | "SETUJU_MENTOR";
export type AksiKiriman = AksiPeserta | AksiPeninjau;
export const AKSI_PENINJAU: AksiPeninjau[] = ["MULAI_TINJAU", "REVISI", "TERIMA", "CATATAN", "SETUJU_MENTOR"];
export const isAksiPeninjau = (v: unknown): v is AksiPeninjau => AKSI_PENINJAU.includes(v as AksiPeninjau);

/**
 * Status sesudah `aksi`, atau pesan galat bila tidak boleh.
 *  - Peserta mengunggah/mengganti berkas selama DRAF atau PERLU_REVISI, lalu mengirim (butuh berkas).
 *  - Peninjau: mulai tinjau (DIKIRIM), minta revisi / terima (DIKIRIM, DITINJAU), catatan (setelah dikirim),
 *    persetujuan mentor atas isu & timeline (hanya Rancangan Aksi Perubahan; tidak mengubah status, TG-3).
 */
export function statusSesudah(
  status: StatusKiriman,
  aksi: AksiKiriman,
  o: { adaBerkas?: boolean; catatan?: string | null; jenis?: string; peran?: PeranPeninjau | "PESERTA" } = {},
): { ok: true; status: StatusKiriman } | { ok: false; pesan: string } {
  const catatan = (o.catatan ?? "").trim();
  switch (aksi) {
    case "UNGGAH":
      if (status === "DRAF" || status === "PERLU_REVISI") return { ok: true, status };
      return { ok: false, pesan: status === "DITERIMA" ? "Tugas ini sudah diterima." : "Tugas sudah dikirim; tunggu tinjauan sebelum mengganti berkas." };
    case "KIRIM":
      if (status !== "DRAF" && status !== "PERLU_REVISI") return { ok: false, pesan: "Tugas ini sudah dikirim." };
      if (!o.adaBerkas) return { ok: false, pesan: "Unggah berkas dulu sebelum mengirim." };
      return { ok: true, status: "DIKIRIM" };
    case "MULAI_TINJAU":
      if (status !== "DIKIRIM") return { ok: false, pesan: "Hanya kiriman baru yang bisa mulai ditinjau." };
      return { ok: true, status: "DITINJAU" };
    case "REVISI":
      if (!menungguTinjauan(status)) return { ok: false, pesan: "Revisi hanya bisa diminta untuk kiriman yang menunggu tinjauan." };
      if (catatan.length < 5) return { ok: false, pesan: "Tulis catatan revisi untuk peserta (minimal 5 huruf)." };
      return { ok: true, status: "PERLU_REVISI" };
    case "TERIMA":
      if (!menungguTinjauan(status)) return { ok: false, pesan: "Hanya kiriman yang menunggu tinjauan yang bisa diterima." };
      return { ok: true, status: "DITERIMA" };
    case "CATATAN":
      if (status === "DRAF") return { ok: false, pesan: "Tugas belum dikirim." };
      if (catatan.length < 2) return { ok: false, pesan: "Catatan masih kosong." };
      return { ok: true, status };
    case "SETUJU_MENTOR":
      if (o.jenis !== "RANCANGAN_AKSI") return { ok: false, pesan: "Persetujuan mentor hanya untuk Rancangan Aksi Perubahan." };
      if (o.peran !== "MENTOR") return { ok: false, pesan: "Persetujuan isu & timeline diberikan oleh mentor." };
      if (status === "DRAF") return { ok: false, pesan: "Tugas belum dikirim." };
      return { ok: true, status };
  }
}

/** Peran peninjau yang boleh melakukan aksi pada jenis tugas ini. */
export function peranBolehAksi(jenis: string, peran: PeranPeninjau, aksi: AksiPeninjau): boolean {
  if (!peninjauJenis(jenis).includes(peran)) return false;
  if (aksi === "SETUJU_MENTOR") return peran === "MENTOR";
  return true;
}

// --- Isian tugas & berkas -----------------------------------------------------------------

export type IsianTugas = { jenis?: string; judul?: string; petunjuk?: string | null; tenggat?: string | null; mataPelatihan?: string | null };

const isTanggal = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`));

/** Galat isian tugas, atau null. `mataPelatihanSah` = kode mata pelatihan program diklat ini. */
export function periksaIsianTugas(
  isian: IsianTugas,
  periode: { mulai: string; selesai: string | null },
  mataPelatihanSah: string[],
): string | null {
  if (!isJenisTugas(isian.jenis)) return "Pilih jenis tugas.";
  const judul = (isian.judul ?? "").trim();
  if (judul.length < 3) return "Isi judul tugas (minimal 3 huruf).";
  if (judul.length > 160) return "Judul tugas terlalu panjang (maksimal 160 huruf).";
  if ((isian.petunjuk ?? "").length > 2000) return "Petunjuk terlalu panjang (maksimal 2.000 huruf).";
  if (isian.tenggat) {
    if (!isTanggal(isian.tenggat)) return "Tanggal tenggat tidak sah.";
    if (isian.tenggat < periode.mulai || (periode.selesai && isian.tenggat > periode.selesai)) return "Tenggat harus di dalam periode diklat.";
  }
  if (isian.jenis === "TUGAS_PEMBELAJARAN") {
    if (!isian.mataPelatihan) return "Pilih mata pelatihan untuk tugas pembelajaran.";
    if (!mataPelatihanSah.includes(isian.mataPelatihan)) return "Mata pelatihan bukan bagian dari program diklat ini.";
  } else if (isian.mataPelatihan) {
    return "Mata pelatihan hanya diisi untuk tugas pembelajaran.";
  }
  return null;
}

/** Berkas tugas (TG-4): PDF, DOCX, XLSX, PPTX, JPG, PNG; maksimal 10 MB. */
export const UKURAN_MAKS_TUGAS = 10 * 1024 * 1024;
export const TIPE_BERKAS_TUGAS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};
export const TERIMA_BERKAS_TUGAS = ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png";

/** Tipe dari ekstensi — beberapa browser mengirim tipe kosong/umum untuk berkas Office. */
export function tipeDariNama(nama: string): string | null {
  const eks = nama.toLowerCase().split(".").pop() ?? "";
  return Object.entries(TIPE_BERKAS_TUGAS).find(([, daftar]) => daftar.includes(eks))?.[0] ?? null;
}

export function periksaBerkasTugas(b: { nama: string; tipe: string; ukuran: number }): string | null {
  if (!Number.isFinite(b.ukuran) || b.ukuran <= 0) return "Berkas kosong.";
  if (b.ukuran > UKURAN_MAKS_TUGAS) return `Ukuran berkas ${(b.ukuran / 1024 / 1024).toFixed(1).replace(".", ",")} MB, maksimal 10 MB.`;
  const eks = b.nama.toLowerCase().split(".").pop() ?? "";
  const dariNama = tipeDariNama(b.nama);
  if (!dariNama) return "Format berkas harus PDF, DOCX, XLSX, PPTX, JPG, atau PNG.";
  if (b.tipe && b.tipe !== "application/octet-stream" && TIPE_BERKAS_TUGAS[b.tipe] && !TIPE_BERKAS_TUGAS[b.tipe].includes(eks)) {
    return "Ekstensi berkas tidak sesuai jenisnya.";
  }
  return null;
}

/** Isi berkas sesuai tipenya: tanda tangan biner di awal berkas (Office modern = arsip ZIP "PK\x03\x04"). */
export function isiSesuaiTipeTugas(isi: Uint8Array, tipe: string): boolean {
  const awal = (b: number[]) => b.every((x, i) => isi[i] === x);
  if (tipe === "application/pdf") return awal([0x25, 0x50, 0x44, 0x46]);
  if (tipe === "image/png") return awal([0x89, 0x50, 0x4e, 0x47]);
  if (tipe === "image/jpeg") return awal([0xff, 0xd8, 0xff]);
  if (TIPE_BERKAS_TUGAS[tipe]) return awal([0x50, 0x4b, 0x03, 0x04]);
  return false;
}

// --- Ringkasan -----------------------------------------------------------------------------

export type RekapKiriman = Record<StatusKiriman | "BELUM", number>;

/** Rekap status kiriman satu tugas; peserta tanpa baris kiriman = BELUM. */
export function rekapKiriman(jumlahPeserta: number, status: string[]): RekapKiriman {
  const r: RekapKiriman = { BELUM: 0, DRAF: 0, DIKIRIM: 0, DITINJAU: 0, PERLU_REVISI: 0, DITERIMA: 0 };
  for (const s of status) if (s in r) r[s as StatusKiriman]++;
  r.BELUM = Math.max(jumlahPeserta - status.length, 0);
  return r;
}

/** Hari menunggu tinjauan (untuk "perlu perhatian": lebih dari 7 hari, dasar REG-007 coach mingguan). */
export const BATAS_TUNGGU_HARI = 7;
export function lamaMenunggu(dikirimPada: string | null, now: Date): number {
  if (!dikirimPada) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(dikirimPada)) / 86_400_000));
}
