// Jadwal pembelajaran & absensi: aturan murni (sama dengan aplikasi lama).
import { test } from "node:test";
import assert from "node:assert/strict";
import { periksaPresensiHarian, rapikanJam, wajibHadir } from "../src/lib/kehadiran";
import { perubahanKehadiran, sesiPerHari, skemaAksiMasaTempatKerja, skemaSimpanKehadiran, skemaTambahSesiPembelajaran, skemaUbahSesiPembelajaran } from "../src/lib/data-pembelajaran";
import { rapikanRingkasan } from "../src/lib/aktivitas";

test("jam mulai dirapikan; jam tidak sah ditolak", () => {
  assert.equal(rapikanJam("8.30"), "08:30");
  assert.equal(rapikanJam("08:00"), "08:00");
  assert.equal(rapikanJam("24:00"), null);
  assert.equal(rapikanJam("pagi"), null);
});

test("asinkron dan mandiri tidak wajib hadir", () => {
  assert.equal(wajibHadir("KLASIKAL"), true);
  assert.equal(wajibHadir("LAPANGAN"), true);
  assert.equal(wajibHadir("ASINKRON"), false);
  assert.equal(wajibHadir("MANDIRI"), false);
});

test("presensi harian: hari tanpa sesi dan sesi belum lengkap, akhir pekan & masa tempat kerja dilewati", () => {
  const dasar = {
    mulai: "2026-11-02", // Senin
    selesai: "2026-11-10",
    hariIni: "2026-11-09",
    pesertaAktif: 3,
    sesi: [
      { tanggal: "2026-11-02", tercatat: 3 },
      { tanggal: "2026-11-03", tercatat: 2 },
    ],
  };
  const r = periksaPresensiHarian({ ...dasar, lewatiAkhirPekan: true, kecuali: [{ mulai: "2026-11-05", selesai: "2026-11-06" }] });
  assert.deepEqual(r.belumLengkap, ["2026-11-03"]);
  assert.deepEqual(r.tanpaSesi, ["2026-11-04", "2026-11-09"]);
});

test("skema sesi: JP 1..24, tanggal kalender, ubah tanpa isi ditolak", () => {
  assert.equal(skemaTambahSesiPembelajaran.safeParse({ sesi: [{ tanggal: "2026-11-03", kegiatan: "Pembukaan", jp: 2 }] }).success, true);
  assert.equal(skemaTambahSesiPembelajaran.safeParse({ sesi: [{ tanggal: "2026-02-30", kegiatan: "X", jp: 2 }] }).success, false);
  assert.equal(skemaTambahSesiPembelajaran.safeParse({ sesi: [{ tanggal: "2026-11-03", kegiatan: "X", jp: 25 }] }).success, false);
  assert.equal(skemaTambahSesiPembelajaran.safeParse({ sesi: [] }).success, false);
  assert.equal(skemaUbahSesiPembelajaran.safeParse({}).success, false);
  assert.equal(skemaSimpanKehadiran.safeParse({ kehadiran: [{ pesertaId: "p", status: "ALPA" }] }).success, false);
  assert.equal(skemaSimpanKehadiran.safeParse({ kehadiran: [{ pesertaId: "p", status: null }] }).success, true);
  assert.equal(skemaAksiMasaTempatKerja.safeParse({ aksi: "tambah", jenis: "AKTUALISASI", mulai: "2026-11-01", selesai: "2026-11-05" }).success, true);
});

test("lembar: hanya baris berubah yang dikirim; keterangan dibuang untuk hadir", () => {
  const baris = [
    { pesertaId: "a", nomor: 1, nama: "A", statusPeserta: "AKTIF" as const, status: null },
    { pesertaId: "b", nomor: 2, nama: "B", statusPeserta: "AKTIF" as const, status: "HADIR" as const },
    { pesertaId: "c", nomor: 3, nama: "C", statusPeserta: "AKTIF" as const, status: "TIDAK_HADIR" as const, keterangan: "sakit" },
  ];
  const kirim = perubahanKehadiran(baris, {
    a: { status: "HADIR", keterangan: "abaikan" },
    b: { status: "HADIR", keterangan: "" },
    c: { status: "TIDAK_HADIR", keterangan: " sakit " },
  });
  assert.deepEqual(kirim, [{ pesertaId: "a", status: "HADIR", keterangan: null }]);
  assert.deepEqual(perubahanKehadiran(baris, { c: { status: null, keterangan: "sakit" } }), [{ pesertaId: "c", status: null, keterangan: null }]);
});

test("sesi dikelompokkan per hari dengan jumlah JP", () => {
  const g = sesiPerHari([
    { tanggal: "2026-11-03", jp: 2 },
    { tanggal: "2026-11-03", jp: 4 },
    { tanggal: "2026-11-04", jp: 6 },
  ]);
  assert.deepEqual(g.map((x) => [x.tanggal, x.jp, x.sesi.length]), [["2026-11-03", 6, 2], ["2026-11-04", 6, 1]]);
  assert.equal(rapikanRingkasan("a   b\n c"), "a b c");
});
