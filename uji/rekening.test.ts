// Rekening mentor daring (EB-045).
import { test } from "node:test";
import assert from "node:assert/strict";
import { milikMentor, periksaRekening, samarkan, statusRekening } from "../src/lib/rekening-mentor";

test("isian rekening dirapikan dan diperiksa", () => {
  assert.deepEqual(periksaRekening({ namaBank: " BJB ", nomorRekening: "0012-3456 789", atasNama: "Fauzi  Harahap", ponsel: "0812 3456 7890" }), {
    rapi: { namaBank: "BJB", nomorRekening: "00123456789", atasNama: "Fauzi Harahap", ponsel: "081234567890" },
  });
  assert.ok("galat" in periksaRekening({ namaBank: "BJB", nomorRekening: "12ab", atasNama: "Fauzi", ponsel: "081234567890" }));
  assert.ok("galat" in periksaRekening({ namaBank: "BJB", nomorRekening: "1234567", atasNama: "Fauzi", ponsel: "12345" }));
  assert.ok("galat" in periksaRekening({ namaBank: "", nomorRekening: "1234567", atasNama: "Fauzi", ponsel: "081234567890" }));
});

test("nomor disamarkan untuk peserta", () => {
  assert.equal(samarkan("00123456789"), "•••• 6789");
  assert.equal(samarkan("123"), "••••");
});

test("rekening melekat pada mentor: mentor diganti → perlu diisi ulang", () => {
  assert.ok(milikMentor("FAUZI HARAHAP, AMd.IP., S.H.", "Fauzi Harahap AMd IP SH"));
  assert.equal(statusRekening({ mentorDaring: false, mentorNama: "A", rekening: null }), "TIDAK_PERLU");
  assert.equal(statusRekening({ mentorDaring: true, mentorNama: "Fauzi", rekening: null }), "BELUM");
  assert.equal(statusRekening({ mentorDaring: true, mentorNama: "Fauzi", rekening: { mentorNama: "Fauzi" } }), "TERISI");
  assert.equal(statusRekening({ mentorDaring: true, mentorNama: "Ishadi", rekening: { mentorNama: "Fauzi" } }), "PERLU_ULANG");
});
