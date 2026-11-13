/**
 * "Perlu perhatian" di kartu Update Terbaru Home — logika MURNI (diuji di
 * uji/murni.test.ts). Butir DIHITUNG dari data saat halaman dibuka, bukan
 * disimpan sebagai notifikasi: selalu akurat dan hilang sendiri begitu
 * urusannya selesai (soal disetujui, penugasan diputuskan, tes ditutup).
 *
 * Peran yang dilayani: Widyaiswara dan penyelenggara (admin, Ketua Diklat).
 * Peserta (pita tes/evaluasi di Beranda) dan Kepala Balai ("Perlu tindakan" di
 * Home pimpinan) sudah punya tempatnya sendiri, jadi tidak diulang di sini.
 */
import { tambahHari, formatTanggalId } from "@/lib/sesi";
import { LABEL_JENIS_TES, type JenisTes } from "@/lib/tes";

export type PrioritasPerhatian = "penting" | "segera" | "sedang";
export type ButirPerhatian = {
  kunci: string;
  prioritas: PrioritasPerhatian;
  judul: string;
  rincian: string | null;
  href: string;
};

/** Berapa hari kabar "baru disetujui / ditolak / evaluasi baru" tetap tampil. */
export const HARI_KABAR_BARU = 7;
/** Jadwal mengajar yang ditampilkan: hari ini s.d. sekian hari ke depan. */
export const HARI_JADWAL_DEPAN = 7;
/** Tes terjadwal ditampilkan bila dibuka dalam sekian hari. */
export const HARI_TES_DEPAN = 2;
/** Diklat tanpa WI disetujui ditampilkan bila mulai dalam sekian hari (atau sudah mulai). */
export const HARI_DIKLAT_TANPA_WI = 7;
/** Panjang maksimal kutipan catatan pemeriksa. */
export const KUTIPAN_MAKS = 120;

const URUTAN: Record<PrioritasPerhatian, number> = { penting: 0, segera: 1, sedang: 2 };

/** Urut: prioritas, lalu urutan sisipan (stabil). */
export function urutkanPerhatian(b: ButirPerhatian[]): ButirPerhatian[] {
  return b.map((x, i) => [x, i] as const).sort((a, c) => URUTAN[a[0].prioritas] - URUTAN[c[0].prioritas] || a[1] - c[1]).map(([x]) => x);
}

export function kutip(teks: string, maks = KUTIPAN_MAKS): string {
  const t = teks.replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t;
}

/** "A, B, dan 2 lainnya" */
export function daftarNama(nama: string[], maks = 2): string {
  const unik = [...new Set(nama)];
  if (unik.length <= maks) return unik.join(", ");
  return `${unik.slice(0, maks).join(", ")}, dan ${unik.length - maks} lainnya`;
}

/** Tanggal ISO "YYYY-MM-DD" ≥ batas (batas = hariIni − n hari). */
const sejak = (iso: string | null, hariIni: string, n: number) => !!iso && iso.slice(0, 10) >= tambahHari(hariIni, -n);

// ---------------------------------------------------------------------------
// Widyaiswara
// ---------------------------------------------------------------------------

export type FaktaWi = {
  /** Soal milik WI ini (diinput sendiri). `diperbarui`: ISO tanggal/waktu. */
  soal: { status: string; catatanPeriksa: string | null; diperiksa: boolean; diperbarui: string }[];
  penugasan: { training: string; status: string; diputuskanPada: string | null; catatan: string | null }[];
  /** Sesi mengajar (penugasan disetujui) dari hari ini ke depan, urut tanggal. */
  sesi: { tanggal: string; kegiatan: string; jp: number; training: string }[];
  /** Per jadwal & sasaran: banyaknya responden dan isian terbaru. */
  evaluasi: { training: string; responden: number; terbaru: string }[];
  minResponden: number;
};

