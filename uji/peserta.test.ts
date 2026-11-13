// Uji murni modul peserta, disalin dari uji/murni.test.ts aplikasi lama (gaya skrip `sama`, dibungkus node:test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { diklatUtama, hariPelatihan, labelPendekTahap, penerbitSertifikat, persenHadir, ringkasBeranda, sesiTerdekat, tahapAktif } from "../src/lib/beranda-peserta";
import { DEFINISI_FORMULIR, kunciPengampu, periksaIsianEvaluasi, rekapSasaran } from "../src/lib/evaluasi";
import { ASPEK_23B, FORMULIR_23B, kualifikasi23B, mulaiIsi23B, pakaiFormulir23B, periksaIsian23B, rekap23B } from "../src/lib/evaluasi-penyelenggaraan";
import { bagiKelompok, labelKelompok, pakaiKelompok, periksaKelompok } from "../src/lib/kelompok";
import { tahapKurikulum } from "../src/lib/kurikulum";
import { MATERI_KOMPETENSI_DASAR, materiProgram } from "../src/lib/materi";
import { bacaNilai, daftarAspek, hitungHasil, jenisDariKodeRemedial, kodeRemedial, kualifikasi, nilaiAspek, peringkat } from "../src/lib/penilaian";
import { kunciOrang, periksaIsianPenugasan, periksaRangkap, periksaUsulanMentor } from "../src/lib/penugasan-angkatan";
import { kutip } from "../src/lib/perhatian";
import { buatSandiSementara, bukaSandi, kunciSandiAwal, segelSandi } from "../src/lib/server/sandi-awal";
import { bacaTautan } from "../src/lib/sesi";
import { susunSuratKeterangan, tambahHari } from "../src/lib/surat-keterangan";
import { analisisButir, bacaKisi, bacaKunci, bacaTempelanSoal, batasPengerjaan, buatUrutan, kategoriGain, kocok, labelKisi, nGain, nilaiJawaban, normalTeks, pecahTabel, periksaSoal, ringkasKelas, sebaranKisi, selCsv, sisaDetik, statusTes, susunPaket } from "../src/lib/tes";
import { isiSesuaiTipeTugas, lamaMenunggu, peranBolehAksi, periksaBerkasTugas, periksaIsianTugas, rekapKiriman, statusSesudah, tipeDariNama } from "../src/lib/tugas";
import { readFileSync, statSync } from "fs";
// Uji fungsi murni (tanpa database, tanpa server). Jalankan: npm run uji

let lulus = 0;
let gagal = 0;
function sama(nama: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) === JSON.stringify(b)) lulus++;
  else {
    gagal++;
    console.log("  GAGAL:", nama, "->", JSON.stringify(a), "| seharusnya", JSON.stringify(b));
  }
}
const d = (s: string) => new Date(s);

console.log("# penilaian.ts — aspek, kualifikasi, kelulusan (Pedoman BAB III.E)");
for (const [j, m] of [["PKA", "BLENDED"], ["PKA", "KLASIKAL"], ["PKP", "BLENDED"], ["PKP", "KLASIKAL"]]) {
  const as = daftarAspek(j, m);
  const per = (k: string) => as.filter((a) => a.jenisEvaluasi === k).reduce((x, a) => x + a.bobot, 0);
  const blended = m === "BLENDED";
  sama(`${j} ${m}: bobot 15/20/20/30/15 (blended) atau 10/20/20/30/20 (klasikal)`, ["AKADEMIK", "PEMBELAJARAN_LAPANGAN", "AKTUALISASI_RANCANGAN", "AKTUALISASI_IMPLEMENTASI", "SIKAP_PERILAKU"].map(per), blended ? [15, 20, 20, 30, 15] : [10, 20, 20, 30, 20]);
  sama(`${j} ${m}: kode aspek unik`, new Set(as.map((a) => a.kode)).size, as.length);
}
const asPka = daftarAspek("PKA", "BLENDED");
sama("kode aspek berurutan per jenis evaluasi", asPka.slice(0, 5).map((a) => a.kode), ["AKADEMIK-1", "AKADEMIK-2", "AKADEMIK-3", "AKADEMIK-4", "PEMBELAJARAN_LAPANGAN-1"]);
sama("aspek yang bisa diisi WI: pengampu/penguji/pendamping/coach, bukan kuis/sosiometri/mentor/penyelenggara", asPka.filter((a) => !a.bisaDiisiWi).map((a) => a.penilai), ["SISTEM", "PESERTA", "PENYELENGGARA", "MENTOR"]);
sama("aspek aktualisasi dinilai penguji", asPka.filter((a) => a.jenisEvaluasi.startsWith("AKTUALISASI")).every((a) => a.penilai === "PENGUJI"), true);
sama("diklat umum tidak punya aspek", [daftarAspek(null, null).length, daftarAspek("PKA", null).length], [0, 0]);
sama("kode remedial", [kodeRemedial("AKADEMIK"), jenisDariKodeRemedial("REMEDIAL-AKADEMIK"), jenisDariKodeRemedial("REMEDIAL-NGAWUR"), jenisDariKodeRemedial("AKADEMIK-1")], ["REMEDIAL-AKADEMIK", "AKADEMIK", null, null]);
sama("baca nilai", ["85", "85,5", "85.25", "100", "0", "", " 70 ", "100,01", "-1", "85.123", "abc", null].map(bacaNilai), [85, 85.5, 85.25, 100, 0, null, 70, undefined, undefined, undefined, undefined, null]);
sama("kualifikasi di batas Pedoman", [90.01, 90, 80.01, 80, 70.01, 70, 60.01, 60, 0, 70.004].map(kualifikasi), ["SANGAT_MEMUASKAN", "MEMUASKAN", "MEMUASKAN", "BAIK", "BAIK", "KURANG_BAIK", "KURANG_BAIK", "TIDAK_MEMENUHI", "TIDAK_MEMENUHI", "KURANG_BAIK"]);
sama("nilai aspek: rekap Ketua Diklat didahulukan; selain itu rata-rata penilai", [nilaiAspek([{ nilai: 80, sumber: "PENILAI" }, { nilai: 85, sumber: "PENILAI" }, { nilai: 90, sumber: "PENILAI" }]), nilaiAspek([{ nilai: 80, sumber: "PENILAI" }, { nilai: 75, sumber: "REKAP" }]), nilaiAspek([])], [{ nilai: 85, dari: "RATA", jumlahPenilai: 3 }, { nilai: 75, dari: "REKAP", jumlahPenilai: 1 }, { nilai: null, dari: null, jumlahPenilai: 0 }]);
const isi = (f: (kode: string) => number | null) => new Map(asPka.map((a) => [a.kode, f(a.kode)]));
let hp = hitungHasil(asPka, isi(() => 80));
sama("semua 80 → lulus, nilai akhir 80 (Baik), 5 kolom Formulir 14", [hp.status, hp.nilaiAkhir, hp.kualifikasi, hp.evaluasi.map((e) => e.kontribusi)], ["LULUS", 80, "BAIK", [12, 16, 16, 24, 12]]);
hp = hitungHasil(asPka, isi((k) => (k === "AKADEMIK-2" ? null : 80)));
sama("satu aspek kosong → belum lengkap, tanpa nilai akhir", [hp.status, hp.nilaiAkhir, hp.evaluasi[0].terisi, hp.evaluasi[0].nilai], ["BELUM_LENGKAP", null, 3, null]);
hp = hitungHasil(asPka, isi((k) => (k.startsWith("AKADEMIK") ? 65 : 92)));
sama("akademik 65 (kurang baik) → ditunda, perlu remedial akademik", [hp.status, hp.statusAwal, hp.perluRemedial, hp.perluKeputusanTim, hp.nilaiAkhir], ["DITUNDA", "DITUNDA", ["AKADEMIK"], false, 87.95]);
let r = hitungHasil(asPka, isi((k) => (k.startsWith("AKADEMIK") ? 65 : 92)), { AKADEMIK: 90 });
sama("remedial akademik 90 → dibatasi 85, lulus, nilai akhir paling tinggi 85", [r.status, r.evaluasi[0].remedial, r.evaluasi[0].nilaiDipakai, r.nilaiAkhir, r.kualifikasi], ["LULUS", 85, 85, 85, "MEMUASKAN"]);
r = hitungHasil(asPka, isi((k) => (k.startsWith("AKADEMIK") ? 65 : 92)), { AKADEMIK: 68 });
sama("remedial masih kurang baik → tidak lulus", r.status, "TIDAK_LULUS");
r = hitungHasil(asPka, isi((k) => (k.startsWith("AKADEMIK") ? 65 : 92)), { SIKAP_PERILAKU: 50 });
sama("remedial untuk evaluasi yang tidak kurang baik diabaikan", [r.status, r.evaluasi[4].remedial], ["DITUNDA", null]);
r = hitungHasil(asPka, isi(() => 80), { AKADEMIK: 95 });
sama("peserta lulus tidak terpengaruh nilai remedial", [r.status, r.nilaiAkhir, r.evaluasi[0].remedial], ["LULUS", 80, null]);
hp = hitungHasil(asPka, isi((k) => (k.startsWith("SIKAP") ? 65 : 80)), { SIKAP_PERILAKU: 90 });
sama("sikap perilaku kurang baik → tidak bisa diremedial, diputus Tim", [hp.status, hp.perluRemedial, hp.perluKeputusanTim, hp.evaluasi[4].remedial], ["DITUNDA", [], true, null]);
hp = hitungHasil(asPka, isi((k) => (k.startsWith("PEMBELAJARAN") ? 55 : 95)));
sama("satu evaluasi tidak memenuhi (≤60) → tidak lulus walau nilai akhir tinggi", [hp.status, hp.nilaiAkhir], ["TIDAK_LULUS", 87]);
hp = hitungHasil(asPka, isi((k) => (k.startsWith("AKADEMIK") ? 65 : k.startsWith("SIKAP") ? 55 : 90)));
sama("kurang baik + tidak memenuhi → tidak lulus, tanpa remedial", [hp.status, hp.perluRemedial], ["TIDAK_LULUS", []]);
const nb = new Map(asPka.map((a) => [a.kode, 80 as number | null]));
nb.set("AKADEMIK-1", 100); nb.set("AKADEMIK-2", 50); nb.set("AKADEMIK-3", 70); nb.set("AKADEMIK-4", 90);
sama("nilai evaluasi = rata-rata TERTIMBANG bobot aspek (4/2/3/6)", hitungHasil(asPka, nb).evaluasi[0].nilai, 83.33);
sama("peringkat: hanya yang lulus; nilai sama berbagi peringkat", [...peringkat([{ id: "a", nilaiAkhir: 85, status: "LULUS" }, { id: "b", nilaiAkhir: 90, status: "LULUS" }, { id: "c", nilaiAkhir: 85, status: "LULUS" }, { id: "d", nilaiAkhir: 99, status: "TIDAK_LULUS" }, { id: "e", nilaiAkhir: 80, status: "LULUS" }])], [["b", 1], ["a", 2], ["c", 2], ["e", 4]]);


