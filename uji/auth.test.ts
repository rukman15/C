// Uji logika masuk tanpa database. Jalankan: npm run uji
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.BBPKA_SESSION_SECRET = "rahasia-uji-yang-panjang-sekali";

const { signSession, verifySession } = await import("../src/lib/server/session");
const { hashPassword, verifyPassword } = await import("../src/lib/server/password");
const { createLoginLimiter, LOGIN_LIMITS } = await import("../src/lib/server/rate-limit");
const { inisial } = await import("../src/lib/teks");

const dasar = { email: "a@x.go.id", role: "widyaiswara" as const, name: "Budi", pegawaiId: "p1", jabatan: "WIDYAISWARA AHLI MADYA", sv: 2 };

test("sesi: tanda tangan lalu dibaca kembali", () => {
  const s = verifySession(signSession(dasar));
  assert.equal(s?.email, "a@x.go.id");
  assert.equal(s?.role, "widyaiswara");
  assert.equal(s?.sv, 2);
});

test("sesi: cookie buatan aplikasi lama (format sama) diterima", () => {
  // Format aplikasi lama: base64url(JSON) + "." + HMAC-SHA256 base64url, rahasia yang sama.
  const body = { ...dasar, exp: Math.floor(Date.now() / 1000) + 60 };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", process.env.BBPKA_SESSION_SECRET!).update(json).digest("base64url");
  assert.equal(verifySession(`${json}.${mac}`)?.name, "Budi");
});

test("sesi: diubah, kedaluwarsa, atau rusak ditolak", () => {
  const token = signSession(dasar);
  const [json, mac] = token.split(".");
  const palsu = Buffer.from(JSON.stringify({ ...dasar, role: "admin", exp: 9e9 })).toString("base64url");
  assert.equal(verifySession(`${palsu}.${mac}`), null);
  assert.equal(verifySession(signSession(dasar, -10)), null);
  assert.equal(verifySession(json), null);
  assert.equal(verifySession(""), null);
  assert.equal(verifySession(null), null);
});

test("kata sandi: hash scrypt salt:key dan verifikasi", () => {
  const h = hashPassword("rahasia123");
  assert.match(h, /^[0-9a-f]{32}:[0-9a-f]{64}$/);
  assert.equal(verifyPassword("rahasia123", h), true);
  assert.equal(verifyPassword("salah", h), false);
  assert.equal(verifyPassword("x", "rusak"), false);
});

function tokoMemori() {
  const m = new Map<string, number>();
  return {
    m,
    async hit(b: string) {
      m.set(b, (m.get(b) ?? 0) + 1);
      return { hits: m.get(b)!, retryAfter: 900 };
    },
    async reset(bs: string[]) {
      bs.forEach((b) => m.delete(b));
    },
    async refund(b: string) {
      m.set(b, Math.max(0, (m.get(b) ?? 0) - 1));
    },
  };
}

test("pembatas: NIP+IP diblokir setelah batas, sukses mengembalikan jatah", async () => {
  const toko = tokoMemori();
  const l = createLoginLimiter(toko);
  for (let i = 0; i < LOGIN_LIMITS.pair; i++) assert.equal((await l.begin("1234", "ip1")).allowed, true);
  const ke6 = await l.begin("1234", "ip1");
  assert.equal(ke6.allowed, false);

  const lain = await l.begin("5678", "ip2");
  assert.equal(lain.allowed, true);
  if (lain.allowed) await lain.succeeded();
  assert.equal(toko.m.has("nip:5678"), false);
  assert.equal(toko.m.get("ip:ip2"), 0);
});

test("inisial avatar tanpa gelar", () => {
  assert.equal(inisial("Dr. Siti Aminah, M.Si"), "SA");
  assert.equal(inisial("budi"), "B");
  assert.equal(inisial(""), "?");
});