export function perhatianWi(f: FaktaWi, hariIni: string): ButirPerhatian[] {
  const out: ButirPerhatian[] = [];
  const BANK = "/dashboard/bank-soal";

  const dikembalikan = f.soal.filter((s) => s.status === "DIKEMBALIKAN");
  if (dikembalikan.length) {
    const catatan = dikembalikan.map((s) => s.catatanPeriksa?.trim()).find(Boolean);
    out.push({
      kunci: "wi-soal-dikembalikan",
      prioritas: "penting",
      judul: `${dikembalikan.length} soal dikembalikan untuk diperbaiki`,
      rincian: catatan ? `Catatan pemeriksa: “${kutip(catatan)}”` : "Buka Bank Soal untuk melihat catatan pemeriksa.",
      href: BANK,
    });
  }

  const sesiDepan = f.sesi.filter((s) => s.tanggal >= hariIni && s.tanggal <= tambahHari(hariIni, HARI_JADWAL_DEPAN));
  if (sesiDepan.length) {
    const s0 = sesiDepan[0];
    const hariIniJuga = s0.tanggal === hariIni;
    const lain = sesiDepan.length - 1;
    out.push({
      kunci: "wi-jadwal",
      prioritas: hariIniJuga ? "penting" : "segera",
      judul: `${hariIniJuga ? "Mengajar hari ini" : `Mengajar ${formatTanggalId(s0.tanggal)}`}${lain > 0 ? ` (+${lain} sesi lagi minggu ini)` : ""}`,
      rincian: `${s0.training} · ${s0.kegiatan} · ${s0.jp} JP`,
      href: "/dashboard/jadwal",
    });
  }

  const disetujuiBaru = f.penugasan.filter((p) => p.status === "disetujui" && sejak(p.diputuskanPada, hariIni, HARI_KABAR_BARU));
  if (disetujuiBaru.length) {
    out.push({
      kunci: "wi-penugasan-disetujui",
      prioritas: "segera",
      judul: disetujuiBaru.length === 1 ? "Penugasan mengajar baru" : `${disetujuiBaru.length} penugasan mengajar baru`,
      rincian: daftarNama(disetujuiBaru.map((p) => p.training)),
      href: "/dashboard/jadwal",
    });
  }

  const ditolakBaru = f.penugasan.filter((p) => p.status === "ditolak" && sejak(p.diputuskanPada, hariIni, HARI_KABAR_BARU));
  if (ditolakBaru.length) {
    const catatan = ditolakBaru.map((p) => p.catatan?.trim()).find(Boolean);
    out.push({
      kunci: "wi-penugasan-ditolak",
      prioritas: "sedang",
      judul: ditolakBaru.length === 1 ? "Penugasan tidak disetujui" : `${ditolakBaru.length} penugasan tidak disetujui`,
      rincian: `${daftarNama(ditolakBaru.map((p) => p.training))}${catatan ? ` — “${kutip(catatan, 80)}”` : ""}`,
      href: "/dashboard/jadwal",
    });
  }

  const menungguPenugasan = f.penugasan.filter((p) => p.status === "menunggu");
  if (menungguPenugasan.length) {
    out.push({
      kunci: "wi-penugasan-menunggu",
      prioritas: "sedang",
      judul: `${menungguPenugasan.length} pengajuan lama belum ditetapkan penyelenggara`,
      rincian: daftarNama(menungguPenugasan.map((p) => p.training)),
      href: "/dashboard/jadwal",
    });
  }

  const disetujuiSoal = f.soal.filter((s) => s.status === "SIAP" && s.diperiksa && sejak(s.diperbarui, hariIni, HARI_KABAR_BARU));
  if (disetujuiSoal.length) {
    out.push({
      kunci: "wi-soal-disetujui",
      prioritas: "sedang",
      judul: `${disetujuiSoal.length} soal Anda disetujui`,
      rincian: "Sudah siap dipakai di paket pre-test/post-test.",
      href: BANK,
    });
  }

  const menungguSoal = f.soal.filter((s) => s.status === "DIAJUKAN").length;
  if (menungguSoal) {
    out.push({
      kunci: "wi-soal-menunggu",
      prioritas: "sedang",
      judul: `${menungguSoal} soal menunggu diperiksa`,
      rincian: "Diperiksa admin/Ketua Diklat sebelum bisa dipakai.",
      href: BANK,
    });
  }

  // Rahasia: hanya kabar bahwa rekap TERSEDIA (≥ minimal responden), tanpa angka/nama.
  const evaluasiBaru = f.evaluasi.filter((e) => e.responden >= f.minResponden && sejak(e.terbaru, hariIni, HARI_KABAR_BARU));
  if (evaluasiBaru.length) {
    out.push({
      kunci: "wi-evaluasi",
      prioritas: "sedang",
      judul: "Hasil evaluasi peserta tersedia",
      rincian: daftarNama(evaluasiBaru.map((e) => e.training)),
      href: "/dashboard/evaluasi-saya",
    });
  }

  return urutkanPerhatian(out);
}

