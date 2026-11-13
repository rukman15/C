// Bentrok jadwal, rentang tanggal, dan tempelan peserta (sama dengan aplikasi lama).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hariAjarFisik, irisanHari, periodeSurat, pesanBentrok, rapikanRentang } from "../src/lib/rentang";
import { parseTempelanPeserta, rapikanNip } from "../src/lib/peserta";
import { melebihiKapasitas } from "../src/lib/kapasitas";

test("rentang: digabung, diurutkan, irisan per hari", () => {
  assert.deepEqual(rapikanRentang([{ mulai: "2026-11-05", selesai: "2026-11-06" }, { mulai: "2026-11-01", selesai: "2026-11-04" }]), [{ mulai: "2026-11-01", selesai: "2026-11-06" }]);
  assert.deepEqual(irisanHari([{ mulai: "2026-11-01", selesai: "2026-11-05" }], [{ mulai: "2026-11-04", selesai: "2026-11-09" }]), ["2026-11-04", "2026-11-05"]);
  assert.equal(periodeSurat("2026-09-30", "2026-10-02"), "30 September s.d. 2 Oktober 2026");
});

test("bentrok: hanya tingkat cegah yang jadi pesan galat", () => {
  const pesan = pesanBentrok((id) => (id === "a" ? "Budi" : id), {
    a: [
      { jenis: "cuti", keterangan: "Cuti Tahunan", tanggal: ["2026-11-10"], tingkat: "cegah" },
      { jenis: "penugasan-wi", keterangan: "mengajar e-learning X", tanggal: ["2026-11-11"], tingkat: "peringatan" },
    ],
  });
  assert.equal(pesan, "Bentrok jadwal — Budi: Cuti Tahunan (10 November 2026)");
  assert.equal(pesanBentrok(() => "", { a: [] }), null);
  assert.equal(hariAjarFisik("KLASIKAL", null), true);
  assert.equal(hariAjarFisik(null, "Zoom kelas B"), false);
});

test("kapasitas: tanpa batas tidak pernah melebihi", () => {
  assert.equal(melebihiKapasitas(18, 20, 4), true);
  assert.equal(melebihiKapasitas(10, 20, 4), false);
  assert.equal(melebihiKapasitas(100, null, 4), false);
});

test("peserta: NIP dirapikan dan tempelan Excel dibaca", () => {
  assert.equal(rapikanNip("1980 0101.2005-01 1 001").nip, "198001012005011001");
  assert.ok(rapikanNip("1,98E+17").galat);
  const h = parseTempelanPeserta("No\tNama\tNIP\tInstansi\n1\tBudi\t198001012005011001\tPemkab A\n2\tSiti\t198001012005011001\tPemkab B");
  assert.equal(h.baris.length, 1);
  assert.equal(h.baris[0]?.nama, "Budi");
  assert.equal(h.galat.length, 1); // NIP kembar di baris kedua
});