console.log("# beranda-peserta.ts");
sama("hari pelatihan: belum mulai", hariPelatihan("2026-10-10", "2026-10-20", "2026-10-09"), { ke: 0, total: 11, status: "belum" });
sama("hari pelatihan: hari pertama", hariPelatihan("2026-10-10", "2026-10-20", "2026-10-10"), { ke: 1, total: 11, status: "berjalan" });
sama("hari pelatihan: lewat → selesai, ke = total", hariPelatihan("2026-10-10", "2026-10-20", "2026-11-01"), { ke: 11, total: 11, status: "selesai" });
sama("hari pelatihan: tanpa tanggal selesai → null", hariPelatihan("2026-10-10", null, "2026-10-11"), null);
sama("persen hadir: 24 hadir dari 27 dicatat", persenHadir({ jpHadir: 24, jpTidakHadir: 3 }), 89);
sama("persen hadir: belum ada catatan → null", persenHadir({ jpHadir: 0, jpTidakHadir: 0 }), null);
const ss = [{ tanggal: "2026-10-10", jamMulai: "13:00", k: "b" }, { tanggal: "2026-10-10", jamMulai: "08:00", k: "a" }, { tanggal: "2026-10-12", k: "c" }, { tanggal: "2026-10-08", k: "lalu" }];
const sd = sesiTerdekat(ss, "2026-10-10");
sama("sesi terdekat: hari ini urut jam, berikutnya sesudah hari ini", [sd.hariIni.map((x) => x.k), sd.berikutnya?.k], [["a", "b"], "c"]);
sama("sesi terdekat: tidak ada berikutnya", sesiTerdekat(ss, "2026-10-13").berikutnya, null);
sama(
  "ringkas beranda: peserta mundur tidak dihitung, rata kehadiran dari yang ada",
  ringkasBeranda([
    { status: "Berjalan", statusPeserta: "AKTIF", kehadiranPersen: 90 },
    { status: "Selesai", statusPeserta: "AKTIF", kehadiranPersen: 100 },
    { status: "Terjadwal", statusPeserta: "AKTIF", kehadiranPersen: null },
    { status: "Berjalan", statusPeserta: "MENGUNDURKAN_DIRI", kehadiranPersen: 10 },
  ]),
  { berjalan: 1, terjadwal: 1, selesai: 1, rataKehadiran: 95 },
);
sama("diklat utama: yang berjalan didahulukan", diklatUtama([{ id: 1, status: "Terjadwal", statusPeserta: "AKTIF", mulai: "2026-11-01" }, { id: 2, status: "Berjalan", statusPeserta: "AKTIF", mulai: "2026-09-01" }])?.id, 2);
sama("diklat utama: tanpa yang berjalan → terjadwal terdekat", diklatUtama([{ id: 1, status: "Terjadwal", statusPeserta: "AKTIF", mulai: "2026-12-01" }, { id: 3, status: "Terjadwal", statusPeserta: "AKTIF", mulai: "2026-11-01" }, { id: 4, status: "Selesai", statusPeserta: "AKTIF", mulai: "2026-01-01" }])?.id, 3);
sama("penerbit sertifikat: PKA/PKP → LAN (bertautan), lainnya → BPSDM", [penerbitSertifikat("PKA").penerbit, !!penerbitSertifikat("PKP").tautan, penerbitSertifikat(null).penerbit, penerbitSertifikat(null).tautan], ["LAN", true, "BPSDM Kemendagri", null]);
sama("diklat utama: hanya selesai → null", diklatUtama([{ status: "Selesai", statusPeserta: "AKTIF", mulai: "2026-01-01" }]), null);


