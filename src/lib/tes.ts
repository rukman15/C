/**
 * Pre-test & post-test peserta PKA/PKP — logika murni (diuji di uji/murni.test.ts).
 *
 * Bukan bagian KepKa LAN 1 & 2/2023 (kebutuhan pimpinan balai), jadi hasilnya
 * dipakai untuk EVALUASI PROGRAM (kenaikan pengetahuan), tidak masuk Formulir 14.
 *
 *  - Pre-test: dilaksanakan sebelum pembukaan pelatihan (ketetapan 23 Okt 2026).
 *  - Post-test: dilaksanakan sebelum penutupan pelatihan (ketetapan 23 Okt 2026).
 *  - Hasil pre/post tidak masuk penilaian (Formulir 14).
 *  - Soal pilihan ganda dari BANK SOAL per program (PKA/PKP), kisi-kisi Agenda I–IV.
 *    Pre dan post sebaiknya memakai PAKET yang sama supaya kenaikan bisa dibandingkan.
 */

export const JENIS_TES = ["PRE", "POST"] as const;
export type JenisTes = (typeof JENIS_TES)[number];
export const LABEL_JENIS_TES: Record<JenisTes, string> = { PRE: "Pre-test", POST: "Post-test" };
export const isJenisTes = (v: unknown): v is JenisTes => typeof v === "string" && (JENIS_TES as readonly string[]).includes(v);

/** Program yang punya bank soal. */
export const PROGRAM_TES = ["PKA", "PKP"] as const;
export type ProgramTes = (typeof PROGRAM_TES)[number];
export const isProgramTes = (v: unknown): v is ProgramTes => typeof v === "string" && (PROGRAM_TES as readonly string[]).includes(v);

/**
 * Status soal di bank:
 *   DIAJUKAN     — dibuat Widyaiswara, menunggu diperiksa (belum bisa masuk paket);
 *   SIAP         — boleh dipakai (soal dari admin/Ketua Diklat langsung SIAP);
 *   DIKEMBALIKAN — perlu diperbaiki penyusunnya (ada catatan pemeriksa);
 *   NONAKTIF     — tidak dipakai lagi (soal yang sudah pernah dikerjakan tidak dihapus, tetapi dinonaktifkan).
 */
export const STATUS_SOAL = ["DIAJUKAN", "SIAP", "DIKEMBALIKAN", "NONAKTIF"] as const;
export type StatusSoal = (typeof STATUS_SOAL)[number];
export const LABEL_STATUS_SOAL: Record<StatusSoal, string> = {
  DIAJUKAN: "Menunggu diperiksa",
  SIAP: "Siap dipakai",
  DIKEMBALIKAN: "Dikembalikan",
  NONAKTIF: "Nonaktif",
};
export const isStatusSoal = (v: unknown): v is StatusSoal => typeof v === "string" && (STATUS_SOAL as readonly string[]).includes(v);

/** Kisi-kisi: Agenda I–IV, mata pelatihan dasar, atau umum. */
export const KISI = ["I", "II", "III", "IV", "DASAR", "UMUM"] as const;
export type Kisi = (typeof KISI)[number];
export const isKisi = (v: unknown): v is Kisi => typeof v === "string" && (KISI as readonly string[]).includes(v);

export const OPSI_MIN = 2;
export const OPSI_MAKS = 5;
export const PERTANYAAN_MAKS = 2000;
export const OPSI_TEKS_MAKS = 500;
export const PEMBAHASAN_MAKS = 1000;
export const SOAL_MAKS_PER_IMPOR = 300;
export const JUMLAH_SOAL_MAKS = 100;
export const DURASI_MIN = 5;
export const DURASI_MAKS = 180;
export const DURASI_BAWAAN = 30;
/** Kelonggaran kirim jawaban setelah batas waktu (jaringan lambat). */
export const TENGGANG_DETIK = 30;

const HURUF = ["A", "B", "C", "D", "E"];
export const hurufOpsi = (i: number) => HURUF[i] ?? String(i + 1);

