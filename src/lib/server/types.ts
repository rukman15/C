import "server-only";
import type { AturanKehadiran, RekapKehadiran, StatusKehadiran } from "@/lib/kehadiran";
import type { StatusPeserta } from "@/lib/peserta";
import type { AspekPenilaian, HasilPeserta, NilaiAspek } from "@/lib/penilaian";
import type { JenisEvaluasi } from "@/lib/kurikulum";

/** Tipe domain server — selaras dengan frontend, siap dipetakan ke schema DB. */

/**
 * Widyaiswara = pegawai berjabatan "WIDYAISWARA ..." (tabel `pegawai`), bukan
 * tabel terpisah. Field HR (name/role/education/gender/ageGroup) diturunkan
 * dari kolom pegawai, `jpTerpakai` dihitung dari penugasan "disetujui";
 * `id` = Pegawai.id.
 */
export type WiRecord = {
  id: string;
  name: string;
  role: string;
  unit: string;
  education: string;
  ageGroup: string;
  gender: "Laki-laki" | "Perempuan";
  status: "Aktif" | "Cuti";
  /** JP penugasan disetujui pada diklat yang mulai di `bulanBeban`. */
  jpTerpakai?: number;
  /** Batas JP PER BULAN yang berlaku (khusus WI, atau batas jenjangnya). Kosong = belum diatur. */
  jpMaksimal?: number;
  /** JP semua penugasan disetujui (sepanjang waktu) — info saja, bukan dasar batas. */
  jpTotal?: number;
  /** Batas khusus WI ini (pegawai.jpMaksimal); kosong = ikut batas jenjang. */
  batasSendiri?: number;
  sumberBatas?: "wi" | "jenjang";
  /** "YYYY-MM" yang dipakai untuk jpTerpakai. */
  bulanBeban?: string;
  spesialisasi?: string[];
  bio?: string;
};

export type PegawaiRecord = {
  id: string;
  no?: number;
  nama: string;
  nip?: string;
  jenisKelamin?: string;
  jenisKepegawaian?: string;
  tempatLahir?: string;
  tanggalLahir?: string; // ISO date
  pangkat?: string;
  golRuang?: string;
  jabatan?: string;
  eselonIv?: string;
  eselonIii?: string;
  eselonIi?: string;
  jenisJabatan?: string;
  kelasJabatan?: number;
  tingkatPendidikan?: string;
  jurusan?: string;
  namaUniversitas?: string;
  status: string; // "AKTIF" | ...
};

export type TrainingRecord = {
  id: string;
  name: string;
  category: string;
  participants: number;
  startDate: string; // ISO date
  // BARU — dibutuhin buat fitur penugasan WI (lihat CATATAN-PENUGASAN-WI.md):
  // endDate buat tampilan periode, jpDibutuhkan buat form pengajuan +
  // hitung overCapacity di PendingApprovalRecord.
  endDate?: string; // ISO date
  jpDibutuhkan?: number;
  // Tempat pelaksanaan — default kolom "Tempat" sesi mengajar (lihat PenugasanSesiRecord).
  tempat?: string;
  status: "Berjalan" | "Terjadwal" | "Selesai";
  // LMS tahap 1 — kode program & mode dari $lib/kurikulum.ts; kosong = diklat tanpa kurikulum.
  jenisPelatihan?: string;
  modePelatihan?: string;
  angkatan?: string;
  // Tahap B — tim kerja pemegang diklat (kosong = hanya Ketua Diklat/admin).
  timKerjaId?: string;
  timKerjaNama?: string;
};

export type CatalogTrainingRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  participants: string;
  period: string;
  accent: string;
  mode: "terjadwal" | "mandiri";
  status: string;
};

export type AssignableTrainingRecord = {
  id: string;
  name: string;
  jpDibutuhkan: number;
  periode: string;
  // LMS tahap 1: satu pelatihan boleh punya banyak WI, jadi daftar ini juga
  // memuat pelatihan yang sudah punya WI disetujui beserta rekapnya.
  jenisPelatihan?: string;
  wiDisetujui: number;
  jpDisetujui: number;
  timKerjaId?: string;
};

