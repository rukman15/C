// Revisi kelompok (EB-046 s/d EB-050): acak, instansi+kabupaten, kategori stula.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JENIS_KELOMPOK_COACH, bagiAcak, bagiInstansiKabupaten, bagiPerKategori, kabupatenDari, pakaiCoach, tebakKategori } from "../src/lib/kelompok";

const orang = (n: number, instansi = "") => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nomor: i + 1, instansi }));
const jumlahPer = (m: Map<string, number>) => [...m.values()].reduce<Record<number, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});

test("coach melekat pada kelompok bimbingan & seminar, bukan e-learning", () => {
  assert.equal(JENIS_KELOMPOK_COACH, "SEMINAR");
  assert.equal(pakaiCoach("SEMINAR"), true);
  assert.equal(pakaiCoach("ELEARNING"), false);
});

test("e-learning acak: 40 peserta jadi 4 kelompok @10, bisa diulang dengan benih sama, berbeda dengan benih lain", () => {
  const p = orang(40);
  const a = bagiAcak(p, 4, 7);
  assert.deepEqual(jumlahPer(a), { 1: 10, 2: 10, 3: 10, 4: 10 });
  assert.deepEqual([...bagiAcak(p, 4, 7)], [...a]);
  assert.notDeepEqual([...bagiAcak(p, 4, 8)], [...a]);
  assert.deepEqual(jumlahPer(bagiAcak(orang(42), 4, 1)), { 1: 11, 2: 11, 3: 10, 4: 10 });
});

test("kabupaten/kota dibaca dari instansi atau jabatan", () => {
  assert.equal(kabupatenDari("Kepala Bidang Anggaran pada Badan Keuangan dan Aset Daerah Kabupaten Sumedang"), "Kabupaten Sumedang");
  assert.equal(kabupatenDari(null, "Sekretaris pada Dinas Sosial Pemerintah Kota Pontianak"), "Kota Pontianak");
  assert.equal(kabupatenDari("Lapas Kelas IIA Warung Kiara Kab. Sukabumi"), "Kabupaten Sukabumi");
  assert.equal(kabupatenDari("Pemkab Sumedang"), "Kabupaten Sumedang");
  assert.equal(kabupatenDari("Pemkot Bandung"), "Kota Bandung");
  assert.equal(kabupatenDari("Kementerian Imigrasi dan Pemasyarakatan RI"), null);
});

test("bimbingan & seminar: peserta sekabupaten dan seinstansi berkumpul, kelompok merata", () => {
  const p = [
    { id: "a", nomor: 1, instansi: "Dinas Sosial Kabupaten Kuningan" },
    { id: "b", nomor: 2, instansi: "Bappeda Kabupaten Sumedang" },
    { id: "c", nomor: 3, instansi: "Dinas Kesehatan Kabupaten Kuningan" },
    { id: "d", nomor: 4, instansi: "Diskominfo Kabupaten Sumedang" },
    { id: "e", nomor: 5, instansi: "BKPSDM Kabupaten Bandung" },
    { id: "f", nomor: 6, instansi: "Dinas Pendidikan Kabupaten Bandung" },
  ];
  const m = bagiInstansiKabupaten(p, 3);
  assert.equal(m.get("e"), m.get("f")); // Bandung
  assert.equal(m.get("a"), m.get("c")); // Kuningan
  assert.equal(m.get("b"), m.get("d")); // Sumedang
  assert.deepEqual(jumlahPer(m), { 1: 2, 2: 2, 3: 2 });
});

test("kategori stula ditebak dari jabatan/instansi (contoh berkas A.4 2026)", () => {
  assert.equal(tebakKategori("Kepala Bidang Pelayanan pada Dinas Kesehatan UOBK Rumah Sakit Umum Daerah 45 Kabupaten Kuningan"), "KESEHATAN");
  assert.equal(tebakKategori("Kepala Bidang Informatika pada Dinas Komunikasi, Informatika, Persandian dan Statistik"), "KOMINFO");
  assert.equal(tebakKategori("Kepala Bidang Hubungan Industrial pada Dinas Tenaga kerja dan Transmigrasi"), "EKONOMI");
  assert.equal(tebakKategori(null, "Kecamatan Jatinangor"), "KECAMATAN");
  assert.equal(tebakKategori("Kepala Sub Bagian Tata Usaha Lapas Narkotika"), "LAINNYA");
});

test("stula per kategori: satu kategori tidak dipecah, kategori besar disebar ke kelompok berbeda", () => {
  const p = [
    ...["k1", "k2", "k3", "k4"].map((id, i) => ({ id, nomor: i + 1, kategori: "KESEHATAN" })),
    ...["m1", "m2", "m3"].map((id, i) => ({ id, nomor: 10 + i, kategori: "KOMINFO" })),
    ...["e1", "e2"].map((id, i) => ({ id, nomor: 20 + i, kategori: "EKONOMI" })),
    { id: "c1", nomor: 30, kategori: "KECAMATAN" },
  ];
  const { nomor, kategori } = bagiPerKategori(p, 2);
  assert.equal(new Set(["k1", "k2", "k3", "k4"].map((x) => nomor.get(x))).size, 1);
  assert.notEqual(nomor.get("k1"), nomor.get("m1"));
  assert.deepEqual(jumlahPer(nomor), { 1: 5, 2: 5 });
  assert.deepEqual([...kategori.values()].flat().sort(), ["EKONOMI", "KECAMATAN", "KESEHATAN", "KOMINFO"]);
});