console.log("# bilah tahapan, tautan rapat, materi");
const tk = tahapKurikulum("PKA", "BLENDED").map((x) => ({ kode: x.tipe, hari: x.hari }));
sama("PKA blended: 6 tahap, hari kurikulum = 105", [tk.length, tk.reduce((n, x) => n + (x.hari ?? 0), 0)], [6, 105]);
sama("label pendek: Klasikal I & II dibedakan", labelPendekTahap(tk), ["Mandiri", "E-learning", "Komitmen", "Klasikal I", "Aktualisasi", "Klasikal II"]);
sama("tahap aktif: belum mulai → -1, selesai → 6", [tahapAktif(tk, { ke: 0, total: 105, status: "belum" }), tahapAktif(tk, { ke: 105, total: 105, status: "selesai" })], [-1, 6]);
sama("tahap aktif: hari 1 → Mandiri, hari 11 → Mandiri, hari 12 → E-learning", [1, 11, 12].map((ke) => tahapAktif(tk, { ke, total: 105, status: "berjalan" })), [0, 0, 1]);
sama("tahap aktif: hari 50 → Aktualisasi, hari 104 → Klasikal II", [50, 104].map((ke) => tahapAktif(tk, { ke, total: 105, status: "berjalan" })), [4, 5]);
sama("tahap aktif: kalender lebih panjang dipetakan proporsional (hari 22 dari 210 → Mandiri)", tahapAktif(tk, { ke: 22, total: 210, status: "berjalan" }), 0);
sama("tahap aktif: sesi klasikal hari ini di masa aktualisasi awal → Klasikal I (terdekat)", tahapAktif(tk, { ke: 45, total: 105, status: "berjalan" }, "KLASIKAL"), 3);
sama("tahap aktif: sesi klasikal menjelang akhir → Klasikal II", tahapAktif(tk, { ke: 95, total: 105, status: "berjalan" }, "KLASIKAL"), 5);
sama("tahap aktif: sesi sinkron hari ini → E-learning", tahapAktif(tk, { ke: 9, total: 105, status: "berjalan" }, "SINKRON"), 1);
sama("tahap aktif: tanpa kurikulum → -1", tahapAktif([], { ke: 3, total: 10, status: "berjalan" }), -1);
sama("tautan: https Zoom diterima", bacaTautan(" https://zoom.us/j/123?pwd=ab "), "https://zoom.us/j/123?pwd=ab");
sama("tautan: kosong → null", [bacaTautan(""), bacaTautan(null)], [null, null]);
sama("tautan: bukan http(s)/berspasi/tanpa skema → ditolak", [bacaTautan("javascript:alert(1)"), bacaTautan("zoom.us/j/1"), bacaTautan("https://a b.com"), bacaTautan("ftp://x.id/f")], [undefined, undefined, undefined, undefined]);
sama("materi PKA: 5 berkas, ada Berpikir Kritis, tanpa GEDSI", [materiProgram("PKA").length, materiProgram("PKA").some((m) => /Berpikir/.test(m.judul)), materiProgram("PKA").some((m) => /GEDSI/.test(m.judul))], [5, true, false]);
sama("materi PKP: 7 berkas, ada GEDSI 1-3, tanpa Berpikir Kritis", [materiProgram("PKP").length, materiProgram("PKP").filter((m) => /GEDSI/.test(m.judul)).length, materiProgram("PKP").some((m) => /Berpikir/.test(m.judul))], [7, 3, false]);
sama("materi: diklat non-PKA/PKP → kosong", materiProgram("TEKNIS").length, 0);
const berkasHilang = MATERI_KOMPETENSI_DASAR.filter((m) => {
  try {
    const st = statSync(`public${m.berkas}`);
    return Math.abs(st.size / 1024 - m.ukuranKb) > 2 || readFileSync(`public${m.berkas}`).subarray(0, 5).toString() !== "%PDF-";
  } catch {
    return true;
  }
});
sama("materi: semua berkas ada di public/, PDF, ukuran tercatat benar", berkasHilang.map((m) => m.berkas), []);


