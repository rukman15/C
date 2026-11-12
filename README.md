# e-Balai v2

Bangun ulang e-Balai dengan Next.js + React. Aplikasi lama (SvelteKit) ada di repo `rukman15/bangkom` dan tetap berjalan; v2 dibangun bertahap per modul. Keputusannya tercatat sebagai EB-044 di `docs/KEPUTUSAN.md` repo bangkom.

## Yang sudah ada (tahap 1)

- **Masuk** dengan NIP, email, atau nama pengguna. Aturannya disalin dari aplikasi lama: hash scrypt, pembatas percobaan (tabel `login_attempt`), pesan pendaftar yang menunggu persetujuan, waktu respons sama untuk akun yang tidak ada.
- **Sesi**: cookie `bbpka_session` bertanda tangan HMAC, format sama dengan aplikasi lama. Setiap permintaan dicocokkan ke tabel akun (aktif, peran, tautan pegawai, `sesiVersi`, sandi sementara, Plt/Plh).
- **Wajib ganti kata sandi** bila masih sementara atau sama dengan NIP: semua halaman dialihkan ke Akun & Kata Sandi, menu disembunyikan.
- **Menu per peran** dari `src/lib/navigasi.ts` (salinan apa adanya), termasuk Koordinator WI, tim kerja diklat, dan Admin Penyelenggara.
- **Beranda**: sapaan, data akun dan keanggotaan, pintasan.
- **Akun & Kata Sandi**: ganti kata sandi (sesi lain gugur), keluar, keluar dari semua perangkat.
- Halaman menu lain menampilkan "Belum dibangun ulang".
- Tema terang/gelap, tampilan HP (menu laci).

Belum: situs publik, registrasi, pilih peran Plt/Plh, dan semua halaman kerja.

## Menjalankan

```bash
npm install
cp .env.example .env    # DATABASE_URL & DIRECT_URL sama dengan aplikasi lama
npm run dev             # http://localhost:3001
```

`BBPKA_SESSION_SECRET` harus sama dengan aplikasi lama bila ingin sesi berlaku di keduanya.

## Perintah

| Perintah | Guna |
|---|---|
| `npm run dev` | Server pengembangan di port 3001 |
| `npm run check` | Pemeriksaan TypeScript |
| `npm run uji` | Uji sesi, kata sandi, pembatas, dan menu |
| `npm run build` | Build produksi |
| `npm run db:generate` | `prisma generate` ke `src/generated/prisma` (ikut di-commit) |

Skema ada di `prisma/schema.prisma`, salinan dari `prisma/schema.prisma` di repo bangkom. Migrasi tetap dijalankan dari aplikasi lama (lihat `CLAUDE.md` repo bangkom); setelah skema berubah, salin skemanya ke sini lalu jalankan `npm run db:generate`.

## Struktur

- `src/app/` — halaman dan API (`api/auth/session`, `api/akun/kata-sandi`).
- `src/lib/` — logika murni, sebagian besar disalin dari `src/lib` repo bangkom (roles, navigasi, plt, tanggal, tim-kerja).
- `src/lib/server/` — sesi, auth, akses database.
- `src/components/ui/` — Input dan Button dari [beUI](https://beui.dev) (MIT, lihat `LICENSE-beui`).
- `src/components/dasbor/` — kerangka dasbor, menu pengguna, ikon menu.
- `uji/` — uji tanpa database.

## Tampilan

Token warna di `src/app/globals.css` (terang dan gelap); halaman hanya memakai token, tanpa warna mentah. Font Geist dan Geist Mono (angka, email, NIP). Kartu bergaris tanpa bayangan, ketebalan huruf 400/500.