export type PendingApprovalRecord = {
  id: string;
  trainingName: string;
  instructorName: string;
  instructorId?: string;
  jp: number;
  periode: string;
  diajukanOleh: string;
  diajukanPada: string;
  overCapacity: boolean;
  status: "menunggu" | "disetujui" | "ditolak";
  // Ringkasan buat tab "Sesi Mengajar": jpSesi = total JP semua sesi
  // yang sudah diisi, jmlSesi = banyaknya sesi. Opsional supaya pemakai lama
  // tipe ini tidak perlu berubah.
  trainingId?: string;
  /** Tim kerja pemegang diklatnya (tahap B), untuk menyaring daftar anggota tim. */
  timKerjaId?: string;
  tempat?: string;
  jpSesi?: number;
  jmlSesi?: number;
  // LMS tahap 1 — mata pelatihan yang diampu (kode + nama dari $lib/kurikulum.ts).
  mataPelatihan?: string;
  mataPelatihanNama?: string;
  catatan?: string;
  /** Alasan penolakan oleh Kepala Balai. */
  alasanTolak?: string;
};

/** Rincian satu jadwal diklat untuk halaman /dashboard/diklat/[id]. */
export type TrainingDetailRecord = TrainingRecord & {
  penugasan: PendingApprovalRecord[];
};

// ---------------------------------------------------------------------
// LMS tahap 2 — peserta, jadwal pembelajaran, kehadiran
// ---------------------------------------------------------------------

export type PesertaRecord = {
  id: string;
  trainingId: string;
  nomor: number;
  nama: string;
  nip?: string;
  jabatan?: string;
  instansi?: string;
  status: StatusPeserta;
  catatan?: string;
  /** Sudah tertaut ke akun login (bisa membuka ruang belajar & mengerjakan pre/post-test). */
  punyaAkun: boolean;
  rekap: RekapKehadiran;
};

/** Halaman /dashboard/diklat/[id]/peserta. `aturan` null = diklat tanpa batas ketidakhadiran. */
export type DaftarPesertaRecord = {
  training: TrainingRecord;
  peserta: PesertaRecord[];
  aturan: AturanKehadiran | null;
  /** Banyaknya sesi wajib hadir pada jadwal pembelajaran (0 = belum ada yang bisa direkap). */
  jumlahSesiWajib: number;
};

export type SesiPembelajaranRecord = {
  id: string;
  trainingId: string;
  tanggal: string; // "YYYY-MM-DD"
  jamMulai?: string; // "08:00"
  kegiatan: string;
  jp: number;
  bentuk: string;
  /** false = sesi asinkron/mandiri, kehadirannya tidak dicatat. */
  wajibHadir: boolean;
  mataPelatihan?: string;
  mataPelatihanNama?: string;
  keterangan?: string;
  tautan?: string;
  /** Ruang/tempat sesi; kosong = tempat diklat. */
  ruang?: string;
  /** Nama pengampu mata pelatihan sesi ini (dari penugasan WI); hanya di daftar jadwal. */
  pengampu?: string[];
  diluarPeriode: boolean;
  // Rekap kehadiran peserta AKTIF pada sesi ini.
  hadir: number;
  tidakHadir: number;
  dispensasi: number;
  belumDicatat: number;
  /** Semua catatan pada sesi ini, termasuk milik peserta yang sudah tidak aktif. */
  jumlahCatatan: number;
};

/** Halaman /dashboard/diklat/[id]/absensi. */
export type JadwalPembelajaranRecord = {
  training: TrainingRecord;
  sesi: SesiPembelajaranRecord[];
  pesertaAktif: number;
  /** Hari pelatihan s.d. hari ini yang sudah punya sesi tetapi presensinya belum lengkap ("YYYY-MM-DD"). */
  presensiBelumLengkap: string[];
  /** Hari kerja s.d. hari ini tanpa sesi sama sekali, di luar masa di tempat kerja. */
  presensiTanpaSesi: string[];
  /** Masa peserta di tempat kerja asal (tidak diperiksa "tanpa sesi"). */
  masaTempatKerja: { id: string; jenis: string; label: string; mulai: string; selesai: string }[];
};

export type BarisKehadiranRecord = {
  pesertaId: string;
  nomor: number;
  nama: string;
  instansi?: string;
  statusPeserta: StatusPeserta;
  /** null = belum dicatat. */
  status: StatusKehadiran | null;
  keterangan?: string;
};

export type LembarKehadiranRecord = {
  sesi: SesiPembelajaranRecord;
  baris: BarisKehadiranRecord[];
};

