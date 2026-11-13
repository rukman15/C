# e-Balai v2

Bangun ulang e-Balai dengan Next.js + React. Aplikasi lama (SvelteKit) ada di repo `rukman15/bangkom` dan tetap berjalan; v2 dibangun bertahap per modul. Keputusannya tercatat sebagai EB-044 di `docs/KEPUTUSAN.md` repo bangkom.

## Yang sudah ada (tahap 1)

- **Masuk** dengan NIP, email, atau nama pengguna. Aturannya disalin dari aplikasi lama: hash scrypt, pembatas percobaan (tabel `login_attempt`), pesan pendaftar yang menunggu persetujuan, waktu respons sama untuk akun yang tidak ada.
- **Sesi**: cookie `bbpka_session` bertanda tangan HMAC, format sama dengan aplikasi lama. Setiap permintaan dicocokkan ke tabel akun (aktif, peran, tautan pegawai, `sesiVersi`, sandi sementara, Plt/Plh).
- **Wajib ganti kata sandi** bila masih sementara atau sama dengan NIP: semua halaman dialihkan ke Akun & Kata Sandi, menu disembunyikan.
- **Menu per peran** dari `src/lib/navigasi.ts` (salinan apa adanya), termasuk Koordinator WI, tim kerja diklat, dan Admin Penyelenggara.
- **Beranda**: sapaan, data akun dan keanggotaan, pintasan.
- **Akun & Kata Sandi**: ganti kata sandi (sesi lain gugur), keluar, keluar dari semua perangkat.
- **Jadwal Diklat** (tahap 2): daftar per status (berlangsung, akan datang, baru selesai) dengan kemajuan hari, saring status dan kategori, pencarian, kalender bulanan (batang diklat per minggu, pilih hari), panel rincian, jadwal mengajar milik sendiri (sesi dan JP tercatat), dan tambah jadwal (program PKA/PKP dengan saran nama dan JP dari kurikulum, tim pemegang). Aturan data dan hak akses sama dengan aplikasi lama; ubah dan hapus jadwal tetap di Rincian Diklat.
- **Rincian Diklat** (tahap 3): kepala halaman (lencana program, angkatan, kategori, tim, status), ubah jadwal, hapus jadwal kosong (konfirmasi berubah bentuk), tab ke 12 bagian, ringkasan angka beranimasi, kemajuan JP pengampu, kurikulum LAN per tahap (batang komposisi JP, rincian kegiatan bisa dibuka), mata pelatihan & pengampu (saring yang belum/sudah ada), dan daftar pengampu dengan JP sesi tercatat. Hak akses sama dengan aplikasi lama. Surat tugas mengajar masih di aplikasi lama; 9 tab lain tampil "belum dibangun ulang".
- **Pengampu** (tahap 4): tetapkan pengampu (WI per jenjang dengan beban JP bulan mulai diklat, pratinjau jadwal beririsan, peringatan melebihi batas JP), tetapkan pengajuan lama, hapus pengampu, dan sesi mengajar (catat/hapus, total JP dijaga). Penolakan sama dengan aplikasi lama: WI cuti, cuti disetujui beririsan, bentrok surat tugas, pengampu kembar, hapus pengampu yang sudah punya sesi atau surat tugas bernomor.
- **Tab Peserta** (tahap 4): ringkasan, cari dan saring, tambah satu, tempel dari Excel dengan pratinjau dan baris bermasalah, ubah (termasuk status), hapus (hanya yang belum punya kehadiran/nilai), rekap tidak hadir per peserta, dan buat akun login peserta (kata sandi sementara tampil sekali, tercatat di Log Audit).
- **Tab Jadwal & Absensi** (tahap 5): ringkasan, jadwal per hari dengan rekap kehadiran tiap sesi, peringatan presensi harian (hari belum lengkap, hari kerja tanpa sesi), masa di tempat kerja, tambah/ubah sesi (mata pelatihan, bentuk, jam, ruang, tautan), tempel jadwal dari Excel, hapus sesi (hanya yang belum punya catatan), dan lembar kehadiran di laci samping (tandai sisanya hadir, keterangan untuk tidak hadir/dispensasi, hanya baris berubah yang dikirim). Dibaca Ketua Diklat dan Kepala Balai, diubah Ketua Diklat; perubahan sesi tercatat di log aktivitas.
- **Halaman peserta** (tahap 6): beranda peserta (jadwal hari ini dengan tombol gabung/salin tautan, diklat aktif dan tahapan, tugas & checklist, ringkasan angka, pembelajaran mandiri, daftar pelatihan, sertifikat), Diklat Saya, dan Ruang belajar (tab Ringkasan, Jadwal, Tugas & tes, Seminar, Materi; usulan mentor; pratinjau untuk Ketua Diklat, Kepala Balai, admin). Dokumen persyaratan (unggah, pakai berkas diklat sebelumnya, cetak Formulir 1 Pakta Integritas) dan Tugas (unggah, kirim, riwayat catatan peninjau). Pre/post test (satu soal per layar, simpan otomatis, waktu dari server, kirim otomatis saat waktu habis) dan Evaluasi pengajar & penyelenggaraan (Formulir 16–21, 23B). Server untuk profil dan coaching sudah dipindahkan; halamannya menyusul.
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
| `npm run uji` | Uji sesi, kata sandi, pembatas, menu, jadwal, bentrok, dan peserta |
| `npm run build` | Build produksi |
| `npm run db:generate` | `prisma generate` ke `src/generated/prisma` (ikut di-commit) |

Skema ada di `prisma/schema.prisma`, salinan dari `prisma/schema.prisma` di repo bangkom. Migrasi tetap dijalankan dari aplikasi lama (lihat `CLAUDE.md` repo bangkom); setelah skema berubah, salin skemanya ke sini lalu jalankan `npm run db:generate`.

## Struktur

- `src/app/` — halaman dan API (`api/auth/session`, `api/akun/kata-sandi`, `api/training`).
- `src/lib/` — logika murni, sebagian besar disalin dari `src/lib` repo bangkom (roles, navigasi, plt, tanggal, tim-kerja).
- `src/lib/server/` — sesi, auth, akses database.
- `src/components/arc/` — komponen [Arc UI](https://uiarc.dev), dipasang dari registry-nya: fondasi token (warna, tema terang/gelap, gerak), Tabs, Segmented control, Chip group, Dialog, Drawer, User menu, Theme switch, Badge, Progress, Metric card, Alert, Toast, Empty state, Confirm morph, Date picker, Number field, Select, dan lainnya.
- `src/components/ui/` — Input dan Button dari [beUI](https://beui.dev) (MIT, lihat `LICENSE-beui`).
- `src/components/dasbor/` — kerangka dasbor, menu pengguna, ikon menu.
- `uji/` — uji tanpa database.

## Tampilan

Token warna berasal dari fondasi Arc (`src/components/arc/foundation.css`, aksen biru `data-accent="blue"`, tema `data-theme`); `src/app/globals.css` hanya menamai ulang token itu untuk kelas Tailwind. Halaman tanpa warna mentah. Komponen buatan sendiri hanya untuk yang tidak ada di library: kalender bulan berisi batang diklat, kartu diklat, dan kerangka dasbor. Font Geist dan Geist Mono (angka, email, NIP). Kartu bergaris tanpa bayangan, ketebalan huruf 400/500.
