// Jadwal Diklat: hitungan tampilan dan skema isian (sama dengan aplikasi lama).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cocokCari, diklatPadaTanggal, geserBulan, gridBulan, kemajuan, lamaHari, periodeTeks } from "../src/lib/jadwal";
import { skemaTraining, labelKategori } from "../src/lib/skema-training";
import { periksaTimTujuan } from "../src/lib/tim-kerja";

test("kemajuan: sebelum, selama, sesudah", () => {
  const d = { startDate: "2026-11-10", endDate: "2026-11-19" };
  assert.deepEqual(kemajuan(d, "2026-11-09"), { label: "Mulai besok", persen: null });
  assert.deepEqual(kemajuan(d, "2026-11-01"), { label: "Mulai 9 hari lagi", persen: null });
  assert.deepEqual(kemajuan(d, "2026-11-12"), { label: "Hari ke-3 dari 10", persen: 30 });
  assert.deepEqual(kemajuan(d, "2026-11-20"), { label: "Selesai kemarin", persen: null });
  assert.deepEqual(kemajuan({ startDate: "2026-11-12" }, "2026-11-12"), { label: "Hari ini", persen: 100 });
});

test("lama hari: tanpa tanggal selesai = 1 hari, selesai keliru diabaikan", () => {
  assert.equal(lamaHari({ startDate: "2026-11-10", endDate: "2026-11-19" }), 10);
  assert.equal(lamaHari({ startDate: "2026-11-10" }), 1);
  assert.equal(lamaHari({ startDate: "2026-11-10", endDate: "2026-11-01" }), 1);
});

test("periode ringkas", () => {
  assert.equal(periodeTeks("2026-11-03"), "3 Nov 2026");
  assert.equal(periodeTeks("2026-11-03", "2026-11-07"), "3–7 Nov 2026");
  assert.equal(periodeTeks("2026-10-28", "2026-11-02"), "28 Okt – 2 Nov 2026");
  assert.equal(periodeTeks("2026-12-29", "2027-01-02"), "29 Des 2026 – 2 Jan 2027");
});

test("kalender: 42 hari mulai Senin, bulan bergeser lintas tahun", () => {
  const g = gridBulan(2026, 11); // 1 Nov 2026 hari Minggu
  assert.equal(g.length, 42);
  assert.equal(g[0], "2026-10-26");
  assert.ok(g.includes("2026-11-30"));
  assert.deepEqual(geserBulan(2026, 12, 1), { tahun: 2027, bulan: 1 });
  assert.deepEqual(geserBulan(2026, 1, -1), { tahun: 2025, bulan: 12 });
});

test("diklat pada tanggal dan pencarian", () => {
  const daftar = [
    { name: "PKA Angkatan IV", tempat: "Jatinangor", startDate: "2026-11-10", endDate: "2026-11-19" },
    { name: "Diklat Teknis", tempat: "Bandung", startDate: "2026-11-20" },
  ];
  assert.deepEqual(diklatPadaTanggal(daftar, "2026-11-19").map((d) => d.name), ["PKA Angkatan IV"]);
  assert.deepEqual(diklatPadaTanggal(daftar, "2026-11-20").map((d) => d.name), ["Diklat Teknis"]);
  assert.equal(cocokCari(daftar[0], "Manajerial", "pka jatinangor"), true);
  assert.equal(cocokCari(daftar[0], "Manajerial", "manajerial"), true);
  assert.equal(cocokCari(daftar[1], "Teknis Umum", "pka"), false);
});

test("skema: isian benar, tanggal terbalik, kategori tak dikenal", () => {
  const dasar = { name: "Diklat", category: "teknis-umum", startDate: "2026-11-10", endDate: "2026-11-12" };
  assert.equal(skemaTraining.safeParse(dasar).success, true);
  const terbalik = skemaTraining.safeParse({ ...dasar, endDate: "2026-11-01" });
  assert.equal(terbalik.success, false);
  assert.equal(terbalik.error?.issues[0]?.message, "Tanggal selesai tidak boleh sebelum tanggal mulai");
  assert.equal(skemaTraining.safeParse({ ...dasar, category: "lain" }).success, false);
  assert.equal(skemaTraining.safeParse({ ...dasar, startDate: "2026-02-30" }).success, false);
  assert.equal(skemaTraining.safeParse({ ...dasar, name: "  " }).success, false);
  assert.equal(labelKategori("jafung"), "Jabatan Fungsional");
});

test("tim tujuan: anggota tim wajib timnya sendiri, Ketua Diklat bebas", () => {
  assert.equal(periksaTimTujuan({ role: "ketua-diklat", timIds: [] }, null), null);
  assert.equal(periksaTimTujuan({ role: "pamdal", timIds: ["t1"] }, null), "Pilih tim kerja pemegang diklat ini.");
  assert.equal(periksaTimTujuan({ role: "pamdal", timIds: ["t1"] }, "t2"), "Anda hanya bisa memilih tim kerja Anda sendiri.");
  assert.equal(periksaTimTujuan({ role: "pamdal", timIds: ["t1"] }, "t1"), null);
});

test("kalender: jalur per minggu tetap sejajar", async () => {
  const { jalurMinggu } = await import("../src/lib/jadwal");
  const minggu = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const a = { id: "a", startDate: "2026-11-03", endDate: "2026-11-28" };
  const b = { id: "b", startDate: "2026-11-10", endDate: "2026-11-11" };
  const c = { id: "c", startDate: "2026-11-12", endDate: "2026-11-13" };
  const j = jalurMinggu([c, b, a], minggu).map((hari) => hari.map((d) => d?.id ?? "-").join(""));
  // a selalu di jalur 1; b dan c berbagi jalur 2 karena tidak beririsan.
  assert.deepEqual(j, ["a-", "ab", "ab", "ac", "ac", "a-", "a-"]);
});
