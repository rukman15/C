import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ValidationError } from "@/lib/server/errors";
import { isoTanggal } from "@/lib/tanggal";
import { hariAjarFisik, irisanHari, labelJenisCuti, pesanBentrok, rapikanRentang, tanpaKalimatTanggal, type BentrokItem, type RentangTanggal } from "@/lib/persuratan";

/**
 * Bentrok jadwal pegawai per TANGGAL (surat tugas kantor tidak memakai jam; CATATAN-SURAT-MENYURAT.md G).
 * Sumber: surat tugas umum (naskah), surat tugas mengajar, cuti DISETUJUI, jadwal mengajar WI.
 *
 * Aturan (keputusan 19 Okt 2026) untuk surat tugas KELUAR (konteks "umum"):
 *  - cegah      : cuti disetujui; surat tugas lain pada tanggal itu (konsep maupun bernomor); WI punya
 *                 sesi mengajar KLASIKAL / studi lapangan (hadir fisik) pada tanggal itu.
 *  - peringatan : sesi e-learning (bisa mengajar lewat Zoom dari lokasi tugas); penugasan WI disetujui
 *                 yang jadwal sesinya belum diisi.
 * Mengajar ↔ mengajar (dua kelas di balai pada hari yang sama) hanya peringatan. Pengajuan penugasan
 * WI dicegah oleh surat tugas keluar bernomor pada hari mengajarnya. `perkiraan`: tanggal yang
 * diperiksa hanya perkiraan (periode PKA/PKP tanpa jadwal sesi) -> tidak ada yang mencegah.
 */
export type KonteksBentrok = "umum" | "mengajar" | "penugasan";

/** Satu hari mengajar seorang WI. `fisik` = klasikal/studi lapangan (wajib hadir di tempat). */
export type HariAjar = { trainingId: string; training: string; tanggal: string; fisik: boolean };

/**
 * Jadwal mengajar WI dari penugasan DISETUJUI:
 *  - Jadwal Pembelajaran: sesi bermata pelatihan sama dengan penugasan (bentuk sesi menentukan fisik/daring);
 *  - catatan sesi mengajar WI itu (dianggap fisik kecuali tempat/kegiatan menyebut daring/Zoom/e-learning).
 * `tanpaJadwal` = penugasan yang belum punya tanggal sesi sama sekali (dipakai periode diklat).
 */
export async function jadwalMengajar(
  pegawaiIds: string[],
  kecualiTrainingId?: string | null,
): Promise<{ hari: Map<string, HariAjar[]>; tanpaJadwal: Map<string, { trainingId: string; training: string; rentang: RentangTanggal[] }[]> }> {
  const hari = new Map<string, HariAjar[]>();
  const tanpaJadwal = new Map<string, { trainingId: string; training: string; rentang: RentangTanggal[] }[]>();
  if (!pegawaiIds.length) return { hari, tanpaJadwal };
  const pen: {
    instructorId: string;
    trainingId: string;
    mataPelatihan: string | null;
    training: { name: string; startDate: Date; endDate: Date | null } | null;
    sesi: { tanggal: Date; tempat: string | null; kegiatan: string | null }[];
  }[] = await prisma.penugasanApproval.findMany({
    where: { instructorId: { in: pegawaiIds }, status: "disetujui", ...(kecualiTrainingId ? { NOT: { trainingId: kecualiTrainingId } } : {}) },
    select: {
      instructorId: true,
      trainingId: true,
      mataPelatihan: true,
      training: { select: { name: true, startDate: true, endDate: true } },
      sesi: { select: { tanggal: true, tempat: true, kegiatan: true } },
    },
  });
  const trainingIds = [...new Set(pen.filter((p) => p.mataPelatihan).map((p) => p.trainingId))];
  const sesiPem: { trainingId: string; tanggal: Date; bentuk: string; mataPelatihan: string | null }[] = trainingIds.length
    ? await prisma.sesiPembelajaran.findMany({
        where: { trainingId: { in: trainingIds }, mataPelatihan: { not: null } },
        select: { trainingId: true, tanggal: true, bentuk: true, mataPelatihan: true },
      })
    : [];
  for (const p of pen) {
    if (!p.training) continue;
    const perTanggal = new Map<string, boolean>();
    for (const s of sesiPem) {
      if (s.trainingId !== p.trainingId || !p.mataPelatihan || s.mataPelatihan !== p.mataPelatihan) continue;
      const t = isoTanggal(s.tanggal);
      perTanggal.set(t, (perTanggal.get(t) ?? false) || hariAjarFisik(s.bentuk, null));
    }
    for (const s of p.sesi) {
      const t = isoTanggal(s.tanggal);
      // Jadwal Pembelajaran lebih tahu bentuk sesinya; catatan sesi mengajar melengkapi tanggal yang belum ada.
      if (!perTanggal.has(t)) perTanggal.set(t, hariAjarFisik(null, `${s.tempat ?? ""} ${s.kegiatan ?? ""}`));
    }
    if (perTanggal.size) {
      const daftar = hari.get(p.instructorId) ?? [];
      for (const [tanggal, fisik] of perTanggal) daftar.push({ trainingId: p.trainingId, training: p.training.name, tanggal, fisik });
      hari.set(p.instructorId, daftar);
    } else {
      const daftar = tanpaJadwal.get(p.instructorId) ?? [];
      if (!daftar.some((d) => d.trainingId === p.trainingId))
        daftar.push({
          trainingId: p.trainingId,
          training: p.training.name,
          rentang: [{ mulai: isoTanggal(p.training.startDate), selesai: isoTanggal(p.training.endDate ?? p.training.startDate) }],
        });
      tanpaJadwal.set(p.instructorId, daftar);
    }
  }
  return { hari, tanpaJadwal };
}