console.log("# tes.ts — pre-test & post-test");
// pembangkit acak deterministik untuk uji
const rng = (seed = 7) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
sama("kisi: I/1/Agenda II/agenda 3/IV./dasar/kosong", ["I", "1", "Agenda II", "agenda 3", "IV.", "Dasar", "", "umum"].map(bacaKisi), ["I", "I", "II", "III", "IV", "DASAR", "UMUM", "UMUM"]);
sama("kisi: teks lain → undefined", [bacaKisi("V"), bacaKisi("Agenda 5"), bacaKisi("abc")], [undefined, undefined, undefined]);
sama("label kisi dengan nama agenda", [labelKisi("II", ["a", "Kepemimpinan Kinerja"]), labelKisi("DASAR"), labelKisi("UMUM")], ["Agenda II: Kepemimpinan Kinerja", "Mata pelatihan dasar", "Umum"]);
sama("kunci: A/c/2/E. sesuai jumlah pilihan", [bacaKunci("A", 4), bacaKunci("c", 4), bacaKunci("2", 4), bacaKunci("E.", 5), bacaKunci("E", 4), bacaKunci("", 4)], [0, 2, 1, 4, undefined, undefined]);
sama("periksa soal: sah", periksaSoal({ pertanyaan: "Apa?", opsi: ["x", "y"], kunci: 1 }), null);
sama("periksa soal: kosong/1 opsi/opsi kembar/kunci luar", [
  periksaSoal({ pertanyaan: " ", opsi: ["x", "y"], kunci: 0 }),
  periksaSoal({ pertanyaan: "A", opsi: ["x"], kunci: 0 }),
  periksaSoal({ pertanyaan: "A", opsi: ["x", " X "], kunci: 0 }),
  periksaSoal({ pertanyaan: "A", opsi: ["x", "y"], kunci: 2 }),
  periksaSoal({ pertanyaan: "A", opsi: ["a", "b", "c", "d", "e", "f"], kunci: 0 }),
].map((x) => !!x), [true, true, true, true, true]);
sama("pecah tabel: sel berkutip berisi Enter & kutip ganda", pecahTabel('I\t"Baris 1\nBaris ""2"""\tx\ty\tA\nII\tQ2\tp\tq\tB'), [
  { nomor: 1, kol: ["I", 'Baris 1\nBaris "2"', "x", "y", "A"] },
  { nomor: 3, kol: ["II", "Q2", "p", "q", "B"] },
]);
sama("pecah tabel: pemisah | bila tanpa Tab", pecahTabel("I|Soal|a|b|A").map((b) => b.kol.length), [5]);
const tempelan = [
  "Agenda\tPertanyaan\tA\tB\tC\tD\tE\tKunci\tPembahasan",
  "I\tNilai dasar Pancasila?\tKetuhanan\tUang\tKuasa\tTahta\t\tA\tSila pertama",
  "2\tKinerja diukur dengan?\tIKU\tGosip\t\t\t\tA",
  "III\tSoal tanpa kunci\ta\tb\tc\td",
  "V\tAgenda salah\ta\tb\tA",
  "IV\tKunci di luar\ta\tb\tC",
  "IV\tNILAI dasar  pancasila?\ta\tb\tA",
  "Dasar\tSudah ada di bank\ta\tb\tB",
  "IV\tPilihan kosong di tengah\topsi a\t\topsi c\tB",
].join("\n");
const ts = bacaTempelanSoal(tempelan, new Set([normalTeks("Sudah ada di bank")]));
sama("tempel soal: 2 sah (judul dilewati)", ts.soal.map((x) => [x.kisi, x.opsi.length, x.kunci, x.pembahasan ?? null]), [["I", 4, 0, "Sila pertama"], ["II", 2, 0, null]]);
sama("tempel soal: galat per baris", ts.galat.map((g) => g.nomor), [4, 5, 6, 7, 8, 9]);
sama("tempel soal: alasan jelas", [/kunci/i.test(ts.galat[0].alasan), /tidak dikenal/.test(ts.galat[1].alasan), /tidak ada di pilihan/.test(ts.galat[2].alasan), /dua kali/.test(ts.galat[3].alasan), /sudah ada/.test(ts.galat[4].alasan), /kosong/.test(ts.galat[5].alasan)], [true, true, true, true, true, true]);
sama("tempel soal: kolom No di depan dilewati", bacaTempelanSoal("1\tI\tSoal bernomor\ta\tb\tB").soal.map((x) => [x.kisi, x.kunci]), [["I", 1]]);
// Uji lapangan 12 Okt: pilihan berupa satu huruf ("a".."e") dulu terbaca sebagai kolom Kunci.
const satuHuruf = ["I\t[UJI] Contoh soal 1\ta\tb\tc\td\te\tA\tuji 1", "II\t[UJI] Contoh soal 2\ta\tb\tc\td\te\tC\tuji 2", "umum\t[UJI] Contoh soal 3\ta\tb\tc\td\te\tE\tuji 3"];
const JUDUL_SOAL = "Agenda\tPertanyaan\tA\tB\tC\tD\tE\tKunci\tPembahasan";
sama("tempel soal: pilihan satu huruf + baris judul -> kunci dari kolom Kunci", bacaTempelanSoal([JUDUL_SOAL, ...satuHuruf].join("\n")).soal.map((x) => [x.kisi, x.opsi.length, x.kunci, x.pembahasan]), [
  ["I", 5, 0, "uji 1"], ["II", 5, 2, "uji 2"], ["UMUM", 5, 4, "uji 3"],
]);
sama("tempel soal: pilihan satu huruf tanpa judul -> tetap benar", bacaTempelanSoal(satuHuruf.join("\n")).soal.map((x) => [x.opsi.length, x.kunci]), [[5, 0], [5, 2], [5, 4]]);
sama("tempel soal: judul menunjuk Kunci walau pilihan berupa huruf yang sah", bacaTempelanSoal([JUDUL_SOAL, "I\tQ\tx\ta\tb\t\t\tC\t"].join("\n")).soal.map((x) => [x.opsi, x.kunci]), [[["x", "a", "b"], 2]]);
sama("tempel soal: kolom No + judul ber-No", bacaTempelanSoal(["No\t" + JUDUL_SOAL, "1\tI\tQ1\ta\tb\tc\t\t\tB\t"].join("\n")).soal.map((x) => [x.opsi.length, x.kunci]), [[3, 1]]);
sama("tempel soal: kunci huruf di luar A–E -> pesan jelas", bacaTempelanSoal([JUDUL_SOAL, "I\tQ\tsatu\tdua\ttiga\tempat\tlima\tF\tx"].join("\n")).galat.map((g) => g.alasan), ['Kunci "F" harus huruf A–E']);
const bank = [
  ...["a1", "a2", "a3"].map((id) => ({ id, kisi: "I" })),
  ...["b1", "b2"].map((id) => ({ id, kisi: "II" })),
  { id: "c1", kisi: "III" },
  ...["d1", "d2", "d3", "d4"].map((id) => ({ id, kisi: "IV" })),
];
const pk = susunPaket(bank, 6, rng());
const kisiDari = new Map(bank.map((b) => [b.id, b.kisi]));
sama("paket: 6 soal seimbang (I2 II2 III1 IV1... bergiliran)", sebaranKisi(pk, kisiDari), { I: 2, II: 2, III: 1, IV: 1 });
sama("paket: tanpa kembar", new Set(pk).size, 6);
sama("paket: minta lebih dari bank → semua soal", susunPaket(bank, 50, rng()).length, 10);
sama("paket: bank kosong → kosong", susunPaket([], 10), []);
const ur = buatUrutan([{ id: "s1", jumlahOpsi: 4 }, { id: "s2", jumlahOpsi: 2 }, { id: "s3", jumlahOpsi: 5 }], { acakSoal: true, acakOpsi: true }, rng(3));
sama("urutan: semua soal sekali, opsi = permutasi", [ur.map((u) => u.soalId).sort(), ur.map((u) => [...u.opsi].sort().join(""))].flat().length, 6);
sama("urutan: opsi tiap soal permutasi lengkap", ur.every((u) => new Set(u.opsi).size === u.opsi.length && Math.max(...u.opsi) === u.opsi.length - 1), true);
sama("urutan tanpa acak: tetap", buatUrutan([{ id: "s1", jumlahOpsi: 3 }, { id: "s2", jumlahOpsi: 2 }], { acakSoal: false, acakOpsi: false }), [{ soalId: "s1", opsi: [0, 1, 2] }, { soalId: "s2", opsi: [0, 1] }]);
sama("kocok tidak mengubah asal", (() => { const a = [1, 2, 3]; kocok(a, rng()); return a; })(), [1, 2, 3]);
const kunciTes = new Map([["s1", 0], ["s2", 1], ["s3", 2]]);
sama("nilai: 2 dari 3 benar, tak dijawab = salah", nilaiJawaban(["s1", "s2", "s3"], { s1: 0, s2: 1, s3: null }, kunciTes), { benar: 2, jumlah: 3, skor: 66.67 });
sama("nilai: tanpa soal → 0", nilaiJawaban([], {}, kunciTes), { benar: 0, jumlah: 0, skor: 0 });
const jam = (h: number) => new Date(`2026-10-10T${String(h).padStart(2, "0")}:00:00Z`);
sama("status tes: draf / terjadwal / dibuka / lewat tutup / ditutup manual", [
  statusTes({ status: "DRAF", buka: null, tutup: null }, jam(5)),
  statusTes({ status: "TERBIT", buka: jam(6), tutup: jam(9) }, jam(5)),
  statusTes({ status: "TERBIT", buka: jam(6), tutup: jam(9) }, jam(6)),
  statusTes({ status: "TERBIT", buka: jam(6), tutup: jam(9) }, jam(9)),
  statusTes({ status: "DITUTUP", buka: null, tutup: null }, jam(5)),
  statusTes({ status: "TERBIT", buka: null, tutup: null }, jam(5)),
], ["DRAF", "TERJADWAL", "DIBUKA", "DITUTUP", "DITUTUP", "DIBUKA"]);
sama("batas pengerjaan: durasi, dipotong waktu tutup", [batasPengerjaan(jam(6), 30, null).toISOString(), batasPengerjaan(jam(8), 90, jam(9)).toISOString()], ["2026-10-10T06:30:00.000Z", "2026-10-10T09:00:00.000Z"]);
sama("sisa detik tidak negatif", [sisaDetik(jam(7), jam(6)), sisaDetik(jam(6), jam(7))], [3600, 0]);
sama("N-gain: 40→70 = 0,5 sedang; 50→95 tinggi; 60→50 turun; pre 100 → null", [nGain(40, 70), kategoriGain(nGain(40, 70)), kategoriGain(nGain(50, 95)), kategoriGain(nGain(60, 50)), nGain(100, 100), nGain(null, 80)], [0.5, "SEDANG", "TINGGI", "TURUN", null, null]);
sama("ringkas kelas: N-gain dari peserta yang ikut keduanya", ringkasKelas([{ pre: 40, post: 70 }, { pre: 60, post: 80 }, { pre: 20, post: null }, { pre: null, post: 100 }]), {
  jumlahPre: 3, jumlahPost: 3, jumlahLengkap: 2, rataPre: 40, rataPost: 83.33, rataKenaikan: 25, nGainKelas: 0.5,
});
const jPre = Array.from({ length: 5 }, (_, i) => ({ s1: 0, s2: i < 1 ? 1 : 0, s3: 0 }));
const jPost = Array.from({ length: 5 }, (_, i) => ({ s1: 0, s2: i < 4 ? 1 : 0, s3: i < 1 ? 2 : 0 }));
const butir = analisisButir(["s1", "s2", "s3"], kunciTes, jPre, jPost);
sama("analisis butir: % benar pre/post", butir.map((b) => [b.pre, b.post]), [[100, 100], [20, 80], [0, 20]]);
sama("analisis butir: penanda", butir.map((b) => b.catatan), [["Terlalu mudah", "Tidak naik"], [], ["Terlalu sukar"]]);
sama("analisis butir: < 5 peserta tanpa penanda", analisisButir(["s1"], kunciTes, [{ s1: 0 }], [{ s1: 1 }])[0].catatan, []);
sama("CSV: kutip, cegah formula, angka negatif utuh", [selCsv('a"b'), selCsv("=SUM(A1)"), selCsv(-0.2), selCsv("x;y")], ['"a""b"', "'=SUM(A1)", "-0.2", '"x;y"']);


