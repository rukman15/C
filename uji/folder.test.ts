// Folder peserta (EB-051): aturan berkas bahan tayang dan sertifikat self learning.
import { test } from "node:test";
import assert from "node:assert/strict";
import { UKURAN_MAKS_BERKAS, isJenisBerkas, isiSesuaiTipeBerkas, periksaBerkasPeserta, terimaBerkas, tipeDariNamaBerkas } from "../src/lib/berkas-peserta";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

test("jenis berkas folder dikenali; persyaratan bukan jenis folder", () => {
  assert.equal(isJenisBerkas("BAHAN_TAYANG_RAP"), true);
  assert.equal(isJenisBerkas("SERTIFIKAT_MANDIRI"), true);
  assert.equal(isJenisBerkas("PAKTA_INTEGRITAS"), false);
});

test("bahan tayang: PPTX atau PDF, maks 20 MB; tipe dari ekstensi bila browser mengirim octet-stream", () => {
  assert.deepEqual(periksaBerkasPeserta("BAHAN_TAYANG_RAP", { nama: "rap.pptx", tipe: "application/octet-stream", ukuran: 5_000_000 }), { tipe: PPTX });
  assert.deepEqual(periksaBerkasPeserta("BAHAN_TAYANG_LAP", { nama: "LAP.PDF", tipe: "application/pdf", ukuran: 1000 }), { tipe: "application/pdf" });
  assert.ok("galat" in periksaBerkasPeserta("BAHAN_TAYANG_RAP", { nama: "rap.jpg", tipe: "image/jpeg", ukuran: 1000 }));
  assert.ok("galat" in periksaBerkasPeserta("BAHAN_TAYANG_RAP", { nama: "rap.pptx", tipe: PPTX, ukuran: UKURAN_MAKS_BERKAS + 1 }));
  assert.ok("galat" in periksaBerkasPeserta("BAHAN_TAYANG_RAP", { nama: "rap.pptx", tipe: PPTX, ukuran: 0 }));
});

test("sertifikat: PDF/JPG/PNG, bukan PPTX; ekstensi harus sesuai tipe kiriman", () => {
  assert.deepEqual(periksaBerkasPeserta("SERTIFIKAT_MANDIRI", { nama: "sertifikat.jpeg", tipe: "image/jpeg", ukuran: 1000 }), { tipe: "image/jpeg" });
  assert.ok("galat" in periksaBerkasPeserta("SERTIFIKAT_MANDIRI", { nama: "s.pptx", tipe: PPTX, ukuran: 1000 }));
  assert.ok("galat" in periksaBerkasPeserta("SERTIFIKAT_MANDIRI", { nama: "s.pdf", tipe: "image/png", ukuran: 1000 }));
  assert.ok("galat" in periksaBerkasPeserta("LAINNYA", { nama: "s.pdf", tipe: "application/pdf", ukuran: 1000 }));
});

test("isi berkas dicek dari tanda tangan biner, bukan nama", () => {
  assert.equal(isiSesuaiTipeBerkas(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), "application/pdf"), true);
  assert.equal(isiSesuaiTipeBerkas(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), PPTX), true);
  assert.equal(isiSesuaiTipeBerkas(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "application/pdf"), false);
  assert.equal(tipeDariNamaBerkas("a.b.PNG"), "image/png");
  assert.equal(terimaBerkas("BAHAN_TAYANG_RAP"), ".pptx,.pdf");
});
