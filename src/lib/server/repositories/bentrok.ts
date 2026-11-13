import "server-only";
import { prisma } from "@/lib/server/prisma";
import { NotFoundError, ValidationError } from "@/lib/server/errors";
import { isoTanggal } from "@/lib/tanggal";
import { sinkronStatusTraining } from "@/lib/server/repositories/training";
import { hariAjarFisik, irisanHari, labelJenisCuti, pesanBentrok, rapikanRentang, tanpaKalimatTanggal, type BentrokItem, type RentangTanggal } from "@/lib/rentang";

/**
 * Bentrok jadwal pegawai per TANGGAL — disalin dari src/lib/server/repositories/bentrok-tugas.ts
 * aplikasi lama (keputusan 19 Okt 2026). Untuk penetapan pengampu (konteks "penugasan"): dicegah
 * oleh surat tugas KELUAR bernomor/konsep dan cuti disetujui pada hari mengajarnya; mengajar ↔
 * mengajar hanya peringatan; `perkiraan` (periode PKA/PKP tanpa jadwal sesi) = semuanya peringatan.
 */
export type KonteksBentrok = "umum" | "mengajar" | "penugasan";
type HariAjar = { trainingId: string; training: string; tanggal: string; fisik: boolean };

async function jadwalMengajar(pegawaiIds: string[], kecualiTrainingId?: string | null) {
  const hari = new Map<string, HariAjar[]>();
  const tanpaJadwal = new Map<string, { trainingId: string; training: string; rentang: RentangTanggal[] }[]>();
  if (!pegawaiIds.length) return { hari, tanpaJadwal };
  const pen = await prisma.penugasanApproval.findMany({
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
  const sesiPem = trainingIds.length
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
      if (!perTanggal.has(t)) perTanggal.set(t, hariAjarFisik(null, `${s.tempat ?? ""} ${s.kegiatan ?? ""}`));
    }
    if (perTanggal.size) {
      const daftar = hari.get(p.instructorId) ?? [];
      for (const [tanggal, fisik] of perTanggal) daftar.push({ trainingId: p.trainingId, training: p.training.name, tanggal, fisik });
      hari.set(p.instructorId, daftar);
    } else {
      const daftar = tanpaJadwal.get(p.instructorId) ?? [];
      if (!daftar.some((d) => d.trainingId === p.trainingId))
        daftar.push({ trainingId: p.trainingId, training: p.training.name, rentang: [{ mulai: isoTanggal(p.training.startDate), selesai: isoTanggal(p.training.endDate ?? p.training.startDate) }] });
      tanpaJadwal.set(p.instructorId, daftar);
    }
  }
  return { hari, tanpaJadwal };
}

