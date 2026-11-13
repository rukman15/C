/**
 * Dokumen persyaratan peserta PKA/PKP — logika MURNI (diuji di uji/murni.test.ts).
 *
 * Dasar: Pedoman (KepKa LAN 2/K.1/PDP.07/2023) Bab II.g + daftar berkas form pendaftaran
 * balai (PKA 1 2026). Keputusan 14 Okt 2026 (CATATAN-KEPUTUSAN-14OKT.md bagian A):
 *   - PDF/JPG/PNG, maksimal 2 MB per berkas;
 *   - batas unggah bawaan H-7 sebelum diklat mulai (bisa diubah per diklat);
 *   - ruang belajar, tes, dan evaluasi terkunci sampai semua berkas wajib DITERIMA;
 *   - berkas 4 (surat pejabat) wajib bagi usulan instansi, berkas 8 (rekomendasi
 *     BPSDM/BKPSDM) hanya bagi pendaftar perorangan.
 * Isi berkas TIDAK pernah lewat modul ini — hanya jenis, status, dan metadata berkas.
 */
import { selisihHariIso, tambahHariIso } from "@/lib/tanggal";

export type JalurPendaftaran = "INSTANSI" | "PERORANGAN";
export const JALUR_PENDAFTARAN: { value: JalurPendaftaran; label: string }[] = [
  { value: "INSTANSI", label: "Diusulkan instansi" },
  { value: "PERORANGAN", label: "Pendaftar perorangan" },
];
export const isJalurPendaftaran = (v: unknown): v is JalurPendaftaran => v === "INSTANSI" || v === "PERORANGAN";

export type WajibUntuk = "SEMUA" | JalurPendaftaran;

export type JenisDokumen =
  | "PAKTA_INTEGRITAS"
  | "SK_JABATAN"
  | "SK_PANGKAT"
  | "SURAT_PEJABAT"
  | "SEHAT"
  | "BEBAS_NARKOTIKA"
  | "KELAKUAN_BAIK"
  | "REKOMENDASI_BPSDM"
  | "BEBAS_DISIPLIN"
  | "FOTO";

export type DataJenisDokumen = {
  kode: JenisDokumen;
  label: string;
  keterangan?: string;
  wajibUntuk: WajibUntuk;
  /** Data pribadi yang sensitif (kesehatan, catatan kepolisian): hanya penyelenggara diklat, unduhan dicatat. */
  sensitif: boolean;
  /** Jenis berkas yang diterima. Foto hanya gambar. */
  format: readonly FormatBerkas[];
};

export type FormatBerkas = "application/pdf" | "image/jpeg" | "image/png";
const SEMUA_FORMAT: readonly FormatBerkas[] = ["application/pdf", "image/jpeg", "image/png"];
const GAMBAR: readonly FormatBerkas[] = ["image/jpeg", "image/png"];