// ---------------------------------------------------------------------------
// Penyelenggara (admin, Ketua Diklat)
// ---------------------------------------------------------------------------

export type FaktaPenyelenggara = {
  /** Program soal berstatus DIAJUKAN (satu entri per soal). */
  soalMenunggu: string[];
  penugasanMenunggu: number;
  /** Diklat belum selesai, belum ada WI disetujui. `startDate`: "YYYY-MM-DD". */
  diklatTanpaWi: { id: string; name: string; startDate: string }[];
  /** Tes TERBIT. `status` dari statusTes(); `buka`/`tutup`: "YYYY-MM-DD" (WIB) atau null. */
  tes: { trainingId: string; training: string; jenis: JenisTes; status: string; buka: string | null; tutup: string | null }[];
  /** Diklat selesai yang punya isian evaluasi (pengajar/penyelenggaraan) tetapi evaluasinya belum ditutup. */
  evaluasiBelumDitutup: { id: string; name: string }[];
  /** Registrasi mandiri peserta yang menunggu persetujuan (/registrasi). */
  registrasiMenunggu: number;
  /** Diklat berjalan dengan masalah presensi harian sebelum hari ini: `hari` = hari bersesi yang
   *  catatannya belum lengkap; `tanpaSesi` = hari kerja tanpa sesi di luar masa di tempat kerja. */
  presensiBelumLengkap: { id: string; name: string; hari: number; tanpaSesi: number }[];
};

export function perhatianPenyelenggara(f: FaktaPenyelenggara, hariIni: string): ButirPerhatian[] {
  const out: ButirPerhatian[] = [];

  const tanpaWi = f.diklatTanpaWi.filter((d) => d.startDate <= tambahHari(hariIni, HARI_DIKLAT_TANPA_WI));
  if (tanpaWi.length) {
    const mulai = tanpaWi.filter((d) => d.startDate <= hariIni).length;
    out.push({
      kunci: "pny-tanpa-wi",
      prioritas: "penting",
      judul: `${tanpaWi.length} diklat ${mulai === tanpaWi.length ? "sudah berjalan" : "segera mulai"} tanpa pengampu`,
      rincian: daftarNama(tanpaWi.map((d) => d.name)),
      href: tanpaWi.length === 1 ? `/dashboard/diklat/${tanpaWi[0].id}` : "/dashboard/jadwal",
    });
  }

  if (f.registrasiMenunggu) {
    out.push({
      kunci: "pny-registrasi",
      prioritas: "segera",
      judul: `${f.registrasiMenunggu} registrasi peserta menunggu persetujuan`,
      rincian: "Periksa NIP dan instansi sebelum menyetujui.",
      href: "/dashboard/registrasi",
    });
  }

  if (f.soalMenunggu.length) {
    const per = new Map<string, number>();
    for (const p of f.soalMenunggu) per.set(p, (per.get(p) ?? 0) + 1);
    out.push({
      kunci: "pny-soal-menunggu",
      prioritas: "segera",
      judul: `${f.soalMenunggu.length} soal dari WI menunggu diperiksa`,
      rincian: [...per].sort((a, b) => a[0].localeCompare(b[0])).map(([p, n]) => `${p} ${n}`).join(" · "),
      href: "/dashboard/bank-soal",
    });
  }

  for (const t of f.tes) {
    const label = `${LABEL_JENIS_TES[t.jenis]} ${t.training}`;
    if (t.status === "DIBUKA") {
      out.push({
        kunci: `pny-tes-${t.trainingId}-${t.jenis}`,
        prioritas: "sedang",
        judul: `${label} sedang dibuka`,
        rincian: t.tutup ? `Ditutup ${formatTanggalId(t.tutup)} — pantau yang belum mengerjakan.` : "Belum ada waktu tutup — tutup manual setelah selesai.",
        href: `/dashboard/diklat/${encodeURIComponent(t.trainingId)}/tes`,
      });
    } else if (t.status === "TERJADWAL" && t.buka && t.buka <= tambahHari(hariIni, HARI_TES_DEPAN)) {
      out.push({
        kunci: `pny-tes-${t.trainingId}-${t.jenis}`,
        prioritas: "sedang",
        judul: `${label} dibuka ${t.buka === hariIni ? "hari ini" : formatTanggalId(t.buka)}`,
        rincian: "Pastikan peserta sudah punya akun.",
        href: `/dashboard/diklat/${encodeURIComponent(t.trainingId)}/tes`,
      });
    }
  }

  if (f.penugasanMenunggu) {
    out.push({
      kunci: "pny-penugasan-menunggu",
      prioritas: "sedang",
      judul: `${f.penugasanMenunggu} pengajuan WI lama belum ditetapkan atau dihapus`,
      rincian: null,
      href: "/dashboard/jadwal",
    });
  }

  for (const d of f.presensiBelumLengkap) {
    out.push({
      kunci: `pny-presensi-${d.id}`,
      prioritas: "sedang",
      judul: `Presensi belum lengkap: ${d.name}`,
      rincian: [
        d.hari ? `${d.hari} hari masih ada sesi yang presensinya belum dicatat` : "",
        d.tanpaSesi ? `${d.tanpaSesi} hari kerja belum punya sesi` : "",
      ]
        .filter(Boolean)
        .join(" · ") + ".",
      href: `/dashboard/diklat/${encodeURIComponent(d.id)}/absensi`,
    });
  }

  for (const d of f.evaluasiBelumDitutup) {
    out.push({
      kunci: `pny-evaluasi-${d.id}`,
      prioritas: "sedang",
      judul: `Evaluasi peserta belum ditutup: ${d.name}`,
      rincian: "Diklat sudah selesai — tutup agar rekap evaluasi final.",
      href: `/dashboard/diklat/${encodeURIComponent(d.id)}/evaluasi`,
    });
  }

  return urutkanPerhatian(out);
}

