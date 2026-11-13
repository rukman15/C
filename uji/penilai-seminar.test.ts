// Penilai seminar (EB-056): penguji dan coach peserta itu; nilainya dirata-rata.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bolehNilaiSeminar, nilaiAspek } from "../src/lib/penilaian";

const penguji = new Map([["p1", { RAP: "wi-a", LAP: "wi-b" }]]);
const coach = new Map([["p1", "wi-c"]]);

test("nilai seminar hanya penguji (per RAP/LAP) dan coach peserta itu", () => {
  const cek = (jenisEvaluasi: Parameters<typeof bolehNilaiSeminar>[0]["jenisEvaluasi"], pegawaiId: string | null, pesertaId = "p1") =>
    bolehNilaiSeminar({ jenisEvaluasi, pesertaId, pegawaiId, penguji, coach });
  assert.equal(cek("AKTUALISASI_RANCANGAN", "wi-a"), true, "penguji RAP");
  assert.equal(cek("AKTUALISASI_IMPLEMENTASI", "wi-a"), false, "penguji RAP bukan penguji LAP");
  assert.equal(cek("AKTUALISASI_IMPLEMENTASI", "wi-b"), true, "penguji LAP");
  assert.equal(cek("AKTUALISASI_RANCANGAN", "wi-c"), true, "coach RAP");
  assert.equal(cek("AKTUALISASI_IMPLEMENTASI", "wi-c"), true, "coach LAP");
  assert.equal(cek("AKTUALISASI_RANCANGAN", "wi-d"), false, "WI lain");
  assert.equal(cek("AKTUALISASI_RANCANGAN", "wi-a", "p2"), false, "peserta lain");
  assert.equal(cek("AKTUALISASI_RANCANGAN", null), false);
  assert.equal(cek("AKADEMIK", "wi-d"), true, "aspek non-seminar tidak dibatasi aturan ini");
});

test("isian penguji dan coach dirata-rata; nilai rekap Ketua Diklat didahulukan", () => {
  assert.equal(
    nilaiAspek([
      { nilai: 80, sumber: "PENILAI" },
      { nilai: 90, sumber: "PENILAI" },
    ]).nilai,
    85,
  );
  assert.equal(
    nilaiAspek([
      { nilai: 80, sumber: "PENILAI" },
      { nilai: 90, sumber: "PENILAI" },
      { nilai: 70, sumber: "REKAP" },
    ]).nilai,
    70,
  );
});