console.log("# evaluasi.ts — evaluasi tenaga pelatihan (Formulir 16–22)");
sama("jumlah aspek per formulir (17:10, 16:4, 19:3, 20:6, 21:6)", ["PENGAMPU", "PENCERAMAH", "PENGUJI", "COACH", "MENTOR"].map((f) => DEFINISI_FORMULIR[f as "PENGAMPU"].aspek.length), [10, 4, 3, 6, 6]);
const isiPenuh = Object.fromEntries(DEFINISI_FORMULIR.PENGAMPU.aspek.map((a, i) => [a.kode, 80 + i]));
const e1 = periksaIsianEvaluasi("PENGAMPU", { ...isiPenuh, A9: null });
sama("pengampu: A9 (tim teaching) boleh kosong, rata dari 9 aspek", "rata" in e1 ? [Object.keys(e1.nilai).length, e1.rata] : e1, [9, 84.11]);
sama("aspek wajib kosong -> galat menyebut nama aspek", periksaIsianEvaluasi("PENGAMPU", { ...isiPenuh, A1: null }), { galat: 'Nilai "Penguasaan materi" belum diisi' });
sama("nilai di luar 1–100 / aspek asing -> galat", ["galat" in periksaIsianEvaluasi("PENGUJI", { A1: 0, A2: 80, A3: 80 }), "galat" in periksaIsianEvaluasi("PENGUJI", { A1: 101, A2: 80, A3: 80 }), "galat" in periksaIsianEvaluasi("PENGUJI", { A1: 80, A2: 80, A3: 80, A4: 80 })], [true, true, true]);
sama("nilai desimal dibulatkan 2 angka", (periksaIsianEvaluasi("PENGUJI", { A1: 80.333, A2: 90, A3: 70 }) as any).nilai.A1, 80.33);
const rkE = rekapSasaran("PENGUJI", [{ nilai: { A1: 80, A2: 90, A3: 70 }, rata: 80 }, { nilai: { A1: 100, A2: 90, A3: 95 }, rata: 95 }]);
sama("rekap: responden, rata, kualifikasi, rata per aspek", [rkE.responden, rkE.rata, rkE.kualifikasi, rkE.perAspek.map((a) => a.rata)], [2, 87.5, "MEMUASKAN", [90, 90, 82.5]]);
sama("rekap kosong", [rekapSasaran("COACH", []).rata, rekapSasaran("COACH", []).kualifikasi], [null, null]);
sama("kunci pengampu per WI + mata pelatihan", [kunciPengampu("W1", "PKA-A1-01"), kunciPengampu("W1", null)], ["P:W1:PKA-A1-01", "P:W1:-"]);


console.log("# evaluasi-penyelenggaraan.ts — Formulir 23B");
sama("8 kelompok, 43 butir, 5 butir pembelajaran lapangan opsional", [FORMULIR_23B.length, ASPEK_23B.length, ASPEK_23B.filter((a) => a.opsional).map((a) => a.kode)], [8, 43, ["2e3", "3a", "3b", "3c", "3d"]]);
sama("kode butir unik", new Set(ASPEK_23B.map((a) => a.kode)).size, ASPEK_23B.length);
sama("hanya PKA/PKP", [pakaiFormulir23B("PKA"), pakaiFormulir23B("PKP"), pakaiFormulir23B(null), pakaiFormulir23B("teknis")], [true, true, false, false]);
sama("dibuka 7 hari terakhir; diklat pendek sejak hari pertama; tanpa tanggal selesai sejak mulai",
  [mulaiIsi23B("2026-07-01", "2026-10-14"), mulaiIsi23B("2026-10-10", "2026-10-12"), mulaiIsi23B("2026-10-10", null)], ["2026-10-08", "2026-10-10", "2026-10-10"]);