export async function bentrokPegawai(
  pegawaiIds: string[],
  rentangMasuk: RentangTanggal[],
  o: { konteks: KonteksBentrok; trainingId?: string | null; perkiraan?: boolean },
): Promise<Record<string, BentrokItem[]>> {
  const ids = [...new Set(pegawaiIds)];
  const rentang = rapikanRentang(rentangMasuk);
  const hasil: Record<string, BentrokItem[]> = {};
  if (!ids.length || !rentang.length) return hasil;
  const bolehCegah = !o.perkiraan;
  const tambah = (id: string, item: BentrokItem) => (hasil[id] ??= []).push(item);

  const [naskah, surat, cuti, jadwal] = await Promise.all([
    prisma.naskahDinas.findMany({
      where: { jenis: "SURAT_TUGAS", pegawaiIds: { hasSome: ids } },
      select: { id: true, nomor: true, pegawaiIds: true, tanggalTugas: true, isi: true },
    }),
    prisma.suratTugas.findMany({
      where: { pegawaiIds: { hasSome: ids } },
      select: { id: true, nomor: true, pegawaiIds: true, tanggalTugas: true, trainingId: true, training: { select: { name: true, startDate: true, endDate: true } } },
    }),
    prisma.cutiPegawai.findMany({ where: { pegawaiId: { in: ids }, status: "DISETUJUI" }, select: { pegawaiId: true, jenis: true, mulai: true, selesai: true } }),
    jadwalMengajar(ids, o.trainingId),
  ]);
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
    for (const id of n.pegawaiIds.filter((x) => ids.includes(x))) tambah(id, { jenis: "surat-tugas", keterangan: ket, tanggal: hari, tingkat: bolehCegah ? "cegah" : "peringatan" });
  }
  for (const s of surat) {
    const sendiri = rapikanRentang(s.tanggalTugas);
    for (const id of s.pegawaiIds.filter((x) => ids.includes(x))) {
      const hariAjar = sendiri.length ? sendiri : hariDi(id, s.trainingId);
      const pasti = hariAjar.length > 0;
      const r = pasti ? hariAjar : [{ mulai: isoTanggal(s.training.startDate), selesai: isoTanggal(s.training.endDate ?? s.training.startDate) }];
      const hari = irisanHari(rentang, r);
      if (!hari.length) continue;
      const tingkat = pasti && o.konteks === "umum" && bolehCegah ? "cegah" : "peringatan";
      tambah(id, { jenis: "surat-tugas", keterangan: `surat tugas mengajar ${s.nomor ?? "(konsep)"} — ${s.training.name}`, tanggal: hari, tingkat });
    }
  }
  for (const c of cuti) {
    const hari = irisanHari(rentang, [{ mulai: isoTanggal(c.mulai), selesai: isoTanggal(c.selesai) }]);
    if (hari.length) tambah(c.pegawaiId, { jenis: "cuti", keterangan: labelJenisCuti(c.jenis), tanggal: hari, tingkat: o.perkiraan ? "peringatan" : "cegah" });
  }
  for (const id of ids) {
    const perDiklat = new Map<string, { training: string; fisik: string[]; daring: string[] }>();
    for (const h of jadwal.hari.get(id) ?? []) {
      if (!irisanHari(rentang, [{ mulai: h.tanggal, selesai: h.tanggal }]).length) continue;
      const g = perDiklat.get(h.trainingId) ?? { training: h.training, fisik: [], daring: [] };
      (h.fisik ? g.fisik : g.daring).push(h.tanggal);
      perDiklat.set(h.trainingId, g);
    }
    for (const g of perDiklat.values()) {
      if (g.fisik.length)
        tambah(id, { jenis: "penugasan-wi", keterangan: `mengajar klasikal ${g.training}`, tanggal: g.fisik.sort(), tingkat: o.konteks === "umum" && bolehCegah ? "cegah" : "peringatan" });
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

/** Tolak (ValidationError) bila ada bentrok tingkat "cegah". */
export async function wajibTanpaBentrok(pegawaiIds: string[], rentang: RentangTanggal[], o: { konteks: KonteksBentrok; trainingId?: string | null; perkiraan?: boolean }) {
  const peta = await bentrokPegawai(pegawaiIds, rentang, o);
  const ids = Object.keys(peta);
  const rows = ids.length ? await prisma.pegawai.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } }) : [];
  const m = new Map(rows.map((r) => [r.id, r.nama]));
  const pesan = pesanBentrok((id) => m.get(id) ?? id, peta);
  if (pesan) throw new ValidationError(pesan);
}

export type BentrokanKandidat = { trainingId: string; trainingName: string; status: "menunggu" | "disetujui"; periode: string; hariBentrok: number };

/**
 * Pratinjau sebelum menetapkan (peringatan, tidak memblokir): penugasan aktif lain milik WI ini yang
 * periodenya beririsan dengan diklat ini. Sama dengan cekKandidat() aplikasi lama.
 */
export async function cekKandidat(trainingId: string, instructorId: string): Promise<BentrokanKandidat[]> {
  const training = await prisma.training.findUnique({ where: { id: trainingId }, select: { startDate: true, endDate: true } });
  if (!training) throw new NotFoundError(`Training "${trainingId}" tidak ditemukan`);
  await sinkronStatusTraining();
  const hari = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const s = hari(training.startDate);
  const e = training.endDate ? Math.max(s, hari(training.endDate)) : s;
  const rows = await prisma.penugasanApproval.findMany({
    where: { status: { in: ["menunggu", "disetujui"] }, training: { status: { not: "Selesai" } }, instructorId, trainingId: { not: trainingId } },
    select: { id: true, status: true, training: { select: { id: true, name: true, startDate: true, endDate: true } } },
  });
  // Satu baris per diklat (yang disetujui diutamakan).
  const peta = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const ada = peta.get(r.training.id);
    if (!ada || (ada.status !== "disetujui" && r.status === "disetujui")) peta.set(r.training.id, r);
  }
  const hasil: BentrokanKandidat[] = [];
  for (const r of peta.values()) {
    const rs = hari(r.training.startDate);
    const re = r.training.endDate ? Math.max(rs, hari(r.training.endDate)) : rs;
    const mulai = Math.max(s, rs);
    const selesai = Math.min(e, re);
    if (mulai > selesai) continue;
    hasil.push({
      trainingId: r.training.id,
      trainingName: r.training.name,
      status: r.status as BentrokanKandidat["status"],
      periode: rs === re ? fmt(rs) : `${fmt(rs)} – ${fmt(re)}`,
      hariBentrok: Math.round((selesai - mulai) / 86_400_000) + 1,
    });
  }
  return hasil;
}