/** Satu sesi mengajar WI pada satu tanggal (dasar rekap JP tatap muka). */
export type PenugasanSesiRecord = {
  id: string;
  penugasanId: string;
  tanggal: string; // "YYYY-MM-DD" (tanggal saja, tanpa jam)
  kegiatan: string;
  jp: number;
  tempat: string;
  keterangan?: string;
  // true kalau tanggal sesi jatuh sebelum mulai / sesudah selesai pelatihannya.
  // Cuma peringatan di UI — tidak memblokir penyimpanan.
  diluarPeriode: boolean;
};

/**
 * Jadwal diklat untuk halaman /dashboard/jadwal — boleh dibaca SEMUA peran yang
 * sudah login, jadi isinya sengaja hanya informasi kalender (tanpa data WI,
 * kebutuhan JP, atau urgensi penugasan).
 */
export type JadwalDiklatRecord = {
  id: string;
  name: string;
  category: string;
  participants: number;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD"
  tempat: string;
  status: "Berjalan" | "Terjadwal" | "Selesai";
};

/** Satu penugasan mengajar milik akun yang login, beserta sesi yang sudah dicatat. */
export type JadwalMengajarRecord = {
  id: string; // id penugasan
  trainingId: string;
  trainingName: string;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string;
  tempat: string;
  jp: number;
  status: "menunggu" | "disetujui";
  mataPelatihanNama?: string;
  /** PKA/PKP: punya lembar penilaian (LMS tahap 3). */
  adaPenilaian: boolean;
  jpSesi: number;
  sesi: { id: string; tanggal: string; kegiatan: string; jp: number; tempat: string }[];
};

export type JadwalRecord = {
  diklat: JadwalDiklatRecord[];
  /** `null` kalau akun ini tidak ditautkan ke data pegawai (tidak mungkin punya penugasan). */
  mengajar: JadwalMengajarRecord[] | null;
};

export type RoleUpdateRecord = {
  id: string;
  role: string;
  type: "jadwal" | "penugasan" | "memo" | "pengumuman";
  priority: "penting" | "segera" | "sedang";
  title: string;
  description: string;
  time: string;
  unread?: boolean;
};

export type LeadershipAgendaRecord = {
  id: string;
  date: string;
  time: string;
  title: string;
  category: "Kunjungan Kerja" | "Rapat Koordinasi" | "Kegiatan Seremonial" | "Lainnya";
  location: string;
  status: "Terjadwal" | "Selesai";
};

export type SubjectRecord = {
  id: string;
  title: string;
  category: string;
  instructor: string;
  schedule: string;
  materials: {
    title: string;
    type: "PDF" | "PPT" | "Video";
    detail: string;
    progress: number;
  }[];
};

export type SarpraFacilityRecord = {
  id: string;
  name: string;
  category: string;
  luas?: string;
  kapasitas?: string;
  fasilitas?: string[];
  disewakanUntukUmum?: boolean;
};

export type TimKerjaAnggotaRecord = {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  pegawaiJabatan?: string;
  peran: "ketua" | "anggota";
};

export type TimKerjaRecord = {
  id: string;
  nama: string;
  deskripsi?: string;
  wewenang: string[];
  anggota: TimKerjaAnggotaRecord[];
};

export type RingkasanLembagaRecord = {
  pelatihan: {
    terjadwal: number;
    berjalan: number;
    selesai: number;
    /** Total `participants` training yang belum Selesai (Terjadwal + Berjalan). */
    totalPesertaAktif: number;
  };
  penugasanWi: {
    menunggu: number;
    disetujui: number;
    ditolak: number;
    /** Training yang sudah lewat batas H-3 tapi belum punya WI disetujui. */
    trainingButuhWiSegera: { id: string; name: string; startDate: string }[];
  };
  widyaiswara: {
    total: number;
    totalJpTerpakai: number;
    /** Jumlah `jpMaksimal` HANYA dari WI yang kapasitasnya sudah diisi. */
    totalJpMaksimal: number;
    /** `jpTerpakai` HANYA dari WI yang kapasitasnya sudah diisi — pembilang persentase yang sepadan dengan `totalJpMaksimal`. */
    jpTerpakaiBerKapasitas: number;
    jumlahOverCapacity: number;
    jumlahBelumAdaJpMaksimal: number;
  };
  pegawai: {
    total: number;
    aktif: number;
  };
  /** Tugas keluar tahun berjalan (surat tugas bernomor): jumlah surat, pegawai unik, dan SPD yang belum dibuat. */
  /** null bila tidak ada data persuratan untuk pembaca. */
  tugasKeluar: {
    suratUmum: number;
    suratTerkaitDiklat: number;
    suratMengajar: number;
    pegawaiUnik: number;
    spdBelumDibuat: number;
  } | null;
};

