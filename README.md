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
- **Halaman peserta** (tahap 6): beranda peserta (jadwal hari ini dengan tombol gabung/salin tautan, diklat aktif dan tahapan, tugas & checklist, ringkasan angka, pembelajaran mandiri, daftar pelatihan, sertifikat), Diklat Saya, dan Ruang belajar (tab Ringkasan, Jadwal, Tugas & tes, Seminar, Materi; usulan mentor; pratinjau untuk Ketua Diklat, Kepala Balai, admin). Dokumen persyaratan (unggah, pakai berkas diklat sebelumnya, cetak Formulir 1 Pakta Integritas) dan Tugas (unggah, kirim, riwayat catatan peninjau). Pre/post test (satu soal per layar, simpan otomatis, waktu dari server, kirim otomatis saat waktu habis) dan Evaluasi pengajar & penyelenggaraan (Formulir 16–21, 23B). Profil Saya (data registrasi mandiri) dan Ruang Coaching (daftar ruang, sesi & video YouTube, catatan coach per peserta, forum tanya-jawab dengan sembunyikan tercatat di Log Audit, pantauan peserta, Pustaka Video Saya).
- **Revisi 1: folder peserta** (EB-051): tab Folder di Ruang belajar berisi Persyaratan, Tugas dari WI, Bahan tayang Seminar RAP/LAP (PPTX/PDF, maks 20 MB), dan Sertifikat self learning (PDF/JPG/PNG). Halaman Tugas dibagi Tugas dari WI dan Tugas aksi perubahan. Butuh tabel baru `berkas_peserta`: migrasi `20261113090000_berkas_peserta` ada di repo lama (`rukman15/bangkom`, branch `bangun-ulang`) dan **belum dijalankan ke Supabase**.
- **Revisi 2: tab Kelompok** (EB-046 s/d EB-050): jenis E-learning (dibagi acak), Bimbingan & seminar (coach, kelas seminar; disusun per instansi lalu kabupaten/kota; menjadi Ruang Coaching dan sasaran evaluasi coach), Studi lapangan (per kategori instansi yang ditebak dari jabatan/instansi dan bisa diubah per peserta; kategori dan lokus kelompok), Belajar mandiri. Semua kelompok punya ketua; anggota bisa dipindah; cetak/PDF per jenis seperti lembar kelompok balai. Butuh migrasi `20261113100000_kelompok_revisi` (repo lama, **belum dijalankan**). Data coaching lama di kelompok E-learning dipindah dengan skrip manual `prisma/sql-manual/20261113_pindah-coaching-ke-seminar.sql` (repo lama).
- **Revisi 3: kalender e-learning** (EB-052): tab Jadwal & Absensi punya tampilan Kalender (Sync/Async/Mandiri/Klasikal/Stula, Minggu ditandai) dan pengaturan pengajar & tautan Zoom per kelompok e-learning tiap sesi (salin dari sesi sebelumnya, gilir pengajar). Peserta melihat pengajar & Zoom kelompoknya di beranda dan jadwal (dengan kalender). Cetak jadwal mengikuti format jadwal balai. Butuh migrasi `20261113110000_sesi_kelompok` (repo lama, **belum dijalankan**).
- **Revisi 4: studi lapangan** (EB-049, EB-050, EB-053): tab Kelompok jenis Studi lapangan punya daftar lokasi (kategori, narahubung, status Calon/Layak/Tidak layak, ketua tim balai), catatan advance kunjungan dengan berkas, pasangkan lokasi ke kelompok (lokus ikut terisi) atau "Cocokkan otomatis" per kategori, dan peringatan mulai H-7 sebelum stula. Butuh migrasi `20261113120000_studi_lapangan` (repo lama, **belum dijalankan**).
- **Revisi 5a: seminar per kelompok** (EB-055): tab Seminar (RAP/LAP) disusun per kelompok bimbingan & seminar — kelas, penguji (1 peserta 1 penguji, bisa diganti per peserta), evaluator + HP, jam 45 menit/peserta dengan istirahat, "terapkan" ke anggota; ubah jadwal & mentor per peserta, status panggilan, cetak per kelompok seperti lembar K RAP/K LAP. Butuh migrasi `20261113130000_seminar_kelompok` (repo lama, **belum dijalankan**).
- **Revisi 5b: rekening mentor daring** (EB-045): bila kehadiran mentor di seminar = daring, peserta mengisi rekening & HP mentor di "Mentor saya" (boleh diubah kapan saja, tampil tersamar); ganti mentor → isi ulang. Nomor lengkap hanya dibuka admin & Ketua Diklat dari tab Seminar dan tercatat di Log Audit. Butuh migrasi `20261113140000_rekening_mentor` (repo lama, **belum dijalankan**).
- **Unggah langsung ke Supabase** (lolos batas ±4,5 MB Vercel): folder peserta (20 MB), tugas (10 MB), dokumen persyaratan, dan berkas kunjungan stula diunggah browser ke `dokumen-peserta/titipan/…` lewat tautan unggah sementara (`/api/unggah`), lalu server mengambil, memeriksa isinya, menyimpan di tempat akhir (Supabase/Drive), dan menghapus titipan. Tanpa SUPABASE_* kembali ke multipart. Batas ukuran berkas bucket `dokumen-peserta` di Supabase harus ≥ 20 MB.
- **Tab Penilaian** (sama dengan aplikasi lama): lembar nilai 0–100 per evaluasi (tempel blok dari Excel, rata-rata isian WI sebagai petunjuk), Rekap & Kelulusan (nilai × bobot, nilai akhir, kualifikasi, lulus/ditunda/tidak lulus, remedial maks 85, peringkat 3 terbaik), unduh CSV, cetak Formulir 14. WI yang ditugaskan mengisi aspek bagiannya; Kepala Balai melihat saja. Panel Formulir 15 (pelaksanaan remedial, cetak) dan surat keterangan ditunda/tidak lulus (Word & PDF, TTE Kepala Balai).
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