/** "I", "1", "Agenda I", "agenda 2", "dasar", "umum", "" -> kisi; teks lain -> undefined. */
export function bacaKisi(teks: string | null | undefined): Kisi | undefined {
  const t = (teks ?? "").trim().toUpperCase().replace(/^AGENDA\s*/, "");
  if (t === "" || t === "UMUM" || t === "-") return "UMUM";
  if (t === "DASAR" || t.startsWith("MP DASAR") || t.startsWith("MATA PELATIHAN DASAR")) return "DASAR";
  const angka: Record<string, Kisi> = { "1": "I", "2": "II", "3": "III", "4": "IV", I: "I", II: "II", III: "III", IV: "IV" };
  return angka[t.replace(/[.:].*$/, "").trim()];
}

/** Label kisi untuk tampilan, dengan nama agenda bila diberikan. */
export function labelKisi(kisi: string, namaAgenda?: string[]): string {
  const i = ["I", "II", "III", "IV"].indexOf(kisi);
  if (i >= 0) return namaAgenda?.[i] ? `Agenda ${kisi}: ${namaAgenda[i]}` : `Agenda ${kisi}`;
  return kisi === "DASAR" ? "Mata pelatihan dasar" : "Umum";
}

/** "A".."E" atau "1".."5" -> indeks opsi (0-based) yang ada; selain itu undefined. */
export function bacaKunci(teks: string | null | undefined, jumlahOpsi: number): number | undefined {
  const t = (teks ?? "").trim().toUpperCase().replace(/[.)]$/, "");
  let i = HURUF.indexOf(t);
  if (i < 0 && /^[1-5]$/.test(t)) i = Number(t) - 1;
  return i >= 0 && i < jumlahOpsi ? i : undefined;
}

export const normalTeks = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export type SoalInput = { kisi: Kisi; pertanyaan: string; opsi: string[]; kunci: number; pembahasan?: string | null };

/** Periksa satu soal; null = sah, selain itu pesan untuk pengguna. */
export function periksaSoal(s: { pertanyaan: string; opsi: string[]; kunci: number; pembahasan?: string | null }): string | null {
  const p = s.pertanyaan.trim();
  if (!p) return "Pertanyaan kosong";
  if (p.length > PERTANYAAN_MAKS) return `Pertanyaan terlalu panjang (maks ${PERTANYAAN_MAKS} karakter)`;
  if (s.opsi.length < OPSI_MIN) return `Minimal ${OPSI_MIN} pilihan jawaban`;
  if (s.opsi.length > OPSI_MAKS) return `Maksimal ${OPSI_MAKS} pilihan jawaban (A–E)`;
  if (s.opsi.some((o) => !o.trim())) return "Ada pilihan jawaban yang kosong";
  if (s.opsi.some((o) => o.length > OPSI_TEKS_MAKS)) return `Pilihan jawaban terlalu panjang (maks ${OPSI_TEKS_MAKS} karakter)`;
  if (new Set(s.opsi.map(normalTeks)).size !== s.opsi.length) return "Ada pilihan jawaban yang sama persis";
  if (!Number.isInteger(s.kunci) || s.kunci < 0 || s.kunci >= s.opsi.length) return "Kunci jawaban tidak sesuai pilihan yang ada";
  if ((s.pembahasan ?? "").length > PEMBAHASAN_MAKS) return `Pembahasan terlalu panjang (maks ${PEMBAHASAN_MAKS} karakter)`;
  return null;
}

/**
 * Pecah teks tempelan menjadi baris & kolom. Pemisah kolom Tab (salinan Excel);
 * kalau tidak ada Tab sama sekali, "|". Sel ber-tanda kutip (Excel membungkus sel
 * yang berisi Enter/Tab dengan "...") boleh memuat baris baru; "" = satu tanda kutip.
 */