export type InstructorScheduleRecord = {
  id: string;
  date: string;
  time: string;
  instructor: string;
  instructorId?: string;
  training: string;
  room: string;
  status: "Terjadwal" | "Selesai";
};

/** LMS tahap 3 — satu sel lembar penilaian. */
export type SelNilaiRecord = NilaiAspek & {
  /** Isian penilai yang sedang login (WI) — null kalau belum mengisi. */
  milikSaya: number | null;
};

export type PesertaPenilaianRecord = {
  id: string;
  nomor: number;
  nama: string;
  nip?: string;
  instansi?: string;
  status: StatusPeserta;
  /** Tingkat kehadiran dari tahap 2 ("batas" = melewati batas ketidakhadiran). */
  kehadiran: "aman" | "peringatan" | "batas";
  /** Per kode aspek. WI hanya menerima aspek yang boleh ia isi. */
  nilai: Record<string, SelNilaiRecord>;
  /** Hanya untuk penyelenggara & pimpinan. */
  remedial?: Partial<Record<JenisEvaluasi, number>>;
  hasil?: HasilPeserta;
  /** Peringkat di antara peserta aktif yang lulus (null = tanpa peringkat). */
  peringkat?: number | null;
};

/** Halaman /dashboard/diklat/[id]/penilaian. */
export type LembarPenilaianRecord = {
  training: TrainingRecord;
  /** PENYELENGGARA = Ketua Diklat/admin; WI = pengampu/penguji/coach; PIMPINAN = hanya melihat. */
  peran: "PENYELENGGARA" | "WI" | "PIMPINAN";
  bolehUbah: boolean;
  aspek: AspekPenilaian[];
  peserta: PesertaPenilaianRecord[];
};

/** Ringkasan kelulusan satu diklat PKA/PKP (peserta aktif). */
export type KelulusanRingkasRecord = {
  lulus: number;
  ditunda: number;
  tidakLulus: number;
  belumLengkap: number;
  /** Rata-rata nilai akhir peserta aktif yang nilainya lengkap; null kalau belum ada. */
  rataNilai: number | null;
};

/** Home Kepala Balai (GET /api/dashboard/pimpinan). */
export type DashboardPimpinanRecord = {
  tahun: number;
  tindakan: {
    /** Pengajuan cuti pegawai yang menunggu keputusan. */
    cutiMenunggu: number;
    tanpaWi: { id: string; name: string; startDate: string; urgensi: string }[];
    kehadiranBatas: { id: string; name: string; jumlah: number }[];
  };
  kinerja: {
    diklatSelesai: number;
    diklatBerjalan: number;
    diklatTerjadwal: number;
    pesertaDilatih: number;
    jpPembelajaran: number;
    /** Gabungan peserta aktif PKA/PKP yang selesai tahun ini; null kalau belum ada yang dinilai. */
    kelulusan: (KelulusanRingkasRecord & { persenLulus: number | null }) | null;
  };
  baruSelesai: {
    id: string;
    name: string;
    endDate: string;
    program?: string;
    peserta: number;
    kelulusan: KelulusanRingkasRecord | null;
  }[];
  /** LMS ditampilkan (selalu true sejak gerbang modul dihapus). */
  lms?: boolean;
};

/** Ruang belajar peserta — satu baris "Diklat saya". */
/** Bagian Pembelajaran Mandiri diklat blended (kurikulum LAN). */
export type MandiriRecord = { jp: number; hari?: number; kegiatan: { nama: string; jp: number; dinilai: boolean }[] };