sama("kualifikasi kolom formulir (Buruk … Sangat baik)", [60, 60.01, 70, 75, 80.5, 90, 90.01].map(kualifikasi23B), ["BURUK", "KURANG", "KURANG", "CUKUP", "BAIK", "BAIK", "SANGAT_BAIK"]);
const isi23 = Object.fromEntries(ASPEK_23B.map((a) => [a.kode, a.opsional ? null : 80]));
const h23 = periksaIsian23B(isi23);
sama("tanpa pembelajaran lapangan: 38 butir, rata 80", "rata" in h23 ? [Object.keys(h23.nilai).length, h23.rata] : h23, [38, 80]);
sama("butir wajib kosong -> galat menyebut butirnya", periksaIsian23B({ ...isi23, "7d": null }), { galat: 'Nilai "Ketepatan waktu penyajian makanan" belum diisi' });
sama("kode asing / di luar 1–100 -> galat", ["galat" in periksaIsian23B({ ...isi23, "9a": 80 }), "galat" in periksaIsian23B({ ...isi23, "1a": 0 })], [true, true]);
const rk23 = rekap23B([
  { nilai: { ...(h23 as any).nilai, "1a": 60 }, rata: 79.47 },
  { nilai: { ...(h23 as any).nilai, "1a": 100, "3a": 90 }, rata: 80.77 },
]);
const kel = (no: number) => rk23.kelompok.find((k) => k.no === no)!;
sama("rekap: responden, rata per responden, kualifikasi", [rk23.responden, rk23.rata, rk23.kualifikasi], [2, 80.12, "BAIK"]);
sama("rekap kelompok 1: butir 1a (60,100) = 80; kelompok = rata butirnya", [kel(1).perAspek[0].rata, kel(1).rata], [80, 80]);
sama("rekap kelompok 3: hanya 3a dinilai (1 responden)", [kel(3).perAspek.map((a) => a.n), kel(3).rata], [[1, 0, 0, 0], 90]);
sama("rekap kosong", [rekap23B([]).rata, rekap23B([]).kualifikasi, rekap23B([]).kelompok[0].rata], [null, null, null]);


console.log("# kelompok.ts — kelompok kecil peserta PKA/PKP");
sama("kelompok hanya PKA/PKP", [pakaiKelompok("PKA"), pakaiKelompok("PKP"), pakaiKelompok(null)], [true, true, false]);
sama("label kelompok", [labelKelompok({ nomor: 2 }), labelKelompok({ nomor: 3, nama: " Garuda " })], ["Kelompok 2", "Kelompok 3 — Garuda"]);
const pesK = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nomor: i + 1, instansi: i < 4 ? "Kab. A" : i < 7 ? "Kab. B" : "Kab. C" }));
const bk = bagiKelompok(pesK, 4);
const ukuran = [1, 2, 3, 4].map((n) => [...bk.values()].filter((x) => x === n).length);
sama("bagi 10 peserta ke 4 kelompok: merata 3/3/2/2", ukuran, [3, 3, 2, 2]);
sama("4 peserta Kab. A tersebar ke 4 kelompok berbeda", new Set(["p1", "p2", "p3", "p4"].map((id) => bk.get(id))).size, 4);
sama("pembagian tetap sama bila urutan masukan berbeda", JSON.stringify([...bagiKelompok([...pesK].reverse(), 4)].sort()), JSON.stringify([...bk].sort()));
sama("periksa: belum dibentuk / tanpa peserta", [periksaKelompok([], 5), periksaKelompok([], 0)], [["Kelompok belum dibentuk."], []]);
sama("periksa: 4 kelompok merata, semua masuk -> tanpa peringatan", periksaKelompok([10, 10, 10, 10], 0), []);
const pkr = periksaKelompok([12, 8, 0], 2);
sama("periksa: bukan 4 kelompok, tanpa kelompok, kosong, timpang", [pkr.length, /4 kelompok kecil.*saat ini 3/.test(pkr[0]), pkr[1], pkr[2], pkr[3]], [4, true, "2 peserta aktif belum masuk kelompok.", "1 kelompok belum punya anggota.", "Jumlah anggota tidak merata (8–12 orang)."]);


console.log("# surat-keterangan.ts — surat keterangan ditunda / tidak lulus");
sama("tambah hari kalender lintas bulan/tahun", [tambahHari("2026-10-14", 60), tambahHari("2026-12-20", 15)], ["2026-12-13", "2027-01-04"]);
const dasarSk = { program: "Pelatihan Kepemimpinan Administrator (PKA) Angkatan IV", mulai: "2026-07-01", selesai: "2026-10-14", peserta: { nama: "Budi", nip: "198601012010011001", jabatan: "Kepala Bagian", instansi: "Kab. Sumedang" } };
const skD = susunSuratKeterangan({
  ...dasarSk, jenis: "DITUNDA", perluRemedial: ["AKADEMIK", "AKTUALISASI_IMPLEMENTASI"], perluKeputusanTim: true,
  aspek: [{ kode: "AKADEMIK", label: "Evaluasi Akademik", nilai: 65, kualifikasi: "Kurang baik" }, { kode: "AKTUALISASI_IMPLEMENTASI", label: "Evaluasi Implementasi Aksi Perubahan", nilai: 68, kualifikasi: "Kurang baik" }],
});
sama("ditunda: judul, NIP berspasi, periode", [skD.judulStatus, skD.identitas[1][1], /pada tanggal 1 Juli s\.d\. 14 Oktober 2026/.test(skD.pernyataan), /DITUNDA KELULUSANNYA dengan aspek/.test(skD.pernyataan)], ["DITUNDA KELULUSANNYA", "19860101 201001 1 001", true, true]);
sama("ditunda: ketentuan akademik 14 hari kerja, implementasi 60 hari (13 Desember 2026), sikap diputus Tim, remedial 1 kali",
  [skD.ketentuan.length, /14 \(empat belas\) hari kerja/.test(skD.ketentuan[0]), /sampai dengan 13 Desember 2026/.test(skD.ketentuan[1]), /Sikap Perilaku/.test(skD.ketentuan[2]), /1 \(satu\) kali/.test(skD.ketentuan[3])], [4, true, true, true, true]);
const skT = susunSuratKeterangan({ ...dasarSk, jenis: "TIDAK_LULUS", perluRemedial: [], perluKeputusanTim: false, aspek: [] });
sama("tidak lulus: tanpa tabel aspek -> kalimat diakhiri titik; boleh diusulkan kembali sebagai peserta PKA", [skT.judulStatus, /TIDAK LULUS\.$/.test(skT.pernyataan), skT.ketentuan], ["TIDAK LULUS", true, ["Yang bersangkutan dapat diusulkan kembali menjadi peserta PKA pada kesempatan berikutnya paling banyak 1 (satu) kali."]]);