export function pecahTabel(teks: string): { nomor: number; kol: string[] }[] {
  const t = teks.replace(/\r\n?/g, "\n");
  const pemisah = t.includes("\t") ? "\t" : "|";
  const hasil: { nomor: number; kol: string[] }[] = [];
  let kol: string[] = [];
  let sel = "";
  let baris = 1;
  let mulaiBaris = 1;
  let i = 0;
  let awalSel = true;
  const tutupBaris = () => {
    kol.push(sel);
    if (kol.some((c) => c.trim())) hasil.push({ nomor: mulaiBaris, kol: kol.map((c) => c.trim()) });
    kol = [];
    sel = "";
    awalSel = true;
    mulaiBaris = baris;
  };
  while (i < t.length) {
    const c = t[i];
    if (awalSel && c === '"' && pemisah === "\t") {
      // sel berkutip
      i++;
      while (i < t.length) {
        if (t[i] === '"') {
          if (t[i + 1] === '"') {
            sel += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        if (t[i] === "\n") baris++;
        sel += t[i++];
      }
      awalSel = false;
      continue;
    }
    if (c === pemisah) {
      kol.push(sel);
      sel = "";
      awalSel = true;
    } else if (c === "\n") {
      baris++;
      tutupBaris();
    } else {
      sel += c;
      awalSel = false;
    }
    i++;
  }
  if (sel || kol.length) tutupBaris();
  return hasil;
}

/** Baris judul: ada kolom "Pertanyaan"/"Soal" DAN kolom "Kunci". */
const adalahJudul = (kol: string[]) => kol.some((c) => /^(pertanyaan|soal)$/i.test(c)) && kol.some((c) => /^kunci(\s*jawaban)?$/i.test(c));

export type GalatBaris = { nomor: number; teks: string; alasan: string };

/**
 * Baca soal dari tempelan Excel. Kolom:
 *   Agenda | Pertanyaan | A | B | [C] | [D] | [E] | Kunci | [Pembahasan]
 * Kunci = sel pertama sesudah minimal 2 pilihan yang berisi satu huruf A–E;
 * pilihan C–E boleh kosong di BELAKANG (bukan di tengah). Baris judul dilewati.
 * Pertanyaan kembar di tempelan, atau sama dengan `sudahAda` (pertanyaan yang
 * sudah di bank, dinormalkan), dilaporkan sebagai galat.
 */
export function bacaTempelanSoal(
  teks: string,
  sudahAda: Set<string> = new Set(),
): { soal: SoalInput[]; galat: GalatBaris[] } {
  const soal: SoalInput[] = [];
  const galat: GalatBaris[] = [];
  const terlihat = new Set<string>();
  const baris = pecahTabel(teks);
  // Baris judul (bila ada) menunjuk kolom Kunci dengan pasti — penting bila pilihan
  // jawabannya sendiri berupa satu huruf (mis. "a", "b", "c"), yang tanpa judul bisa
  // tertukar dengan kolom Kunci.
  const judul = baris.length && adalahJudul(baris[0].kol) ? baris[0].kol : null;
  const kolomKunciJudul = judul ? judul.findIndex((c) => /^kunci(\s*jawaban)?$/i.test(c)) : -1;
  const HURUF_KUNCI = /^[A-Ea-e][.)]?$/;
  const opsiSebelum = (k: string[], j: number) => {
    const o = k.slice(2, j);
    while (o.length && !o[o.length - 1]) o.pop();
    return o;
  };
  baris.forEach(({ nomor, kol }, idx) => {
    const ringkas = kol.join(" | ").slice(0, 120);
    if (idx === 0 && judul) return;
    let k = kol;
    // Kolom "No" di depan: angka DIIKUTI kolom agenda yang sah (angka saja bisa juga berarti agenda).
    if (k.length >= 6 && /^\d{1,4}[.)]?$/.test(k[0]) && k[1] !== "" && bacaKisi(k[1]) && !bacaKisi(k[2])) k = k.slice(1);
    const geser = k === kol ? 0 : 1;
    if (k.length < 5) {
      galat.push({ nomor, teks: ringkas, alasan: "Kolom kurang — urutan: Agenda | Pertanyaan | A | B | … | Kunci" });
      return;
    }
    const kisi = bacaKisi(k[0]);
    if (!kisi) {
      galat.push({ nomor, teks: ringkas, alasan: `Agenda "${k[0]}" tidak dikenal (isi I, II, III, IV, Dasar, atau kosong)` });
      return;
    }
    const pertanyaan = k[1];
    const batasCari = Math.min(k.length, 2 + OPSI_MAKS + 1);
    let posKunci = -1;
    // 1) Kolom Kunci menurut baris judul.
    const jJudul = kolomKunciJudul - geser;
    if (kolomKunciJudul >= 0 && jJudul >= 4 && jJudul < k.length && HURUF_KUNCI.test(k[jJudul])) posKunci = jJudul;
    // 2) Tanpa judul: sel huruf A–E pertama yang hurufnya memang ada di antara pilihan sebelumnya
    //    (pilihan "a | b | c | d | e" lalu Kunci "A": sel "c" dilewati karena C bukan pilihan ke-1/2).
    let hurufPertama = -1;
    if (posKunci < 0) {
      for (let j = 4; j < batasCari; j++) {
        if (!HURUF_KUNCI.test(k[j])) continue;
        if (hurufPertama < 0) hurufPertama = j;
        if (bacaKunci(k[j], opsiSebelum(k, j).length) !== undefined) {
          posKunci = j;
          break;
        }
      }
      // 3) Tidak ada yang cocok: pakai huruf pertama agar pesannya "Kunci X tidak ada di pilihan".
      if (posKunci < 0) posKunci = hurufPertama;
    }
    if (posKunci < 0) {
      const salah = k.slice(4, batasCari).find((c) => /^[F-Zf-z][.)]?$/.test(c));
      galat.push({ nomor, teks: ringkas, alasan: salah ? `Kunci "${salah.toUpperCase().replace(/[.)]$/, "")}" harus huruf A–E` : "Kolom kunci (huruf A–E) tidak ditemukan" });
      return;
    }
    const opsiMentah = opsiSebelum(k, posKunci);
    const pembahasan = k.slice(posKunci + 1).filter(Boolean).join(" ").trim() || null;
    const kunci = bacaKunci(k[posKunci], opsiMentah.length);
    if (kunci === undefined) {
      galat.push({ nomor, teks: ringkas, alasan: `Kunci ${k[posKunci].toUpperCase()} tidak ada di pilihan (hanya ${opsiMentah.length} pilihan)` });
      return;
    }
    const s = { kisi, pertanyaan, opsi: opsiMentah, kunci, pembahasan };
    const salah = periksaSoal(s);
    if (salah) {
      galat.push({ nomor, teks: ringkas, alasan: salah });
      return;
    }
    const n = normalTeks(pertanyaan);
    if (terlihat.has(n)) {
      galat.push({ nomor, teks: ringkas, alasan: "Pertanyaan muncul dua kali di tempelan" });
      return;
    }
    if (sudahAda.has(n)) {
      galat.push({ nomor, teks: ringkas, alasan: "Pertanyaan yang sama sudah ada di bank soal" });
      return;
    }
    terlihat.add(n);
    soal.push(s);
  });
  return { soal, galat };
}