// ---------------------------------------------------------------------------
// Semua pegawai — persuratan & cuti (20 Okt 2026: Beranda = tempat kerja semua pegawai)
// ---------------------------------------------------------------------------

export type FaktaPegawai = {
  /** Disposisi untuk saya yang belum dibaca. */
  disposisiBaru: { hal: string }[];
  /** Cuti saya yang diputuskan dalam HARI_KABAR_BARU hari terakhir. `diputuskanPada`: "YYYY-MM-DD". */
  cutiSayaDiputuskan: { label: string; status: string; diputuskanPada: string; alasanTolak: string | null }[];
  /** Surat tugas BERNOMOR untuk saya dengan tanggal tugas hari ini s.d. HARI_JADWAL_DEPAN hari. */
  suratTugasSaya: { hal: string; tanggal: string }[];
  /** Pemutus cuti: pengajuan cuti pegawai lain yang menunggu keputusan. */
  cutiMenunggu: number | null;
  /** Pemberi disposisi: surat masuk belum selesai dan belum didisposisikan. */
  suratMasukBelumDisposisi: number | null;
  /** Penomor (TU): cuti disetujui yang suratnya belum bernomor. */
  cutiBelumBernomor: number | null;
};

export function perhatianPegawai(f: FaktaPegawai, hariIni: string): ButirPerhatian[] {
  const out: ButirPerhatian[] = [];
  if (f.disposisiBaru.length) {
    out.push({
      kunci: "pgw-disposisi",
      prioritas: "penting",
      judul: `${f.disposisiBaru.length} disposisi baru untuk Anda`,
      rincian: daftarNama(f.disposisiBaru.map((d) => kutip(d.hal, 60))),
      href: "/dashboard/persuratan/disposisi",
    });
  }
  if (f.cutiMenunggu) {
    out.push({
      kunci: "pgw-cuti-menunggu",
      prioritas: "segera",
      judul: `${f.cutiMenunggu} pengajuan cuti menunggu keputusan`,
      rincian: null,
      href: "/dashboard/cuti",
    });
  }
  if (f.suratMasukBelumDisposisi) {
    out.push({
      kunci: "pgw-surat-masuk",
      prioritas: "segera",
      judul: `${f.suratMasukBelumDisposisi} surat masuk belum didisposisikan`,
      rincian: null,
      href: "/dashboard/persuratan/surat-masuk",
    });
  }
  if (f.cutiBelumBernomor) {
    out.push({
      kunci: "pgw-cuti-nomor",
      prioritas: "sedang",
      judul: `${f.cutiBelumBernomor} surat cuti disetujui belum diberi nomor`,
      rincian: null,
      href: "/dashboard/cuti",
    });
  }
  for (const s of f.suratTugasSaya) {
    out.push({
      kunci: `pgw-st-${s.tanggal}-${s.hal}`,
      prioritas: "sedang",
      judul: `Surat tugas ${s.tanggal === hariIni ? "hari ini" : formatTanggalId(s.tanggal)}`,
      rincian: kutip(s.hal),
      href: "/dashboard/surat-tugas-saya",
    });
  }
  for (const c of f.cutiSayaDiputuskan.filter((x) => sejak(x.diputuskanPada, hariIni, HARI_KABAR_BARU))) {
    out.push({
      kunci: `pgw-cuti-${c.diputuskanPada}-${c.label}`,
      prioritas: c.status === "DITOLAK" ? "segera" : "sedang",
      judul: `${c.label} Anda ${c.status === "DISETUJUI" ? "disetujui" : "ditolak"}`,
      rincian: c.status === "DITOLAK" && c.alasanTolak ? kutip(c.alasanTolak) : null,
      href: "/dashboard/cuti",
    });
  }
  return urutkanPerhatian(out);
}

