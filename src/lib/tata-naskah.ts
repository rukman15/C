/**
 * Tata naskah dinas — Permendagri 18/2024 tentang Tata Naskah Dinas di Lingkungan Kemendagri
 * (berlaku 7 Nov 2024). Dipakai semua surat keluaran aplikasi (surat tugas, surat keterangan).
 * Keputusan 18 Okt 2026: ikut Permendagri, bukan contoh kantor (lihat CATATAN-SURAT-MENYURAT.md).
 * Logika MURNI — diuji di uji/murni.test.ts.
 */
import { nipBerspasi, tanggalPanjang } from "@/lib/dokumen";

/** Ps. 21 ayat 2 (HVS A4 ≥ 70 g/m²), Ps. 24 ayat 1 (Arial 12), Ps. 25 ayat 2 (ruang tepi). Satuan cm. */
const KERTAS = { nama: "A4", lebar: 21, tinggi: 29.7 } as const;
/** Surat tugas (mengajar & umum) dicetak di kertas F4 — keputusan pemilik 28 Okt 2026; naskah lain tetap A4. Tepi sama. */
export const KERTAS_SURAT_TUGAS = { nama: "F4", lebar: 21.5, tinggi: 33 } as const;
/** Aturan tepi atas: "2 spasi di bawah kop" — kop mulai di tepi atas ini, lalu 2 baris kosong. */
const TEPI = { atas: 1.5, kanan: 2, bawah: 2.5, kiri: 3 } as const;
export const NASKAH = {
  kertas: KERTAS,
  huruf: { nama: "Arial", ukuran: 12 },
  tepi: TEPI,
  /** Lebar bidang isi (cm). */
  lebarIsi: KERTAS.lebar - TEPI.kiri - TEPI.kanan,
} as const;

/** Baris antara "Dasar" dan "Kepada" pada surat tugas (Lampiran B.2). */
export const KATA_PERINTAH = "MEMERINTAHKAN:";

/** "NOMOR 800.1.11.1/…/BBPKA-PDN II" — tanpa titik dua seperti contoh Lampiran; kosong → titik-titik. */
export function barisNomor(nomor: string | null | undefined): string {
  return `NOMOR ${nomor?.trim() || "…………………"}`;
}

/** "Sumedang, 18 Oktober 2026" — "Tempat, Tanggal, Bulan, dan Tahun". */
export function tempatTanggal(tempat: string, iso: string): string {
  return `${tempat.trim() || "Sumedang"}, ${tanggalPanjang(iso)}`;
}

export type Penandatangan = {
  /** Baris nama jabatan; baris terakhir diakhiri koma. */
  jabatan: string[];
  nama: string;
  /** "Pembina Tingkat I (IV/b)"; kosong/"-" bila tidak ada. */
  pangkat: string;
  nip: string;
};

/**
 * Blok tanda tangan pejabat selain Menteri/Wamen/Eselon I (Ps. 35 ayat 2): nama jabatan, nama
 * bergelar, pangkat (golongan), NIP. `atas` = baris sebelum ruang tanda tangan, `bawah` = sesudahnya.
 * Nama/NIP kosong → titik-titik agar konsep tetap bisa dicetak.
 */
export function blokPenandatangan(t: Penandatangan): { atas: string[]; bawah: string[] } {
  const jabatan = t.jabatan.map((b) => b.trim()).filter(Boolean);
  if (jabatan.length) {
    const i = jabatan.length - 1;
    if (!jabatan[i].endsWith(",")) jabatan[i] += ",";
  }
  const pangkat = t.pangkat.trim();
  return {
    atas: jabatan,
    bawah: [
      t.nama.trim() || "(……………………………)",
      ...(pangkat && pangkat !== "-" ? [pangkat] : []),
      `NIP ${t.nip.trim() ? nipBerspasi(t.nip) : "……………………"}`,
    ],
  };
}

/**
 * Penerima surat tugas: sampai batas ini ditulis bernomor di badan surat (contoh Lampiran B.2);
 * lebih dari itu "Daftar nama terlampir" + lampiran tabel (Ps. 28: lampiran ditandatangani pejabat
 * yang sama; halaman lampiran berikutnya bernomor angka Arab). Keputusan 18 Okt 2026.
 */
export const PENERIMA_MAKS_BADAN = 5;
export const TEKS_DAFTAR_TERLAMPIR = "Daftar nama terlampir";
export const pakaiLampiran = (jumlahPenerima: number) => jumlahPenerima > PENERIMA_MAKS_BADAN;

/** Kepala halaman lampiran surat tugas. */
export function kepalaLampiran(nomor: string | null | undefined, iso: string): string[] {
  return ["LAMPIRAN", "SURAT TUGAS", barisNomor(nomor), `TANGGAL ${tanggalPanjang(iso).toUpperCase()}`];
}

/** Kolom tabel lampiran daftar nama. */
export const KOLOM_LAMPIRAN = ["No.", "Nama", "Pangkat/Gol.", "NIP", "Jabatan"] as const;

