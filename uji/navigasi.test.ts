// Menu per akun: harus sama dengan aplikasi lama (uji/murni.test.ts, bagian navigasi).
import { test } from "node:test";
import assert from "node:assert/strict";
import { judulDariAlamat, menuAkun, menuAktif, pintasan, type AkunMenu } from "../src/lib/navigasi";
import { rapikanJabatanSurat } from "../src/lib/jabatan";

const akun = (role: AkunMenu["role"], o: Partial<AkunMenu> = {}): AkunMenu => ({ role, pegawaiId: null, koordinatorWi: false, anggotaTimDiklat: false, ...o });
const ringkas = (a: AkunMenu) => Object.fromEntries(menuAkun(a).kelompok.map((k) => [k.label, k.butir.map((b) => b.label)]));

test("menu: staf umum tertaut pegawai", () => {
  assert.deepEqual(ringkas(akun("peserta", { pegawaiId: "P1" })), {
    Saya: ["Diklat Saya", "Surat Tugas Saya", "Disposisi untuk Saya", "Akun & Kata Sandi"],
    Diklat: ["Jadwal Diklat"],
  });
});

test("menu: WI biasa dan Koordinator WI", () => {
  assert.deepEqual(ringkas(akun("widyaiswara", { pegawaiId: "W1" })).Diklat, ["Jadwal Diklat", "Bank Soal", "Beban JP Widyaiswara", "Dokumen Penugasan", "Ruang Coaching"]);
  assert.deepEqual(ringkas(akun("widyaiswara", { pegawaiId: "W1", koordinatorWi: true })).Diklat, [
    "Jadwal Diklat",
    "Cek Bentrokan",
    "Bank Soal",
    "Beban JP Widyaiswara",
    "Batas JP Widyaiswara",
    "Dokumen Penugasan",
    "Ruang Coaching",
  ]);
});

test("menu: admin melihat semua kelompok tanpa alamat ganda", () => {
  const adm = menuAkun(akun("admin"));
  const href = adm.kelompok.flatMap((k) => k.butir.map((b) => b.href));
  assert.deepEqual(adm.kelompok.map((k) => k.label), ["Saya", "Diklat", "Persuratan", "Kepegawaian", "Pimpinan", "Pengaturan"]);
  assert.equal(new Set(href).size, href.length);
});

test("pintasan Kepala Balai: Saya tanpa Akun lalu kelompok kerja, maks 6", () => {
  assert.deepEqual(
    pintasan(menuAkun(akun("kepala-balai", { pegawaiId: "K" }))).map((b) => b.label),
    ["Surat Tugas Saya", "Disposisi untuk Saya", "Jadwal Diklat", "Cek Bentrokan", "Beban JP Widyaiswara", "Dokumen Penugasan"],
  );
});

test("judul dan butir aktif dari alamat", () => {
  assert.deepEqual(
    [judulDariAlamat("/dashboard"), judulDariAlamat("/dashboard/persuratan/surat-masuk"), judulDariAlamat("/dashboard/tidak-ada")],
    ["Beranda", "Surat Masuk", null],
  );
  assert.equal(menuAktif("/dashboard/jadwal", "/dashboard"), false);
  assert.equal(menuAktif("/dashboard/jadwal/abc", "/dashboard/jadwal"), true);
});

test("jabatan kapital dirapikan untuk tampilan", () => {
  assert.equal(rapikanJabatanSurat("WIDYAISWARA AHLI UTAMA"), "Widyaiswara Ahli Utama");
  assert.equal(rapikanJabatanSurat("KEPALA BAGIAN TU"), "Kepala Bagian TU");
});