// ---------------------------------------------------------------------------
// Ruang Coaching (23 Okt 2026) — coach: pertanyaan belum terjawab; peserta: tulisan baru & video pengantar
// ---------------------------------------------------------------------------

export type FaktaCoaching = {
  /** Kelompok yang dibimbing akun ini (coach), diklat belum selesai: pertanyaan belum terjawab. */
  belumTerjawab: { kelompokId: string; label: string; training: string; jumlah: number }[];
  /** Kelompok tempat akun ini menjadi peserta (diklat belum selesai) yang punya hal baru. */
  peserta: { kelompokId: string; label: string; belumDibaca: number; pengantarBelumDitonton: number }[];
};

export function perhatianCoaching(f: FaktaCoaching): ButirPerhatian[] {
  const out: ButirPerhatian[] = [];
  const ruang = (id: string, tab = "") => `/dashboard/coaching/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`;
  for (const k of f.belumTerjawab) {
    out.push({
      kunci: `coach-tanya-${k.kelompokId}`,
      prioritas: "segera",
      judul: `${k.jumlah} pertanyaan belum terjawab di forum coaching`,
      rincian: `${k.label} · ${k.training}`,
      href: ruang(k.kelompokId, "forum"),
    });
  }
  for (const k of f.peserta) {
    if (k.pengantarBelumDitonton) {
      out.push({
        kunci: `coaching-pengantar-${k.kelompokId}`,
        prioritas: "segera",
        judul: `Tonton ${k.pengantarBelumDitonton} video pengantar dari coach`,
        rincian: k.label,
        href: ruang(k.kelompokId),
      });
    }
    if (k.belumDibaca) {
      out.push({
        kunci: `coaching-forum-${k.kelompokId}`,
        prioritas: "sedang",
        judul: `${k.belumDibaca} tulisan baru di forum coaching`,
        rincian: k.label,
        href: ruang(k.kelompokId, "forum"),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seminar RAP/LAP (23 Okt 2026) — penguji: jadwal menguji dalam beberapa hari ke depan
// ---------------------------------------------------------------------------

export type FaktaSeminar = {
  menguji: { trainingId: string; training: string; jenis: "RAP" | "LAP"; tanggal: string; jumlah: number }[];
};

export function perhatianSeminar(f: FaktaSeminar, hariIni: string): ButirPerhatian[] {
  return f.menguji.map((m) => ({
    kunci: `seminar-uji-${m.trainingId}-${m.jenis}-${m.tanggal}`,
    prioritas: m.tanggal === hariIni ? "penting" : "segera",
    judul: `${m.tanggal === hariIni ? "Hari ini: menguji" : "Menguji"} ${m.jumlah} peserta Seminar ${m.jenis}`,
    rincian: `${m.training} · ${formatTanggalId(m.tanggal)}`,
    href: `/dashboard/diklat/${encodeURIComponent(m.trainingId)}/seminar?jenis=${m.jenis}`,
  }));
}
