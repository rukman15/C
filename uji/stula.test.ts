// Studi lapangan (EB-049, EB-050, EB-053): pencocokan lokasi dan peringatan H-7.
import { test } from "node:test";
import assert from "node:assert/strict";
import { batasPenetapan, cocokkanLokasi, peringatanStula } from "../src/lib/stula";

test("batas penetapan lokasi = H-7 sebelum studi lapangan", () => {
  assert.equal(batasPenetapan("2026-09-09"), "2026-09-02");
});

test("lokasi LAYAK dipasangkan ke kelompok dengan kategori yang sama; satu lokasi satu kelompok", () => {
  const m = cocokkanLokasi(
    [
      { id: "k1", kategori: "Kesehatan/RSUD, Perencanaan (Bappeda)", adaLokasi: false },
      { id: "k2", kategori: "Kesehatan/RSUD", adaLokasi: false },
      { id: "k3", kategori: "Kominfo", adaLokasi: true },
      { id: "k4", kategori: "Kecamatan", adaLokasi: false },
    ],
    [
      { id: "l1", kategori: "KESEHATAN", status: "LAYAK", kelompokId: null },
      { id: "l2", kategori: "KOMINFO", status: "LAYAK", kelompokId: null },
      { id: "l3", kategori: "KECAMATAN", status: "CALON", kelompokId: null },
      { id: "l4", kategori: "KESEHATAN", status: "LAYAK", kelompokId: "lain" },
    ],
  );
  assert.deepEqual([...m], [["k1", "l1"]]);
});

test("peringatan baru muncul mulai H-7, menyebut kelompok tanpa lokasi, tanpa ketua tim, dan belum layak", () => {
  const kelompok = [
    { label: "Kelompok 1", lokasi: { nama: "RSUD", status: "LAYAK", ketuaTim: "Pak A" } },
    { label: "Kelompok 2", lokasi: null },
    { label: "Kelompok 3", lokasi: { nama: "Kec. X", status: "CALON", ketuaTim: null } },
  ];
  assert.deepEqual(peringatanStula({ mulaiStula: "2026-09-09", hariIni: "2026-09-01", kelompok }), []);
  assert.deepEqual(peringatanStula({ mulaiStula: null, hariIni: "2026-09-08", kelompok }), []);
  assert.deepEqual(peringatanStula({ mulaiStula: "2026-09-09", hariIni: "2026-09-02", kelompok }), [
    "Belum punya lokasi: Kelompok 2.",
    "Lokasi belum punya ketua tim: Kelompok 3.",
    "Lokasi belum dinyatakan layak: Kelompok 3 (Kec. X).",
  ]);
});
