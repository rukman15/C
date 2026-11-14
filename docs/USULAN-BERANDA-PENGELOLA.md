# Usulan UI/UX — Beranda Pengelola e-Balai v2

> **Status:** Usulan desain; belum diimplementasikan.
> **Tanggal:** 14 November 2026.
> **Repositori:** `rukman15/C`.
> **Branch usulan:** `docs/usulan-beranda-pengelola-2026-11-14`.
> **Batas perubahan:** Hanya dokumen ini. Jangan mengubah branch `main`, branch default, halaman produksi, atau skema database tanpa persetujuan lanjutan.

## 1. Latar belakang

Beranda pengelola saat ini di `src/app/dashboard/page.tsx` lebih banyak menampilkan **Akun Anda**, **Pintasan**, dan pesan **Versi baru sedang dibangun**. Pesan itu sudah tidak sejalan dengan banyak modul e-Balai v2 yang telah ditambahkan. Pengguna membutuhkan informasi pekerjaan yang membutuhkan tindakan, bukan hanya daftar menu.

Sudah ada fondasi yang layak dipertahankan:

- `src/lib/navigasi.ts`: menu dan pintasan berdasarkan peran.
- `src/components/dasbor/kerangka.tsx`: sidebar desktop dan drawer pada HP.
- `src/components/dasbor/halaman.tsx`: pembungkus halaman dan kartu.
- `src/components/arc/`: MetricCard, Alert, Badge, Progress, EmptyState, Skeleton, Tabs.
- `src/components/peserta/beranda-peserta.tsx`: beranda khusus peserta, **tidak termasuk lingkup perubahan**.

## 2. Tujuan pengalaman pengguna

1. Dalam beberapa detik pengguna mengetahui pekerjaan yang paling perlu ditangani hari ini.
2. Tindakan utama bisa dimulai langsung dari Beranda, tanpa mencari di antara banyak menu.
3. Isi Beranda menyesuaikan hak akses: Ketua Diklat, Kepala Balai, Widyaiswara, admin, dan peran pengelola lainnya.
4. Status, hitungan, dan peringatan selalu berasal dari data nyata; tidak boleh menampilkan angka contoh sebagai data sungguhan.
5. Tampilan nyaman pada desktop, tablet, dan HP; tetap serasi dengan Arc UI.

## 3. Struktur informasi yang diusulkan

Urutan dari atas ke bawah:

1. **Kepala halaman:** “Beranda”, sapaan singkat, tanggal WIB, dan konteks peran (jika diperlukan).
2. **Ringkasan singkat (maks. empat kartu):** metrik terpenting yang relevan untuk peran aktif, masing-masing dengan label jelas dan tautan ke daftar rinci.
3. **Perlu tindakan:** antrean prioritas berupa item nyata, jumlah tertunda, konteks diklat/pegawai, dan tombol menuju pekerjaan. Tampilkan dahulu pekerjaan yang mendesak; perhatikan batas izin pengguna.
4. **Jadwal hari ini / aktivitas terdekat:** waktu, sesi, pengampu, ruang atau tautan daring jika tersedia, serta indikator selesai/berlangsung/berikutnya.
5. **Diklat aktif:** progres pelaksanaan, tahapan/JP yang relevan, serta risiko keterlambatan atau kelengkapan.
6. **Pintasan:** paling banyak 4–6 aksi yang sering dipakai dan tidak menduplikasi kartu atau daftar tindakan.

Contoh tata letak **konseptual, bukan data sebenarnya**:

```text
Beranda
Selamat datang, [nama] • [hari, tanggal] WIB

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Diklat aktif    │ Sesi hari ini   │ Perlu ditinjau  │ Progres relevan │
│ [data nyata]    │ [data nyata]    │ [data nyata]    │ [data nyata]    │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

┌─────────────────────────────────────┬───────────────────────────────┐
│ PERLU TINDAKAN                      │ JADWAL HARI INI               │
│ • [permintaan/berkas + status]       │ • [waktu • kegiatan • ruang]   │
│ • [tugas + tautan menuju tindakan]   │ • [sesi berikutnya]            │
└─────────────────────────────────────┴───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ DIKLAT AKTIF: status, progres, konteks, tautan rincian              │
└─────────────────────────────────────────────────────────────────────┘

Pintasan yang relevan untuk peran
```

## 4. Penyesuaian menurut peran

| Peran | Fokus metrik | Fokus tindakan |
| --- | --- | --- |
| Ketua Diklat / tim pengelola | Diklat berlangsung, sesi mendatang, kelengkapan jadwal, tugas/berkas menunggu | Buka Rincian Diklat, pemeriksaan peserta, absensi, tugas |
| Kepala Balai / pimpinan | Ringkasan pelaksanaan, pengajuan menunggu persetujuan, peringatan | Tinjau persetujuan, pantau progres, buka ringkasan |
| Widyaiswara | Jadwal mengajar pribadi, JP tercatat, kiriman tugas menunggu tinjau | Buka jadwal mengajar, Tinjau Tugas, sesi terkait |
| Admin | Akun/registrasi yang perlu perhatian, pekerjaan administratif | Kelola Akun, Registrasi Peserta, pengaturan yang diizinkan |
| Kepegawaian / peran lain | Ringkasan domain sesuai wewenang | Disposisi untuk Saya, Data Pegawai atau modul relevan |

