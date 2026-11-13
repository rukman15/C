// Token titipan unggah langsung ke Supabase (lolos batas ±4,5 MB Vercel).
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.BBPKA_SESSION_SECRET = "rahasia-uji-yang-panjang-sekali";
const { bacaTitipan, buatTitipan } = await import("../src/lib/server/titipan");
const { MAKS_TITIPAN } = await import("../src/lib/unggah");

test("token titipan mengikat jalur, pemilik, nama, tipe; berlaku 1 jam", () => {
  const t0 = Date.UTC(2026, 10, 13);
  const t = buatTitipan({ nama: "bahan.pptx", tipe: "application/vnd.openxmlformats-officedocument.presentationml.presentation", email: "a@b", jenis: "berkas-peserta" }, t0);
  assert.match(t.path, /^titipan\/[0-9a-f-]{36}$/);
  const isi = bacaTitipan(t.token, t0 + 1000);
  assert.equal(isi?.p, t.path);
  assert.equal(isi?.e, "a@b");
  assert.equal(isi?.n, "bahan.pptx");
  assert.equal(bacaTitipan(t.token, t0 + 61 * 60 * 1000), null, "kedaluwarsa");
});

test("token yang diubah ditolak", () => {
  const t = buatTitipan({ nama: "a.pdf", tipe: "application/pdf", email: "a@b", jenis: "tugas" });
  const [badan, tanda] = t.token.split(".");
  const palsu = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(badan, "base64url").toString()), e: "c@d" })).toString("base64url");
  assert.equal(bacaTitipan(`${palsu}.${tanda}`), null);
  assert.equal(bacaTitipan("bukan-token"), null);
});

test("batas ukuran per jenis unggahan", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(MAKS_TITIPAN).map(([k, v]) => [k, v / 1024 / 1024])), { "berkas-peserta": 20, tugas: 10, dokumen: 2, kunjungan: 10 });
});