export type Acak = () => number;

/** Fisher–Yates; `acak` bisa diganti agar uji deterministik. */
export function kocok<T>(arr: readonly T[], acak: Acak = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Susun paket soal seimbang per kisi-kisi: tiap kelompok dikocok, lalu diambil
 * bergiliran (I, II, III, IV, Dasar, Umum, I, II, …) sampai `jumlah`. Kalau bank
 * kurang, semua soal yang ada dipakai.
 */
export function susunPaket(soal: { id: string; kisi: string }[], jumlah: number, acak: Acak = Math.random): string[] {
  const kelompok = KISI.map((k) => kocok(soal.filter((s) => s.kisi === k), acak)).filter((g) => g.length);
  const lain = kocok(soal.filter((s) => !isKisi(s.kisi)), acak);
  if (lain.length) kelompok.push(lain);
  const hasil: string[] = [];
  const maks = Math.min(jumlah, soal.length);
  for (let putaran = 0; hasil.length < maks; putaran++) {
    for (const g of kelompok) {
      if (hasil.length >= maks) break;
      if (g[putaran]) hasil.push(g[putaran].id);
    }
  }
  return hasil;
}

/** Sebaran paket per kisi, mis. { I: 5, II: 5, ... } — untuk ditampilkan ke penyusun. */
export function sebaranKisi(ids: string[], kisiDari: Map<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const k = kisiDari.get(id) ?? "?";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export type UrutanSoal = { soalId: string; opsi: number[] };

/** Urutan soal & pilihan yang dilihat SATU peserta (disimpan saat mulai, tetap bila halaman dimuat ulang). */
export function buatUrutan(
  soal: { id: string; jumlahOpsi: number }[],
  o: { acakSoal: boolean; acakOpsi: boolean },
  acak: Acak = Math.random,
): UrutanSoal[] {
  const urut = o.acakSoal ? kocok(soal, acak) : soal;
  return urut.map((s) => {
    const idx = Array.from({ length: s.jumlahOpsi }, (_, i) => i);
    return { soalId: s.id, opsi: o.acakOpsi ? kocok(idx, acak) : idx };
  });
}

const bulat = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Skor 0–100 dari jawaban (indeks pilihan ASLI). Soal tak dijawab = salah. */
export function nilaiJawaban(
  soalIds: string[],
  jawaban: Record<string, number | null | undefined>,
  kunci: Map<string, number>,
): { benar: number; jumlah: number; skor: number } {
  const jumlah = soalIds.length;
  const benar = soalIds.filter((id) => jawaban[id] != null && jawaban[id] === kunci.get(id)).length;
  return { benar, jumlah, skor: jumlah ? bulat((benar / jumlah) * 100) : 0 };
}

/**
 * Status tes yang berlaku sekarang.
 *   DRAF       — masih disusun, peserta tidak melihatnya;
 *   TERJADWAL  — sudah diterbitkan, belum waktunya dibuka;
 *   DIBUKA     — peserta bisa mulai;
 *   DITUTUP    — lewat waktu tutup atau ditutup manual.
 */
export type StatusTesBerlaku = "DRAF" | "TERJADWAL" | "DIBUKA" | "DITUTUP";
export const LABEL_STATUS_TES: Record<StatusTesBerlaku, string> = {
  DRAF: "Draf",
  TERJADWAL: "Terjadwal",
  DIBUKA: "Dibuka",
  DITUTUP: "Ditutup",
};
export function statusTes(t: { status: string; buka: Date | null; tutup: Date | null }, now: Date): StatusTesBerlaku {
  if (t.status === "DRAF") return "DRAF";
  if (t.status === "DITUTUP") return "DITUTUP";
  if (t.buka && now < t.buka) return "TERJADWAL";
  if (t.tutup && now >= t.tutup) return "DITUTUP";
  return "DIBUKA";
}

/** Batas waktu satu pengerjaan: mulai + durasi, tetapi tidak melewati waktu tutup tes. */
export function batasPengerjaan(mulai: Date, durasiMenit: number, tutup: Date | null): Date {
  const b = new Date(mulai.getTime() + durasiMenit * 60_000);
  return tutup && tutup < b ? tutup : b;
}

/**
 * N-gain (Hake): (post − pre) / (100 − pre). null bila salah satu belum ada atau
 * pre = 100. Kategori: ≥ 0,7 tinggi; 0,3–0,7 sedang; 0–0,3 rendah; < 0 turun.
 */
export function nGain(pre: number | null | undefined, post: number | null | undefined): number | null {
  if (pre == null || post == null || pre >= 100) return null;
  return bulat((post - pre) / (100 - pre));
}
export function kategoriGain(g: number | null): "TINGGI" | "SEDANG" | "RENDAH" | "TURUN" | null {
  if (g == null) return null;
  if (g < 0) return "TURUN";
  return g >= 0.7 ? "TINGGI" : g >= 0.3 ? "SEDANG" : "RENDAH";
}
export const LABEL_GAIN: Record<"TINGGI" | "SEDANG" | "RENDAH" | "TURUN", string> = {
  TINGGI: "Tinggi",
  SEDANG: "Sedang",
  RENDAH: "Rendah",
  TURUN: "Turun",
};

const rata = (xs: number[]) => (xs.length ? bulat(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/** Ringkasan kelas: rata-rata pre, post, kenaikan, dan N-gain kelas (dari rata-rata). */
export function ringkasKelas(rows: { pre: number | null; post: number | null }[]) {
  const pre = rows.map((r) => r.pre).filter((x): x is number => x != null);
  const post = rows.map((r) => r.post).filter((x): x is number => x != null);
  const lengkap = rows.filter((r) => r.pre != null && r.post != null) as { pre: number; post: number }[];
  const rataPre = rata(pre);
  const rataPost = rata(post);
  const rPreL = rata(lengkap.map((r) => r.pre));
  const rPostL = rata(lengkap.map((r) => r.post));
  return {
    jumlahPre: pre.length,
    jumlahPost: post.length,
    jumlahLengkap: lengkap.length,
    rataPre,
    rataPost,
    rataKenaikan: rata(lengkap.map((r) => r.post - r.pre)),
    // N-gain kelas dihitung dari peserta yang ikut keduanya saja (pembanding adil).
    nGainKelas: nGain(rPreL, rPostL),
  };
}

/**
 * Lembar baca hasil tes (26 Okt 2026): pre-test dibacakan Kepala Balai saat PEMBUKAAN, post-test saat
 * PENUTUPAN. Rata-rata, tertinggi, terendah (tanpa nama), sebaran, dan tiga nilai tertinggi; post-test
 * ditambah perbandingan dengan pre-test (hanya peserta yang ikut keduanya), N-gain kelas, dan tiga
 * kenaikan tertinggi. `rows` = peserta aktif. Urutan seri: nilai turun, lalu nama.
 */
export function lembarBacaTes(jenis: JenisTes, rows: { nama: string; pre: number | null; post: number | null }[]) {
  const ikut = rows.flatMap((r) => {
    const skor = jenis === "PRE" ? r.pre : r.post;
    return skor == null ? [] : [{ nama: r.nama, skor }];
  });
  const skor = ikut.map((r) => r.skor);
  const tigaBesar = <T extends { nama: string }>(xs: T[], nilai: (x: T) => number) =>
    [...xs].sort((a, b) => nilai(b) - nilai(a) || a.nama.localeCompare(b.nama, "id")).slice(0, 3);
  const lengkap = rows.filter((r) => r.pre != null && r.post != null) as { nama: string; pre: number; post: number }[];
  const rataPreL = rata(lengkap.map((r) => r.pre));
  const rataPostL = rata(lengkap.map((r) => r.post));
  const gain = nGain(rataPreL, rataPostL);
  return {
    jumlahPeserta: rows.length,
    jumlahIkut: ikut.length,
    rata: rata(skor),
    tertinggi: skor.length ? Math.max(...skor) : null,
    terendah: skor.length ? Math.min(...skor) : null,
    sebaran: { atas80: skor.filter((s) => s >= 80).length, antara: skor.filter((s) => s >= 60 && s < 80).length, bawah60: skor.filter((s) => s < 60).length },
    terbaik: tigaBesar(ikut, (r) => r.skor),
    banding:
      jenis === "POST" && lengkap.length
        ? {
            jumlah: lengkap.length,
            rataPre: rataPreL,
            rataPost: rataPostL,
            rataKenaikan: rata(lengkap.map((r) => r.post - r.pre)),
            nGainKelas: gain,
            kategori: kategoriGain(gain),
            kenaikanTerbaik: tigaBesar(lengkap, (r) => r.post - r.pre).map((r) => ({ nama: r.nama, kenaikan: bulat(r.post - r.pre) })),
          }
        : null,
  };
}

export type ButirHasil = {
  soalId: string;
  pre: number | null; // % benar
  post: number | null;
  nPre: number;
  nPost: number;
  catatan: string[];
};

/**
 * Analisis butir: persen benar tiap soal pada pre & post, dengan penanda untuk
 * memperbaiki bank soal: terlalu mudah (pre ≥ 90%), terlalu sukar (post < 30%),
 * tidak naik (post ≤ pre). Penanda baru diberikan bila sedikitnya 5 peserta.
 */
export function analisisButir(
  soalIds: string[],
  kunci: Map<string, number>,
  pre: Record<string, number | null | undefined>[],
  post: Record<string, number | null | undefined>[],
): ButirHasil[] {
  const persen = (daftar: Record<string, number | null | undefined>[], id: string) =>
    daftar.length ? bulat((daftar.filter((j) => j[id] != null && j[id] === kunci.get(id)).length / daftar.length) * 100, 1) : null;
  return soalIds.map((id) => {
    const p = persen(pre, id);
    const q = persen(post, id);
    const catatan: string[] = [];
    if (p != null && pre.length >= 5 && p >= 90) catatan.push("Terlalu mudah");
    if (q != null && post.length >= 5 && q < 30) catatan.push("Terlalu sukar");
    if (p != null && q != null && pre.length >= 5 && post.length >= 5 && q <= p) catatan.push("Tidak naik");
    return { soalId: id, pre: p, post: q, nPre: pre.length, nPost: post.length, catatan };
  });
}

/** Sisa waktu (detik, ≥ 0). */
export const sisaDetik = (batas: Date, now: Date) => Math.max(0, Math.floor((batas.getTime() - now.getTime()) / 1000));

/** Teks CSV satu sel (untuk unduhan hasil). */
export function selCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  const aman = typeof v !== "number" && /^[=+\-@]/.test(s) ? `'${s}` : s; // cegah formula di Excel
  return /[",;\n]/.test(aman) ? `"${aman.replace(/"/g, '""')}"` : aman;
}