/** Label isian penerima surat tugas sesuai Lampiran B.2. */
export const LABEL_PENERIMA = ["Nama", "Pangkat/Gol.", "NIP", "Jabatan"] as const;

/**
 * Nama dari Data Pegawai (bagian nama sering kapital semua, mis. "Dr. TIYAR CAHYA KUSUMA, S.AP., M.Si.")
 * dirapikan untuk naskah dinas: contoh Permendagri 18/2024 menulis "Nama Lengkap dan Gelar" berhuruf
 * awal kapital. Hanya bagian SEBELUM koma pertama yang diubah (gelar belakang dibiarkan, termasuk yang
 * tanpa titik seperti "SH"); kata bertitik ("Dr.", "H.") dan kata yang sudah campuran dibiarkan.
 */
export function rapikanNamaSurat(nama: string): string {
  const t = nama.trim();
  const koma = t.indexOf(",");
  const depan = koma < 0 ? t : t.slice(0, koma);
  const belakang = koma < 0 ? "" : t.slice(koma);
  const potongan = depan.split(/(\s+)/);
  // Sudah ditulis campuran (mis. "Kabag TU") -> biarkan utuh: hanya nama yang kapital semua yang dirapikan.
  const kataNama = potongan.filter((w) => w.trim() && !w.includes("."));
  if (!kataNama.length || kataNama.some((w) => w !== w.toUpperCase())) return t;
  const kata = potongan.map((w) =>
    w.includes(".") || !/\p{L}/u.test(w)
      ? w
      : // Huruf awal tiap bagian bertanda hubung kapital ("Nur-Aini"); setelah apostrof kecil ("Ma'ruf").
        w.toLowerCase().replace(/(^|-)(\p{L})/gu, (_, a: string, h: string) => a + h.toUpperCase()),
  );
  return kata.join("") + belakang;
}


// Kata sambung yang ditulis kecil di tengah nama jabatan.
const KATA_SAMBUNG = new Set(["dan", "atau", "serta", "dalam", "di", "ke", "dari", "pada", "untuk", "yang", "bagi", "oleh", "terhadap", "dengan"]);
// Singkatan yang tetap kapital.
const SINGKATAN_JABATAN = new Set(["TU", "SDM", "ASN", "PNS", "PPPK", "UPT", "TI", "IT", "LAN", "BPSDM", "BBPKA", "PDN", "APDN", "DIPA", "SPD", "PPK", "JF", "JFT", "JFU", "BMN", "ULP", "RI", "KDH"]);
const ROMAWI = /^(?:X{0,3})(?:IX|IV|V?I{0,3})$/;

/**
 * Jabatan dari Data Pegawai (kapital semua, mis. "WIDYAISWARA AHLI UTAMA") untuk naskah dinas:
 * huruf awal kapital, kata sambung kecil ("dan", "dalam" …, kecuali di awal), singkatan & angka
 * Romawi tetap kapital, "Dalam Negeri" tetap (nama resmi). Jabatan yang sudah campuran dibiarkan.
 */
export function rapikanJabatanSurat(jabatan: string): string {
  const t = jabatan.trim().replace(/\s+/g, " ");
  if (!t || t !== t.toUpperCase() || !/\p{L}/u.test(t)) return t;
  const kata = t.split(" ");
  return kata
    .map((w, i) => {
      if (w.includes(".")) return w;
      return w
        .split("-")
        .map((bagian) => {
          if (!bagian) return bagian;
          if (SINGKATAN_JABATAN.has(bagian) || (bagian.length > 0 && ROMAWI.test(bagian))) return bagian;
          const kecil = bagian.toLowerCase();
          const dalamNegeri = kecil === "dalam" && kata[i + 1] === "NEGERI";
          if (i > 0 && KATA_SAMBUNG.has(kecil) && !dalamNegeri) return kecil;
          return kecil.charAt(0).toUpperCase() + kecil.slice(1);
        })
        .join("-");
    })
    .join(" ");
}

// ------------------------------------------------------------------ KEWENANGAN PENANDATANGANAN

/**
 * Kewenangan penandatanganan per jenis naskah (Permendagri 18/2024 Lampiran VIII, tabel kewenangan,
 * baris Kepala Balai dan Kepala Bagian/administrator). Kepala Balai berwenang atas semua jenis di
 * aplikasi. `anKabag`: Kabag TU boleh menandatangani "a.n. Kepala Balai"; `kabag`: Kabag TU
 * menandatangani atas jabatannya sendiri. u.b. tidak dipakai di balai (tidak ada Kasubbag berwenang
 * untuk jenis-jenis ini). `wajib`: pilihan ditegakkan di server (bukan isian bebas).
 */
