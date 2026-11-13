// Seminar per kelompok (EB-055): jam 45 menit per peserta dengan istirahat, pola lembar K RAP/K LAP balai.
import { test } from "node:test";
import assert from "node:assert/strict";
import { jamSelesai, periksaSeminarKelompok, slotSeminar } from "../src/lib/seminar";

const IST = { mulai: "11:45", selesai: "12:30" };

test("10 peserta mulai 08.00, 45 menit, istirahat 11.45–12.30 sama dengan lembar K RAP", () => {
  const s = slotSeminar("08:00", 45, 10, IST).map((x) => x && `${x.mulai}-${x.selesai}`);
  assert.deepEqual(s, ["08:00-08:45", "08:45-09:30", "09:30-10:15", "10:15-11:00", "11:00-11:45", "12:30-13:15", "13:15-14:00", "14:00-14:45", "14:45-15:30", "15:30-16:15"]);
});

test("slot yang menabrak awal istirahat digeser ke akhir istirahat", () => {
  assert.deepEqual(
    slotSeminar("11:30", 30, 2, IST).map((x) => x?.mulai),
    ["12:30", "13:00"],
  );
});

test("tanpa istirahat jam berurutan; jam tidak valid atau lewat tengah malam → null", () => {
  assert.deepEqual(
    slotSeminar("08:00", 45, 2, null).map((x) => x?.mulai),
    ["08:00", "08:45"],
  );
  assert.deepEqual(slotSeminar("8:00", 45, 2), [null, null]);
  assert.deepEqual(
    slotSeminar("23:00", 45, 2).map((x) => x?.mulai ?? null),
    ["23:00", null],
  );
  assert.equal(jamSelesai("08:00", 45), "08:45");
  assert.equal(jamSelesai(null, 45), null);
});

test("pengaturan kelompok diperiksa: istirahat berpasangan, durasi, HP evaluator, tautan", () => {
  assert.deepEqual(periksaSeminarKelompok({ tanggal: "2026-09-22", jamMulai: "08:00", durasiMenit: 45, istirahatMulai: "11:45", istirahatSelesai: "12:30" }), {
    tautanDaring: null,
  });
  assert.ok("galat" in periksaSeminarKelompok({ istirahatMulai: "11:45" }));
  assert.ok("galat" in periksaSeminarKelompok({ istirahatMulai: "12:30", istirahatSelesai: "11:45" }));
  assert.ok("galat" in periksaSeminarKelompok({ durasiMenit: 5 }));
  assert.ok("galat" in periksaSeminarKelompok({ evaluatorPonsel: "abc" }));
  assert.ok("galat" in periksaSeminarKelompok({ tautanDaring: "bukan tautan" }));
  assert.deepEqual(periksaSeminarKelompok({ evaluatorPonsel: "0857-0345-3244", tautanDaring: "https://zoom.us/j/1" }), { tautanDaring: "https://zoom.us/j/1" });
});