/** Urutan = urutan di form pendaftaran balai. */
export const JENIS_DOKUMEN: readonly DataJenisDokumen[] = [
  {
    kode: "PAKTA_INTEGRITAS",
    label: "Pakta integritas",
    keterangan: "Surat pernyataan kesediaan mematuhi ketentuan (Formulir 1), bermaterai dan ditandatangani",
    wajibUntuk: "SEMUA",
    sensitif: false,
    format: SEMUA_FORMAT,
  },
  { kode: "SK_JABATAN", label: "SK jabatan terakhir", wajibUntuk: "SEMUA", sensitif: false, format: SEMUA_FORMAT },
  { kode: "SK_PANGKAT", label: "SK pangkat dan golongan terakhir", wajibUntuk: "SEMUA", sensitif: false, format: SEMUA_FORMAT },
  {
    kode: "SURAT_PEJABAT",
    label: "Surat dari pejabat yang berwenang",
    keterangan: "Surat usulan dari PyB atau PPK instansi asal",
    wajibUntuk: "INSTANSI",
    sensitif: false,
    format: SEMUA_FORMAT,
  },
  { kode: "SEHAT", label: "Surat keterangan sehat", keterangan: "Dari dokter/klinik pemerintah", wajibUntuk: "SEMUA", sensitif: true, format: SEMUA_FORMAT },
  {
    kode: "BEBAS_NARKOTIKA",
    label: "Surat keterangan bebas narkotika",
    keterangan: "Dari BNN, dinas kesehatan, atau klinik pemerintah",
    wajibUntuk: "SEMUA",
    sensitif: true,
    format: SEMUA_FORMAT,
  },
  { kode: "KELAKUAN_BAIK", label: "Surat keterangan kelakuan baik", keterangan: "Dari Polres", wajibUntuk: "SEMUA", sensitif: true, format: SEMUA_FORMAT },
  {
    kode: "REKOMENDASI_BPSDM",
    label: "Surat rekomendasi BPSDM/BKPSDM",
    keterangan: "Khusus pendaftar perorangan",
    wajibUntuk: "PERORANGAN",
    sensitif: false,
    format: SEMUA_FORMAT,
  },
  {
    kode: "BEBAS_DISIPLIN",
    label: "Surat keterangan tidak sedang dijatuhi hukuman disiplin",
    keterangan: "Termasuk tidak sedang dalam proses penetapan hukuman disiplin; dari Biro SDM/BKD",
    wajibUntuk: "SEMUA",
    sensitif: true,
    format: SEMUA_FORMAT,
  },
  {
    kode: "FOTO",
    label: "Pas foto 4x6",
    keterangan: "Latar merah, kemeja putih, celana/rok hitam, dasi hitam polos; berhijab berkerudung hitam",
    wajibUntuk: "SEMUA",
    sensitif: false,
    format: GAMBAR,
  },
];

export const isJenisDokumen = (v: unknown): v is JenisDokumen => JENIS_DOKUMEN.some((j) => j.kode === v);
export const dataJenisDokumen = (kode: string): DataJenisDokumen | undefined => JENIS_DOKUMEN.find((j) => j.kode === kode);

/** Berkas yang wajib untuk satu jalur pendaftaran, berurutan. */
export function dokumenWajib(jalur: JalurPendaftaran): JenisDokumen[] {
  return JENIS_DOKUMEN.filter((j) => j.wajibUntuk === "SEMUA" || j.wajibUntuk === jalur).map((j) => j.kode);
}

// --- Berkas ---------------------------------------------------------------------

export const UKURAN_MAKS_BYTE = 2 * 1024 * 1024;

const EKSTENSI: Record<FormatBerkas, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

/** Periksa berkas sebelum disimpan. Pesan galat untuk pengguna, atau null kalau boleh. */
export function periksaBerkas(jenis: string, berkas: { nama: string; tipe: string; ukuran: number }): string | null {
  const data = dataJenisDokumen(jenis);
  if (!data) return "Jenis dokumen tidak dikenal";
  if (!Number.isFinite(berkas.ukuran) || berkas.ukuran <= 0) return "Berkas kosong";
  if (berkas.ukuran > UKURAN_MAKS_BYTE) return `Ukuran berkas ${(berkas.ukuran / 1024 / 1024).toFixed(1).replace(".", ",")} MB, maksimal 2 MB`;
  const tipe = berkas.tipe as FormatBerkas;
  const daftar = data.format.map((f) => EKSTENSI[f].join("/").toUpperCase()).join(", ");
  if (!data.format.includes(tipe)) return `Format berkas harus ${daftar}`;
  const eks = berkas.nama.toLowerCase().split(".").pop() ?? "";
  if (!EKSTENSI[tipe].includes(eks)) return `Ekstensi berkas tidak sesuai jenisnya (harus ${EKSTENSI[tipe].join("/")})`;
  return null;
}

// --- Status & batas waktu --------------------------------------------------------