export type DiklatSayaRecord = {
  pesertaId: string;
  nomor: number;
  status: StatusPeserta;
  training: TrainingRecord;
  hari: { ke: number; total: number; status: "belum" | "berjalan" | "selesai" } | null;
  /** % JP hadir dari JP wajib hadir yang sudah dicatat; null = belum ada catatan. */
  kehadiranPersen: number | null;
  tingkatKehadiran: "aman" | "peringatan" | "batas" | null;
  sesiHariIni: { kegiatan: string; jamMulai?: string; bentuk: string; jp: number; tautan?: string }[];
  sesiBerikutnya: { tanggal: string; jamMulai?: string; kegiatan: string; bentuk: string; tautan?: string } | null;
  mandiri: MandiriRecord | null;
  /** Tahap kurikulum yang sedang berjalan (nama pendek), null bila belum mulai/selesai/tanpa kurikulum. */
  tahapKini: string | null;
  /** Pre/post-test yang sedang dibuka dan belum dikerjakan/selesai. */
  tesTerbuka: ("PRE" | "POST")[];
  /** Evaluasi (pengajar & penyelenggaraan) yang sudah bisa diisi tetapi belum. */
  evaluasiTertunda: number;
  /** Tahap kurikulum (label pendek) untuk stepper Beranda; [] bila bukan PKA/PKP. */
  tahap: { label: string; kode: string }[];
  /** Indeks tahap berjalan (-1 belum mulai; = jumlah tahap bila selesai). */
  tahapAktif: number;
  /** Tugas & checklist peserta (beranda-peserta.ts `tugasPeserta`). */
  tugas: { kunci: string; label: string; keterangan: string; status: "selesai" | "perlu" | "nanti" | "terlewat"; href: string | null }[];
};

/** Ruang belajar peserta — halaman satu diklat (GET /api/belajar/[pesertaId]). */
export type RuangBelajarRecord = {
  /** true = dibuka penyelenggara/pimpinan sebagai pratinjau, bukan oleh pesertanya. */
  pratinjau: boolean;
  peserta: { id: string; nomor: number; nama: string; nip?: string; instansi?: string; status: StatusPeserta; judulAksiPerubahan?: string };
  training: TrainingRecord;
  /** Hari ke-berapa dari total hari pelatihan (null kalau belum mulai / tanpa tanggal selesai). */
  hari: { ke: number; total: number; status: "belum" | "berjalan" | "selesai" } | null;
  tahap: {
    nama: string;
    tipe: string;
    kode: string;
    jp: number;
    jpSync?: number;
    jpAsync?: number;
    hari?: number;
    hariKalender?: boolean;
    /** Rincian kegiatan tahap (sama dengan tampilan admin di Rincian diklat). */
    kegiatan?: { nama: string; jp: number; jpSync?: number; jpAsync?: number; dinilai?: boolean }[];
  }[];
  /** Indeks tahap yang sedang berjalan (-1 belum mulai, = jumlah tahap bila selesai). */
  tahapAktif: number;
  mandiri: MandiriRecord | null;
  sesi: {
    id: string;
    tanggal: string;
    jamMulai?: string;
    kegiatan: string;
    jp: number;
    bentuk: string;
    wajibHadir: boolean;
    mataPelatihanNama?: string;
    tautan?: string;
    kehadiran: StatusKehadiran | null;
  }[];
  rekap: RekapKehadiran;
  aturan: AturanKehadiran | null;
  /** Dokumen persyaratan (null bila jadwal tidak mewajibkan). `terkunci` = tes & evaluasi belum bisa dibuka. */
  dokumen: { terkunci: boolean; kurang: number; ditolak: number; menunggu: number; batas: string | null; sisaHari: number | null } | null;
  /** Kelompok peserta per jenis kegiatan (PKA/PKP); kosong bila belum dibagi. */
  kelompok: { kelompokId: string; jenis: string; labelJenis: string; label: string; coachNama: string | null; tautan: string | null; anggota: string[] }[];
  /** Jadwal seminar RAP/LAP peserta ini (repositories/seminar.ts); kosong bila belum disusun penyelenggara. */
  seminar: {
    jenis: "RAP" | "LAP";
    tanggal: string | null;
    jamMulai: string | null;
    urutan: number | null;
    ruang: string | null;
    tautanDaring: string | null;
    pengujiNama: string | null;
    mentorHadir: "LANGSUNG" | "DARING" | null;
    status: "MENUNGGU" | "DIPANGGIL" | "PRESENTASI" | "SELESAI" | "TIDAK_HADIR";
  }[];
};