console.log("# penugasan-angkatan.ts — coach/mentor/penguji per angkatan, larangan rangkap, usulan mentor");
{
  sama("kunci orang: pegawai, email, lalu nama", [kunciOrang({ pegawaiId: "W1", nama: "A" }), kunciOrang({ nama: "A", email: " X@Y.go.id " }), kunciOrang({ nama: "  Budi   Santoso " })], ["P:W1", "E:x@y.go.id", "N:budi santoso"]);
  const ada = [
    { peran: "COACH", status: "AKTIF", orang: { pegawaiId: "W1", nama: "Bima" } },
    { peran: "PENGUJI", status: "DICABUT", orang: { pegawaiId: "W2", nama: "Arya" } },
    { peran: "MENTOR", status: "AKTIF", orang: { nama: "Kadis X", email: "kadis@x.go.id" } },
  ];
  sama("coach menjadi penguji -> ditolak", /Coach dan Penguji aktualisasi tidak boleh/.test(periksaRangkap(ada, { peran: "PENGUJI", orang: { pegawaiId: "W1", nama: "Bima" } }) ?? ""), true);
  sama("coach menjadi penguji akademik -> ditolak (EB-036)", periksaRangkap(ada, { peran: "PENGUJI_AKADEMIK", orang: { pegawaiId: "W1", nama: "Bima" } }) !== null, true);
  sama("coach menjadi coach kelompok lain -> boleh", periksaRangkap(ada, { peran: "COACH", orang: { pegawaiId: "W1", nama: "Bima" } }), null);
  sama("coach menjadi pendamping studi lapangan -> boleh", periksaRangkap(ada, { peran: "PENDAMPING_STULA", orang: { pegawaiId: "W1", nama: "Bima" } }), null);
  sama("penugasan yang sudah dicabut tidak dihitung", periksaRangkap(ada, { peran: "COACH", orang: { pegawaiId: "W2", nama: "Arya" } }), null);
  sama("mentor luar (email sama) menjadi penguji -> ditolak", periksaRangkap(ada, { peran: "PENGUJI", orang: { nama: "Kadis X.", email: "KADIS@x.go.id" } }) !== null, true);
  const periode = { mulai: "2026-09-01", selesai: "2026-12-31" };
  sama("isian: peran wajib", periksaIsianPenugasan({ peran: "KETUA" }, periode), "Pilih peran penugasan.");
  sama("isian: orang wajib", periksaIsianPenugasan({ peran: "COACH", pesertaIds: ["S1"] }, periode), "Pilih pegawai, atau isi nama orang luar (minimal 3 huruf).");
  sama("isian: coach perlu lingkup", periksaIsianPenugasan({ peran: "COACH", pegawaiId: "W1" }, periode), "Coach perlu lingkup: pilih peserta atau kelompok yang ditugaskan.");
  sama("isian: penguji akademik boleh tanpa lingkup", periksaIsianPenugasan({ peran: "PENGUJI_AKADEMIK", pegawaiId: "W1" }, periode), null);
  sama("isian: di luar periode", /di dalam periode/.test(periksaIsianPenugasan({ peran: "COACH", pegawaiId: "W1", kelompokIds: ["K1"], mulai: "2026-08-01" }, periode) ?? ""), true);
  sama("isian: selesai sebelum mulai", periksaIsianPenugasan({ peran: "COACH", pegawaiId: "W1", kelompokIds: ["K1"], mulai: "2026-10-10", selesai: "2026-10-01" }, periode), "Tanggal selesai lebih awal dari tanggal mulai.");
  sama("isian sah", periksaIsianPenugasan({ peran: "MENTOR", namaLuar: "Kadis X", pesertaIds: ["S1"], mulai: "2026-09-01", selesai: "2026-12-31" }, periode), null);
  sama("usulan mentor: nama & jabatan wajib", [periksaUsulanMentor({ nama: "Ab" }), periksaUsulanMentor({ nama: "Kadis X" })], ["Isi nama mentor (minimal 3 huruf).", "Isi jabatan mentor."]);
  sama("usulan mentor: email tidak sah", periksaUsulanMentor({ nama: "Kadis X", jabatan: "Kepala Dinas", email: "kadis@" }), "Alamat email mentor tidak sah.");
  sama("usulan mentor sah", periksaUsulanMentor({ nama: "Kadis X", jabatan: "Kepala Dinas", instansi: "Pemda Y", email: "kadis@pemday.go.id", ponsel: "0812 3456 7890" }), null);
}