/** Hari mengajar seorang WI pada satu diklat (untuk surat tugas mengajar tanpa tanggal tugas). */
export async function hariMengajarDi(pegawaiId: string, trainingId: string): Promise<RentangTanggal[]> {
  const { hari } = await jadwalMengajar([pegawaiId]);
  return rapikanRentang((hari.get(pegawaiId) ?? []).filter((h) => h.trainingId === trainingId).map((h) => ({ mulai: h.tanggal, selesai: h.tanggal })));
}

export async function bentrokPegawai(
  pegawaiIds: string[],
  rentangMasuk: RentangTanggal[],
  o: { konteks: KonteksBentrok; naskahId?: string | null; suratTugasId?: string | null; trainingId?: string | null; perkiraan?: boolean },
): Promise<Record<string, BentrokItem[]>> {
  const ids = [...new Set(pegawaiIds)];
  const rentang = rapikanRentang(rentangMasuk);
  const hasil: Record<string, BentrokItem[]> = {};
  if (!ids.length || !rentang.length) return hasil;
  // Tanggal perkiraan (periode diklat, bukan hari mengajar pasti): semua bentrok hanya peringatan.
  const bolehCegah = !o.perkiraan;
  const tambah = (id: string, item: BentrokItem) => (hasil[id] ??= []).push(item);

  const [naskah, surat, cuti, jadwal] = await Promise.all([
    prisma.naskahDinas.findMany({
      where: { jenis: "SURAT_TUGAS", pegawaiIds: { hasSome: ids }, ...(o.naskahId ? { NOT: { id: o.naskahId } } : {}) },
      select: { id: true, nomor: true, pegawaiIds: true, tanggalTugas: true, isi: true },
    }) as Promise<{ id: string; nomor: string | null; pegawaiIds: string[]; tanggalTugas: unknown; isi: unknown }[]>,
    prisma.suratTugas.findMany({
      where: { pegawaiIds: { hasSome: ids }, ...(o.suratTugasId ? { NOT: { id: o.suratTugasId } } : {}) },
      select: { id: true, nomor: true, pegawaiIds: true, tanggalTugas: true, trainingId: true, training: { select: { name: true, startDate: true, endDate: true } } },
    }) as Promise<{ id: string; nomor: string | null; pegawaiIds: string[]; tanggalTugas: unknown; trainingId: string; training: { name: string; startDate: Date; endDate: Date | null } }[]>,
    prisma.cutiPegawai.findMany({
      where: { pegawaiId: { in: ids }, status: "DISETUJUI" },
      select: { pegawaiId: true, jenis: true, mulai: true, selesai: true },
    }) as Promise<{ pegawaiId: string; jenis: string; mulai: Date; selesai: Date }[]>,
    jadwalMengajar(ids, o.trainingId),
  ]);
  // Hari mengajar per (pegawai, diklat) dari jadwal — juga dipakai untuk surat tugas mengajar tanpa tanggal tugas.
  const semuaJadwal = o.trainingId ? await jadwalMengajar(ids) : jadwal;
  const hariDi = (pegawaiId: string, trainingId: string) =>
    rapikanRentang((semuaJadwal.hari.get(pegawaiId) ?? []).filter((h) => h.trainingId === trainingId).map((h) => ({ mulai: h.tanggal, selesai: h.tanggal })));

  const untukPertama = (isi: unknown) => {
    const u = (isi as { untuk?: unknown } | null)?.untuk;
    return Array.isArray(u) && typeof u[0] === "string" ? tanpaKalimatTanggal(u[0]).slice(0, 90) : "";
  };
  for (const n of naskah) {
    const hari = irisanHari(rentang, rapikanRentang(n.tanggalTugas));
    if (!hari.length) continue;
    const ket = `surat tugas ${n.nomor ?? "(konsep)"}${untukPertama(n.isi) ? ` — ${untukPertama(n.isi)}` : ""}`;
    // Satu orang tidak boleh punya dua surat tugas pada tanggal yang sama — konsep pun dihitung
    // (keputusan 19 Okt 2026): konsep lama yang tidak jadi dipakai diubah/dihapus dulu.
    for (const id of n.pegawaiIds.filter((x) => ids.includes(x))) tambah(id, { jenis: "surat-tugas", keterangan: ket, tanggal: hari, tingkat: bolehCegah ? "cegah" : "peringatan" });
  }
  for (const s of surat) {
    const sendiri = rapikanRentang(s.tanggalTugas);
    for (const id of s.pegawaiIds.filter((x) => ids.includes(x))) {
      // Tanpa tanggal tugas: hari mengajar WI itu di diklat tersebut; belum ada jadwal -> periode diklat (perkiraan).
      const hariAjar = sendiri.length ? sendiri : hariDi(id, s.trainingId);
      const pasti = hariAjar.length > 0;
      const r = pasti ? hariAjar : [{ mulai: isoTanggal(s.training.startDate), selesai: isoTanggal(s.training.endDate ?? s.training.startDate) }];
      const hari = irisanHari(rentang, r);
      if (!hari.length) continue;
      // Mengajar ↔ mengajar (kelas berbeda di balai) boleh -> hanya surat tugas keluar yang dicegah.
      const tingkat = pasti && o.konteks === "umum" && bolehCegah ? "cegah" : "peringatan";
      tambah(id, { jenis: "surat-tugas", keterangan: `surat tugas mengajar ${s.nomor ?? "(konsep)"} — ${s.training.name}`, tanggal: hari, tingkat });
    }
  }
  for (const c of cuti) {
    const hari = irisanHari(rentang, [{ mulai: isoTanggal(c.mulai), selesai: isoTanggal(c.selesai) }]);
    if (hari.length) tambah(c.pegawaiId, { jenis: "cuti", keterangan: labelJenisCuti(c.jenis), tanggal: hari, tingkat: o.perkiraan ? "peringatan" : "cegah" });
  }
  for (const id of ids) {
    // Sesi mengajar per diklat: fisik vs e-learning.
    const perDiklat = new Map<string, { training: string; fisik: string[]; daring: string[] }>();
    for (const h of jadwal.hari.get(id) ?? []) {
      if (!irisanHari(rentang, [{ mulai: h.tanggal, selesai: h.tanggal }]).length) continue;
      const g = perDiklat.get(h.trainingId) ?? { training: h.training, fisik: [], daring: [] };
      (h.fisik ? g.fisik : g.daring).push(h.tanggal);
      perDiklat.set(h.trainingId, g);
    }
    for (const g of perDiklat.values()) {
      if (g.fisik.length)
        tambah(id, {
          jenis: "penugasan-wi",
          keterangan: `mengajar klasikal ${g.training}`,
          tanggal: g.fisik.sort(),
          tingkat: o.konteks === "umum" && bolehCegah ? "cegah" : "peringatan",
        });
      if (g.daring.length)
        tambah(id, { jenis: "penugasan-wi", keterangan: `mengajar e-learning ${g.training} (bisa lewat Zoom dari lokasi tugas)`, tanggal: g.daring.sort(), tingkat: "peringatan" });
    }
    for (const t of jadwal.tanpaJadwal.get(id) ?? []) {
      const hari = irisanHari(rentang, t.rentang);
      if (hari.length) tambah(id, { jenis: "penugasan-wi", keterangan: `ditugaskan mengajar ${t.training} (jadwal sesi belum diisi)`, tanggal: hari, tingkat: "peringatan" });
    }
  }
  return hasil;
}

/** Nama pegawai untuk pesan galat. */
export async function namaPegawaiPeta(ids: string[]): Promise<(id: string) => string> {
  const rows: { id: string; nama: string }[] = ids.length ? await prisma.pegawai.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } }) : [];
  const m = new Map(rows.map((r) => [r.id, r.nama]));
  return (id) => m.get(id) ?? id;
}

/** Tolak (ValidationError) bila ada bentrok tingkat "cegah". */
export async function wajibTanpaBentrok(
  pegawaiIds: string[],
  rentang: RentangTanggal[],
  o: { konteks: KonteksBentrok; naskahId?: string | null; suratTugasId?: string | null; trainingId?: string | null; perkiraan?: boolean },
): Promise<void> {
  const peta = await bentrokPegawai(pegawaiIds, rentang, o);
  const pesan = pesanBentrok(await namaPegawaiPeta(Object.keys(peta)), peta);
  if (pesan) throw new ValidationError(pesan);
}