Aturan: jangan tampilkan kartu, tombol, atau angka yang pengguna tidak berhak akses. Beranda peserta tetap menggunakan tampilan khusus yang sudah ada, kecuali ada keputusan desain terpisah.

## 5. Perilaku dan interaksi

- Urutkan **Perlu tindakan** berdasarkan urgensi dan batas waktu bila data tersebut tersedia; jangan mengarang tenggat.
- Setiap item memiliki label yang jelas, konteks asal, status, dan tautan ke halaman yang benar-benar tersedia.
- Status kosong: tampilkan `EmptyState` bermakna (“Tidak ada pengajuan yang perlu ditinjau”), bukan sekadar angka nol tanpa konteks.
- Saat memuat: gunakan skeleton yang stabil. Saat API gagal: tampilkan kegagalan dan opsi coba lagi; jangan menyamakan gagal memuat dengan kosong.
- Jika ada sesi hari ini, tunjukkan waktu mulai–selesai dan label status; waktu menggunakan zona `Asia/Jakarta` (WIB).
- Perhitungan JP mengikuti aturan backend dan data sesi yang sah, bukan angka hard-coded.
- Jangan menaruh data sensitif (mis. kata sandi, nomor rekening) pada kartu ringkasan.
- Pesan “Versi baru sedang dibangun” di Beranda diperbarui atau dihapus ketika sudah tidak akurat. Modul yang belum tersedia harus diberi navigasi yang jujur dan bisa ditindaklanjuti, bukan dead end.

## 6. Mobile, aksesibilitas, dan visual

- Desktop: hingga 4 kartu metrik per baris, konten utama dan jadwal bisa dua kolom.
- Tablet: 2 kartu metrik per baris.
- HP: 1–2 kolom sesuai lebar, urutan **Perlu tindakan → Jadwal → Diklat aktif → Pintasan** setelah ringkasan; hindari tabel lebar untuk item prioritas.
- Target sentuh aksi penting idealnya **minimal 44 × 44 px**. Teks informasi utama perlu cukup terbaca tanpa zoom.
- Setiap elemen interaktif memiliki nama aksesibel, status fokus keyboard, dan kontras memadai; jangan mengandalkan warna saja untuk menunjukkan status.
- Gunakan token Arc yang telah ada; hindari menduplikasi komponen dengan CSS custom tanpa kebutuhan.
- Periksa kontras tombol: `#2C99D6` dengan teks putih sekitar **3,17:1** (belum memenuhi 4,5:1 untuk teks normal). Untuk latar tombol dengan teks putih dapat dipertimbangkan `#1E7BB3` (~**4,63:1**), setelah diuji pada state hover/focus/dark.
- Gerak/transisi tetap singkat, tidak menghambat alur kerja, dan menghormati `prefers-reduced-motion`.

## 7. Tahapan pelaksanaan yang diusulkan (belum dikerjakan)

**Tahap A — Perbaikan cepat**
- Hapus pesan beranda yang sudah usang.
- Perbaiki penanda menu aktif ketika berada di halaman rincian diklat.
- Audit kontras warna dan ukuran kontrol pada layar sentuh.

**Tahap B — MVP Beranda Pengelola**
- Buat kartu ringkasan berbasis API/data yang sudah ada.
- Buat antrean “Perlu tindakan” berbasis hak akses.
- Tambahkan jadwal hari ini dan diklat aktif dengan deep link.

**Tahap C — Penyempurnaan**
- Uji persona Ketua Diklat, Kepala Balai, Widyaiswara, Admin, dan pengelola lain.
- Uji responsivitas, keyboard, screen reader, keadaan loading/error/empty, serta dark mode.
- Validasi copy, urutan prioritas, dan kecepatan alur kerja melalui pengguna nyata.

## 8. Kriteria penerimaan untuk implementasi mendatang

- [ ] Pengguna dapat mengenali pekerjaan terpenting tanpa membuka menu lain.
- [ ] Semua angka dan status berasal dari data aktual dan mengikuti izin peran.
- [ ] Item “Perlu tindakan” menuju halaman yang benar dengan konteks yang jelas.
- [ ] Tampilan peserta tidak mengalami regresi.
- [ ] Tidak ada pesan placeholder yang menyesatkan tentang kesiapan modul.
- [ ] Responsif pada ukuran HP dan desktop; tab, tombol, serta keyboard mudah dipakai.
- [ ] Kontras teks, fokus keyboard, reduced motion, loading, error, dan empty state diperiksa.
- [ ] Lolos `npm run check`, `npm run uji`, dan `npm run build` setelah kode kelak diimplementasikan.

## 9. Batas keputusan

Dokumen ini **hanya mencatat usulan**, bukan keputusan menerapkan atau menggabungkan perubahan. Tidak ada perubahan kode aplikasi, konfigurasi, dependency, migrasi database, maupun branch utama yang diperlukan untuk menyimpan usulan ini. Jika nanti disetujui untuk implementasi, kerjakan pada branch fitur terpisah dan ajukan PR untuk ditinjau terlebih dahulu.
