import type { Metadata } from "next";
import { JudulPublik } from "@/components/publik/bagian";
import { NAMA_APLIKASI, NAMA_LEMBAGA } from "@/lib/aplikasi";
import { EMAIL_PRIVASI } from "@/lib/kebijakan-privasi";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

/** Kebijakan privasi (isi sama dengan aplikasi lama; dirujuk Google Auth Platform). */
export default function KebijakanPrivasi() {
  return (
    <>
      <JudulPublik judul={`Kebijakan Privasi ${NAMA_APLIKASI}`} keterangan="Berlaku sejak 26 Oktober 2026 · Terakhir diperbarui 26 Oktober 2026" />
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="font-display text-base font-medium">1. Siapa yang mengelola layanan ini</h2>
            <p className="mt-2">
              {NAMA_APLIKASI} adalah sistem informasi administrasi diklat milik {NAMA_LEMBAGA} (BBPKA-PDN II), BPSDM Kementerian Dalam Negeri Republik Indonesia. Pengelola data
              adalah BBPKA-PDN II. Pertanyaan tentang privasi dapat dikirim ke
              <a href={`mailto:${EMAIL_PRIVASI}`} className="text-primary hover:underline">
                {EMAIL_PRIVASI}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">2. Data yang kami proses</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                <strong className="font-medium">Data pegawai dan peserta:</strong> nama, NIP (atau NIK bila tidak memiliki NIP), jabatan, instansi, dan data kepegawaian yang
                diperlukan untuk diklat.
              </li>
              <li>
                <strong className="font-medium">Akun:</strong> nama pengguna, email, dan kata sandi dalam bentuk terenkripsi. Kata sandi tidak pernah disimpan dalam bentuk terbaca.
              </li>
              <li>
                <strong className="font-medium">Data pelatihan:</strong> kehadiran, hasil pre-test dan post-test, penilaian, kelulusan, dan evaluasi pelatihan.
              </li>
              <li>
                <strong className="font-medium">Dokumen persyaratan peserta:</strong> surat keterangan dan berkas lain yang diunggah peserta, termasuk surat keterangan sehat, bebas
                narkotika, catatan kelakuan baik, dan surat keterangan tidak sedang menjalani hukuman disiplin. Berkas ini tergolong data pribadi yang bersifat spesifik dan hanya
                dapat dilihat oleh petugas yang berwenang.
              </li>
              <li>
                <strong className="font-medium">Data yang tidak kami simpan:</strong> agama peserta tidak dicatat dalam aplikasi ini.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">3. Tujuan penggunaan</h2>
            <p className="mt-2">
              Data digunakan untuk menyelenggarakan administrasi diklat: pendaftaran, penjadwalan, kehadiran, penilaian, penerbitan dokumen (seperti surat tugas dan surat
              keterangan), serta pelaporan kepada instansi yang berwenang. Data tidak digunakan untuk tujuan komersial dan tidak dijual kepada pihak lain.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">4. Siapa yang dapat mengakses</h2>
            <p className="mt-2">
              Akses dibatasi menurut peran dan kebutuhan kerja: penyelenggara diklat, widyaiswara untuk data yang berkaitan dengan ajarannya, dan pimpinan untuk ringkasan. Setiap
              tindakan yang menyangkut hak akses dicatat dalam log audit. Peserta hanya dapat melihat datanya sendiri.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">5. Tempat penyimpanan</h2>
            <p className="mt-2">
              Basis data dan berkas aplikasi disimpan pada layanan penyimpanan awan yang dipakai BBPKA-PDN II. Berkas unggahan disimpan dalam ruang penyimpanan privat yang tidak
              dapat diakses publik; unduhan memakai tautan yang berlaku sebentar dan hanya diberikan kepada pengguna yang berwenang.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">6. Lama penyimpanan</h2>
            <p className="mt-2">
              Data disimpan selama diperlukan untuk tujuan di atas dan sesuai ketentuan kearsipan yang berlaku. Berkas dokumen persyaratan peserta dapat dihapus setelah masa
              administrasi diklat berakhir, kecuali ketentuan lain mewajibkan penyimpanan lebih lama.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">7. Hak Anda</h2>
            <p className="mt-2">
              Sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda berhak meminta akses terhadap data pribadi Anda, memperbaiki data yang keliru, meminta
              penghapusan sesuai ketentuan yang berlaku, dan menyampaikan keberatan atas pemrosesan data. Permintaan dapat dikirim ke alamat email di atas.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium">8. Perubahan kebijakan</h2>
            <p className="mt-2">Kebijakan ini dapat diperbarui. Perubahan penting akan diumumkan di halaman ini dengan tanggal pembaruan yang baru.</p>
          </section>
        </div>
      </div>
    </>
  );
}
