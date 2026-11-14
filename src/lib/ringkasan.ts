import type { RingkasanLembagaRecord } from "@/lib/server/types";
import { adaBatasJp } from "@/lib/kapasitas";

/**
 * Fungsi murni penyusun "Ringkasan lembaga" — sengaja TIDAK bergantung
 * Prisma (pola sama seperti `hitungUrgensi` di training.ts) supaya logic
 * agregasinya bisa dites tanpa database. Repository
 * (`server/repositories/ringkasan.ts`) yang menjalankan query, fungsi ini
 * yang menyusun hasilnya.
 */
/** Surat tugas bernomor (umum = naskah SURAT_TUGAS; mengajar = surat tugas diklat) untuk tugas keluar. */
export type SuratTugasRingkas = { sumber: "naskah" | "surat-tugas"; sumberId: string; pegawaiIds: string[]; terkaitDiklat: boolean };
export type SpdRingkas = { sumber: string; sumberId: string; pegawaiId: string };

/** Hitungan tugas keluar. SPD yang belum dibuat = pasangan (surat, pegawai) tanpa baris SPD. */
export function hitungTugasKeluar(surat: SuratTugasRingkas[], spd: SpdRingkas[]) {
  const sudah = new Set(spd.map((s) => `${s.sumber}:${s.sumberId}:${s.pegawaiId}`));
  const pegawai = new Set<string>();
  let spdBelumDibuat = 0;
  for (const s of surat) {
    for (const id of new Set(s.pegawaiIds)) {
      pegawai.add(id);
      if (!sudah.has(`${s.sumber}:${s.sumberId}:${id}`)) spdBelumDibuat += 1;
    }
  }
  const umum = surat.filter((s) => s.sumber === "naskah");
  return {
    suratUmum: umum.length,
    suratTerkaitDiklat: umum.filter((s) => s.terkaitDiklat).length,
    suratMengajar: surat.length - umum.length,
    pegawaiUnik: pegawai.size,
    spdBelumDibuat,
  };
}

export type RingkasanInput = {
  trainingPerStatus: { status: string; jumlah: number }[];
  pesertaAktif: number;
  penugasanPerStatus: { status: string; jumlah: number }[];
  widyaiswara: { jpTerpakai: number | null; jpMaksimal: number | null }[];
  pegawaiTotal: number;
  pegawaiAktif: number;
  trainingButuhWi: { id: string; name: string; startDate: Date }[];
  suratTugas: SuratTugasRingkas[];
  spd: SpdRingkas[];
  /** Blok tugas keluar (data persuratan); null bila tidak dikirim. */
  tugasKeluar?: boolean;
};

function hitung(rows: { status: string; jumlah: number }[], status: string): number {
  return rows.find((r) => r.status === status)?.jumlah ?? 0;
}

export function susunRingkasan(input: RingkasanInput): RingkasanLembagaRecord {
  let totalJpTerpakai = 0;
  let totalJpMaksimal = 0;
  let jpTerpakaiBerKapasitas = 0;
  let jumlahOverCapacity = 0;
  let jumlahBelumAdaJpMaksimal = 0;

  for (const w of input.widyaiswara) {
    const terpakai = w.jpTerpakai ?? 0;
    totalJpTerpakai += terpakai;
    // `jpMaksimal` kosong (atau 0, lihat @/lib/kapasitas.ts) = kapasitas BELUM
    // diisi (bukan "tak terbatas"), jadi WI itu dikeluarkan dari hitungan
    // kapasitas & over-capacity, dan dihitung terpisah sebagai catatan
    // kualitas data.
    if (!adaBatasJp(w.jpMaksimal)) {
      jumlahBelumAdaJpMaksimal += 1;
      continue;
    }
    totalJpMaksimal += w.jpMaksimal;
    jpTerpakaiBerKapasitas += terpakai;
    if (terpakai > w.jpMaksimal) jumlahOverCapacity += 1;
  }

  return {
    pelatihan: {
      terjadwal: hitung(input.trainingPerStatus, "Terjadwal"),
      berjalan: hitung(input.trainingPerStatus, "Berjalan"),
      selesai: hitung(input.trainingPerStatus, "Selesai"),
      totalPesertaAktif: input.pesertaAktif,
    },
    penugasanWi: {
      menunggu: hitung(input.penugasanPerStatus, "menunggu"),
      disetujui: hitung(input.penugasanPerStatus, "disetujui"),
      ditolak: hitung(input.penugasanPerStatus, "ditolak"),
      trainingButuhWiSegera: input.trainingButuhWi.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate.toISOString(),
      })),
    },
    widyaiswara: {
      total: input.widyaiswara.length,
      totalJpTerpakai,
      totalJpMaksimal,
      jpTerpakaiBerKapasitas,
      jumlahOverCapacity,
      jumlahBelumAdaJpMaksimal,
    },
    pegawai: {
      total: input.pegawaiTotal,
      aktif: input.pegawaiAktif,
    },
    tugasKeluar: input.tugasKeluar === false ? null : hitungTugasKeluar(input.suratTugas, input.spd),
  };
}