export type StatusDokumen = "BELUM" | "DIUNGGAH" | "DITERIMA" | "DITOLAK";
export const LABEL_STATUS_DOKUMEN: Record<StatusDokumen, string> = {
  BELUM: "Belum diunggah",
  DIUNGGAH: "Menunggu diperiksa",
  DITERIMA: "Diterima",
  DITOLAK: "Ditolak",
};
export const isStatusDokumen = (v: unknown): v is StatusDokumen => typeof v === "string" && v in LABEL_STATUS_DOKUMEN;

/** Batas unggah bawaan: H-7 sebelum tanggal mulai diklat. */
export const BATAS_BAWAAN_HARI = 7;
export const batasBawaan = (tanggalMulai: string): string => tambahHariIso(tanggalMulai, -BATAS_BAWAAN_HARI);

export type RingkasDokumen = {
  wajib: JenisDokumen[];
  diterima: JenisDokumen[];
  /** Wajib tetapi belum DITERIMA (belum diunggah, menunggu diperiksa, atau ditolak). */
  kurang: JenisDokumen[];
  menunggu: JenisDokumen[];
  ditolak: JenisDokumen[];
  lengkap: boolean;
  /** Hari menuju batas (negatif = sudah lewat); null kalau tidak ada batas. */
  sisaHari: number | null;
  lewatBatas: boolean;
};

/**
 * Rekap berkas satu peserta. `berkas` = baris tersimpan (jenis + status); jenis yang
 * tidak ada barisnya dianggap BELUM. Hanya berkas terbaru per jenis yang dipakai — kalau
 * ada beberapa baris satu jenis, pemanggil mengirim yang terbaru saja.
 */
export function ringkasDokumen(
  jalur: JalurPendaftaran,
  berkas: { jenis: string; status: string }[],
  batas: string | null,
  hariIni: string,
): RingkasDokumen {
  const status = new Map<string, StatusDokumen>();
  for (const b of berkas) if (isStatusDokumen(b.status)) status.set(b.jenis, b.status);
  const wajib = dokumenWajib(jalur);
  const pada = (s: StatusDokumen) => wajib.filter((k) => (status.get(k) ?? "BELUM") === s);
  const diterima = pada("DITERIMA");
  const sisaHari = batas ? selisihHariIso(hariIni, batas) : null;
  return {
    wajib,
    diterima,
    kurang: wajib.filter((k) => status.get(k) !== "DITERIMA"),
    menunggu: pada("DIUNGGAH"),
    ditolak: pada("DITOLAK"),
    lengkap: diterima.length === wajib.length,
    sisaHari,
    lewatBatas: sisaHari !== null && sisaHari < 0,
  };
}

/** Ruang belajar, tes, dan evaluasi terbuka hanya kalau semua berkas wajib sudah DITERIMA. */
export const ruangBelajarTerbuka = (r: RingkasDokumen) => r.lengkap;

/** Alasan penolakan wajib diisi (ditampilkan ke peserta). */
export function periksaKeputusan(status: string, alasan: string | null | undefined): string | null {
  if (status !== "DITERIMA" && status !== "DITOLAK") return "Keputusan harus diterima atau ditolak";
  if (status === "DITOLAK" && !(alasan ?? "").trim()) return "Alasan penolakan wajib diisi";
  if ((alasan ?? "").length > 300) return "Alasan maksimal 300 karakter";
  return null;
}

/**
 * Berkas yang isinya tidak berubah antardiklat — boleh disalin dari diklat sebelumnya milik akun yang sama
 * (yang sudah DITERIMA), lalu diperiksa ulang penyelenggara. Berkas bermasa berlaku (sehat, bebas narkotika,
 * kelakuan baik, bebas disiplin) dan berkas khusus satu diklat (pakta, surat pejabat, rekomendasi) tidak.
 */
export const DAPAT_DIPAKAI_ULANG: readonly JenisDokumen[] = ["SK_JABATAN", "SK_PANGKAT", "FOTO"];
export const dapatDipakaiUlang = (jenis: string) => (DAPAT_DIPAKAI_ULANG as readonly string[]).includes(jenis);