export const KEWENANGAN_TTD: Record<string, { anKabag: boolean; kabag: boolean; wajib: boolean }> = {
  SURAT_TUGAS: { anKabag: true, kabag: false, wajib: true },
  NOTA_DINAS: { anKabag: true, kabag: true, wajib: false },
  SURAT_DINAS: { anKabag: false, kabag: false, wajib: false },
  UNDANGAN: { anKabag: true, kabag: false, wajib: false },
  PANGGILAN_PESERTA: { anKabag: true, kabag: false, wajib: false },
  PERMOHONAN_PENGAJAR: { anKabag: false, kabag: false, wajib: false },
  PENGAJUAN_LAN: { anKabag: false, kabag: false, wajib: false },
  BERITA_ACARA: { anKabag: false, kabag: false, wajib: false },
  LAPORAN: { anKabag: true, kabag: true, wajib: false },
};

export type PejabatTtd = { nama: string; nip: string };
/** Pejabat yang menjabat sementara (Plt./Plh.) pada tanggal surat. */
export type PejabatSementara = PejabatTtd & { jenis: "PLT" | "PLH" };

export type PilihanTtd = {
  kode: "KEPALA" | "SEMENTARA_KEPALA" | "AN_KABAG" | "AN_SEMENTARA_KABAG" | "KABAG" | "SEMENTARA_KABAG";
  label: string;
  jabatan: string[];
  nama: string;
  nip: string;
};

const JABATAN_KABAG = "Kepala Bagian Tata Usaha";
const singkatSementara = (j: "PLT" | "PLH") => (j === "PLT" ? "Plt." : "Plh.");

/**
 * Pilihan penanda tangan yang sah untuk satu jenis naskah pada tanggal surat. `jabatanKepala` = baris
 * jabatan Kepala Balai (baris terakhir berkoma). Plt./Plh. Kepala Balai menandatangani atas jabatan
 * itu (tanpa a.n.); Plt. berwenang sama dengan definitif, Plh. untuk urusan rutin (Lampiran VIII f).
 */
export function pilihanPenandatangan(
  jenis: string,
  jabatanKepala: string[],
  p: { kepala: PejabatTtd | null; sementaraKepala: PejabatSementara[]; kabag: PejabatTtd | null; sementaraKabag: PejabatSementara[] },
): PilihanTtd[] {
  const k = KEWENANGAN_TTD[jenis] ?? { anKabag: false, kabag: false, wajib: false };
  const kepalaBaris = jabatanKepala.map((b) => b.trim()).filter(Boolean);
  const kepalaTanpaKoma = kepalaBaris.map((b, i) => (i === kepalaBaris.length - 1 ? b.replace(/,$/, "") : b));
  const atasNama = [`a.n. ${kepalaTanpaKoma[0]}`, ...kepalaTanpaKoma.slice(1)];
  atasNama[atasNama.length - 1] += ",";
  const out: PilihanTtd[] = [];
  if (p.kepala) out.push({ kode: "KEPALA", label: "Kepala Balai", jabatan: kepalaBaris, ...p.kepala });
  for (const s of p.sementaraKepala) {
    const sk = singkatSementara(s.jenis);
    out.push({ kode: "SEMENTARA_KEPALA", label: `${sk} Kepala Balai`, jabatan: [`${sk} ${kepalaBaris[0]}`, ...kepalaBaris.slice(1)], nama: s.nama, nip: s.nip });
  }
  if (k.anKabag) {
    if (p.kabag) out.push({ kode: "AN_KABAG", label: "a.n. Kepala Balai — Kabag TU", jabatan: [...atasNama, `${JABATAN_KABAG},`], ...p.kabag });
    for (const s of p.sementaraKabag) {
      const sk = singkatSementara(s.jenis);
      out.push({ kode: "AN_SEMENTARA_KABAG", label: `a.n. Kepala Balai — ${sk} Kabag TU`, jabatan: [...atasNama, `${sk} ${JABATAN_KABAG},`], nama: s.nama, nip: s.nip });
    }
  }
  if (k.kabag) {
    if (p.kabag) out.push({ kode: "KABAG", label: "Kabag TU", jabatan: [`${JABATAN_KABAG},`], ...p.kabag });
    for (const s of p.sementaraKabag) {
      const sk = singkatSementara(s.jenis);
      out.push({ kode: "SEMENTARA_KABAG", label: `${sk} Kabag TU`, jabatan: [`${sk} ${JABATAN_KABAG},`], nama: s.nama, nip: s.nip });
    }
  }
  return out;
}

/** Penanda tangan isian cocok dengan salah satu pilihan sah (jabatan sama persis; NIP sama, atau nama bila NIP pilihan kosong). */
export function cocokPilihanTtd(pilihan: PilihanTtd[], t: { jabatan: string[]; nama: string; nip: string }): boolean {
  const rapi = (a: string[]) => a.map((b) => b.trim()).filter(Boolean).join("\n").replace(/,$/, "");
  const nip = t.nip.replace(/\s+/g, "");
  return pilihan.some(
    (o) => rapi(o.jabatan) === rapi(t.jabatan) && (o.nip ? o.nip.replace(/\s+/g, "") === nip : o.nama.trim().toLowerCase() === t.nama.trim().toLowerCase()),
  );
}