console.log("# tugas.ts — alur tugas peserta (EB-038)");
{
  sama("peserta unggah saat draf / perlu revisi, tidak saat dikirim / diterima",
    [statusSesudah("DRAF", "UNGGAH").ok, statusSesudah("PERLU_REVISI", "UNGGAH").ok, statusSesudah("DIKIRIM", "UNGGAH").ok, statusSesudah("DITERIMA", "UNGGAH").ok], [true, true, false, false]);
  sama("kirim butuh berkas", [statusSesudah("DRAF", "KIRIM"), statusSesudah("DRAF", "KIRIM", { adaBerkas: true })],
    [{ ok: false, pesan: "Unggah berkas dulu sebelum mengirim." }, { ok: true, status: "DIKIRIM" }]);
  sama("kirim ulang setelah revisi", statusSesudah("PERLU_REVISI", "KIRIM", { adaBerkas: true }), { ok: true, status: "DIKIRIM" });
  sama("mulai tinjau hanya dari dikirim", [statusSesudah("DIKIRIM", "MULAI_TINJAU"), statusSesudah("DITINJAU", "MULAI_TINJAU").ok], [{ ok: true, status: "DITINJAU" }, false]);
  sama("revisi wajib catatan", [statusSesudah("DITINJAU", "REVISI", { catatan: "ok" }).ok, statusSesudah("DITINJAU", "REVISI", { catatan: "Perbaiki bab 2" })], [false, { ok: true, status: "PERLU_REVISI" }]);
  sama("terima dari dikirim / ditinjau; tidak dari draf", [statusSesudah("DIKIRIM", "TERIMA"), statusSesudah("DRAF", "TERIMA").ok], [{ ok: true, status: "DITERIMA" }, false]);
  sama("catatan tidak mengubah status, butuh isi, tidak untuk draf",
    [statusSesudah("DITERIMA", "CATATAN", { catatan: "Bagus" }), statusSesudah("DIKIRIM", "CATATAN", { catatan: " " }).ok, statusSesudah("DRAF", "CATATAN", { catatan: "x y" }).ok],
    [{ ok: true, status: "DITERIMA" }, false, false]);
  sama("setuju mentor: hanya RAP & oleh mentor; status tetap (TG-3)",
    [statusSesudah("DIKIRIM", "SETUJU_MENTOR", { jenis: "RANCANGAN_AKSI", peran: "MENTOR" }), statusSesudah("DIKIRIM", "SETUJU_MENTOR", { jenis: "LAPORAN_PROGRES", peran: "MENTOR" }).ok, statusSesudah("DIKIRIM", "SETUJU_MENTOR", { jenis: "RANCANGAN_AKSI", peran: "COACH" }).ok],
    [{ ok: true, status: "DIKIRIM" }, false, false]);
  sama("peran per jenis", [peranBolehAksi("RANCANGAN_AKSI", "COACH", "TERIMA"), peranBolehAksi("RANCANGAN_AKSI", "PENGAMPU", "TERIMA"), peranBolehAksi("TUGAS_PEMBELAJARAN", "PENGAMPU", "REVISI"), peranBolehAksi("RANCANGAN_AKSI", "COACH", "SETUJU_MENTOR")],
    [true, false, true, false]);

  const periode = { mulai: "2026-11-01", selesai: "2026-12-20" };
  const mp = ["PKA-A1-01"];
  sama("isian: jenis & judul wajib", [periksaIsianTugas({ judul: "Rancangan" }, periode, mp), periksaIsianTugas({ jenis: "RANCANGAN_AKSI", judul: "ab" }, periode, mp)],
    ["Pilih jenis tugas.", "Isi judul tugas (minimal 3 huruf)."]);
  sama("isian: tenggat di dalam periode", periksaIsianTugas({ jenis: "LAPORAN_PROGRES", judul: "Laporan 1", tenggat: "2027-01-05" }, periode, mp), "Tenggat harus di dalam periode diklat.");
  sama("isian: tugas pembelajaran butuh mata pelatihan program",
    [periksaIsianTugas({ jenis: "TUGAS_PEMBELAJARAN", judul: "Esai" }, periode, mp), periksaIsianTugas({ jenis: "TUGAS_PEMBELAJARAN", judul: "Esai", mataPelatihan: "PKP-A1-01" }, periode, mp), periksaIsianTugas({ jenis: "TUGAS_PEMBELAJARAN", judul: "Esai", mataPelatihan: "PKA-A1-01", tenggat: "2026-11-10" }, periode, mp)],
    ["Pilih mata pelatihan untuk tugas pembelajaran.", "Mata pelatihan bukan bagian dari program diklat ini.", null]);
  sama("isian: mata pelatihan hanya untuk tugas pembelajaran", periksaIsianTugas({ jenis: "RANCANGAN_AKSI", judul: "RAP", mataPelatihan: "PKA-A1-01" }, periode, mp), "Mata pelatihan hanya diisi untuk tugas pembelajaran.");

  const MB = 1024 * 1024;
  sama("berkas: format & ukuran (TG-4)", [
    periksaBerkasTugas({ nama: "rap.pdf", tipe: "application/pdf", ukuran: 3 * MB }),
    periksaBerkasTugas({ nama: "rap.docx", tipe: "", ukuran: 1000 }),
    periksaBerkasTugas({ nama: "rap.pdf", tipe: "application/pdf", ukuran: 11 * MB }),
    periksaBerkasTugas({ nama: "rap.zip", tipe: "application/zip", ukuran: 1000 }),
    periksaBerkasTugas({ nama: "rap.pdf", tipe: "image/png", ukuran: 1000 }),
  ], [null, null, "Ukuran berkas 11,0 MB, maksimal 10 MB.", "Format berkas harus PDF, DOCX, XLSX, PPTX, JPG, atau PNG.", "Ekstensi berkas tidak sesuai jenisnya."]);
  sama("tipe dari nama", [tipeDariNama("A.PPTX"), tipeDariNama("x.jpeg"), tipeDariNama("x.exe")],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/jpeg", null]);
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]);
  sama("isi sesuai tipe: Office = ZIP, PDF = %PDF", [
    isiSesuaiTipeTugas(zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    isiSesuaiTipeTugas(zip, "application/pdf"),
    isiSesuaiTipeTugas(new TextEncoder().encode("%PDF-1.7"), "application/pdf"),
    isiSesuaiTipeTugas(zip, "application/zip"),
  ], [true, false, true, false]);
  sama("rekap: peserta tanpa kiriman = belum", rekapKiriman(5, ["DIKIRIM", "DITERIMA", "DIKIRIM"]), { BELUM: 2, DRAF: 0, DIKIRIM: 2, DITINJAU: 0, PERLU_REVISI: 0, DITERIMA: 1 });
  sama("lama menunggu (hari)", [lamaMenunggu("2026-11-01T08:00:00Z", new Date("2026-11-09T09:00:00Z")), lamaMenunggu(null, new Date())], [8, 0]);
}

console.log("\n# sandi-awal.ts — kata sandi sementara acak & catatannya (EB-040)");
{
  const sandi = buatSandiSementara();
  sama("sandi acak: 12 karakter tanpa huruf/angka yang mudah tertukar", [sandi.length, /^[A-HJ-NP-Za-km-z2-9]+$/.test(sandi), buatSandiSementara(14).length], [12, true, 14]);
  sama("sandi acak: tidak berulang", new Set(Array.from({ length: 50 }, () => buatSandiSementara())).size, 50);
  const kunci = kunciSandiAwal("rahasia-uji-0123456789");
  sama("kunci: 32 byte, sama untuk rahasia yang sama, beda untuk rahasia lain",
    [kunci.length, kunci.equals(kunciSandiAwal("rahasia-uji-0123456789")), kunci.equals(kunciSandiAwal("rahasia-lain"))], [32, true, false]);
  const segel = segelSandi("Abc23xyzQRST", kunci);
  sama("segel: tidak memuat sandi teks polos, dibuka kembali utuh", [segel.includes("Abc23xyzQRST"), segel.startsWith("v1."), bukaSandi(segel, kunci)], [false, true, "Abc23xyzQRST"]);
  sama("segel: acak (IV baru setiap kali)", segelSandi("Abc23xyzQRST", kunci) === segel, false);
  const bagian = segel.split(".");
  const ubah = (i: number) => bagian.map((b, j) => (j === i ? (b[0] === "A" ? "B" : "A") + b.slice(1) : b)).join(".");
  sama("segel: kunci lain / isi, tag, IV diubah / tag dipotong / format salah -> null", [
    bukaSandi(segel, kunciSandiAwal("rahasia-lain")),
    bukaSandi(ubah(3), kunci), bukaSandi(ubah(2), kunci), bukaSandi(ubah(1), kunci),
    bukaSandi([bagian[0], bagian[1], bagian[2].slice(0, 8), bagian[3]].join("."), kunci),
    bukaSandi("v2." + bagian.slice(1).join("."), kunci), bukaSandi("bukan-segel", kunci),
  ], [null, null, null, null, null, null, null]);
  let galat = "";
  try { kunciSandiAwal(""); } catch (e) { galat = (e as Error).message; }
  sama("kunci: rahasia kosong ditolak", /kosong/.test(galat), true);
}

test("uji murni modul peserta (aplikasi lama)", () => {
  console.log(`HASIL: ${lulus} lulus, ${gagal} gagal`);
  assert.equal(gagal, 0);
});
