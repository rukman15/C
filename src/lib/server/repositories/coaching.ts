import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { peranDari, type AksesRuang, type IdentitasAkun } from "@/lib/server/akses-coaching";
import { labelKelompok, pakaiKelompok } from "@/lib/kelompok";
import { isoTanggal } from "@/lib/tanggal";
import {
  bolehKelola,
  bolehMenulis,
  catatanKosong,
  hitungBelumDibaca,
  peranPenulis,
  periksaCatatan,
  periksaIsi,
  periksaSesiCoaching,
  periksaTopik,
  periksaVideo,
  urutkanSesi,
  urutkanTopik,
  type IsianCatatan,
  type IsianSesiCoaching,
  type IsianVideo,
  type JenisVideo,
  type PeranCoaching,
  type PeranPenulis,
} from "@/lib/coaching";
import type { FaktaCoaching } from "@/lib/perhatian";
import { JENIS_KELOMPOK_COACH } from "@/lib/kelompok";

/**
 * Ruang Coaching (src/lib/coaching.ts, CATATAN-RUANG-COACHING.md). Hak diperiksa lewat `AksesRuang`
 * (src/lib/server/akses-coaching.ts) sebelum fungsi di sini dipanggil; fungsi tulis memeriksa ulang
 * peran yang dibutuhkan supaya aturan berlaku di mana pun repository ini dipakai.
 */

const iso = (d: Date) => d.toISOString();
const tglDb = (t: string) => new Date(`${t}T00:00:00.000Z`);
const rapikan = (t: string | null | undefined) => (t ?? "").trim() || null;

function wajibKelola(a: AksesRuang) {
  if (!bolehKelola(a.peran)) throw new ForbiddenError("Hanya coach kelompok ini atau penyelenggara diklat.");
}
function wajibMenulis(a: AksesRuang) {
  if (!bolehMenulis(a.peran)) throw new ForbiddenError("Pimpinan dan Koordinator WI hanya dapat membaca ruang coaching.");
}

// ------------------------------------------------------------------ PUSTAKA VIDEO

type BarisVideo = { id: string; pegawaiId: string; judul: string; youtubeId: string; jenis: string; keterangan: string | null; updatedAt: Date };

export type VideoPustakaRecord = {
  id: string;
  judul: string;
  youtubeId: string;
  jenis: JenisVideo;
  keterangan: string | null;
  /** Banyaknya kelompok yang memasang video ini. */
  dipakai: number;
  diperbarui: string;
};

async function keVideoPustaka(rows: BarisVideo[]): Promise<VideoPustakaRecord[]> {
  const pakai: { videoId: string }[] = rows.length
    ? await prisma.videoKelompok.findMany({ where: { videoId: { in: rows.map((r) => r.id) } }, select: { videoId: true } })
    : [];
  return rows.map((r) => ({
    id: r.id,
    judul: r.judul,
    youtubeId: r.youtubeId,
    jenis: r.jenis as JenisVideo,
    keterangan: r.keterangan,
    dipakai: pakai.filter((p) => p.videoId === r.id).length,
    diperbarui: iso(r.updatedAt),
  }));
}

export async function listPustaka(pegawaiId: string): Promise<VideoPustakaRecord[]> {
  const rows: BarisVideo[] = await prisma.videoCoaching.findMany({ where: { pegawaiId }, orderBy: [{ jenis: "asc" }, { judul: "asc" }] });
  return keVideoPustaka(rows);
}

function isianVideo(v: IsianVideo) {
  const hasil = periksaVideo(v);
  if ("galat" in hasil) throw new ValidationError(hasil.galat);
  return { judul: v.judul.trim(), youtubeId: hasil.youtubeId, jenis: v.jenis, keterangan: rapikan(v.keterangan) };
}

export async function buatVideo(pegawaiId: string, v: IsianVideo): Promise<VideoPustakaRecord> {
  const data = isianVideo(v);
  const ada = await prisma.videoCoaching.findFirst({ where: { pegawaiId, youtubeId: data.youtubeId }, select: { id: true } });
  if (ada) throw new ConflictError("Video ini sudah ada di pustaka Anda");
  const r: BarisVideo = await prisma.videoCoaching.create({ data: { pegawaiId, ...data } });
  return (await keVideoPustaka([r]))[0];
}

async function videoMilik(pegawaiId: string, id: string): Promise<BarisVideo> {
  const r: BarisVideo | null = await prisma.videoCoaching.findFirst({ where: { id, pegawaiId } });
  if (!r) throw new NotFoundError("Video tidak ditemukan di pustaka Anda");
  return r;
}

export async function ubahVideo(pegawaiId: string, id: string, v: IsianVideo): Promise<VideoPustakaRecord> {
  await videoMilik(pegawaiId, id);
  const data = isianVideo(v);
  const kembar = await prisma.videoCoaching.findFirst({ where: { pegawaiId, youtubeId: data.youtubeId, id: { not: id } }, select: { id: true } });
  if (kembar) throw new ConflictError("Video ini sudah ada di pustaka Anda");
  const r: BarisVideo = await prisma.videoCoaching.update({ where: { id }, data });
  return (await keVideoPustaka([r]))[0];
}

/** Hapus dari pustaka. Bila masih terpasang di kelompok, wajib `paksa` (ikut terlepas dari semua kelompok). */
export async function hapusVideo(pegawaiId: string, id: string, paksa: boolean): Promise<void> {
  await videoMilik(pegawaiId, id);
  const vk: { id: string }[] = await prisma.videoKelompok.findMany({ where: { videoId: id }, select: { id: true } });
  if (vk.length && !paksa) throw new ConflictError(`Video ini masih dipakai di ${vk.length} kelompok. Hapus tetap akan melepasnya dari kelompok tersebut.`);
  if (vk.length) await lepasVideoKelompok(vk.map((x) => x.id));
  await prisma.videoCoaching.deleteMany({ where: { id, pegawaiId } });
}

/** Lepas video dari kelompok: topik yang menautnya tetap ada (tautan dikosongkan), tanda tonton ikut terhapus. */
async function lepasVideoKelompok(ids: string[]) {
  await prisma.topikForum.updateMany({ where: { videoKelompokId: { in: ids } }, data: { videoKelompokId: null } });
  await prisma.videoKelompok.deleteMany({ where: { id: { in: ids } } });
}

// ------------------------------------------------------------------ DAFTAR RUANG

export type RuangRingkasRecord = {
  kelompokId: string;
  label: string;
  training: { id: string; name: string; status: string; startDate: string; endDate: string | null };
  coachNama: string | null;
  peran: PeranCoaching;
  anggota: number;
  sesiBerikutnya: { tanggal: string; jamMulai: string | null; judul: string } | null;
  topikBelumTerjawab: number;
  belumDibaca: number;
};

type BarisKelompok = { id: string; trainingId: string; jenis: string; nomor: number; nama: string | null; coachNama: string | null; coachPegawaiId: string | null; tautan: string | null };
type BarisTraining = { id: string; name: string; status: string; startDate: Date; endDate: Date | null; timKerjaId: string | null; jenisPelatihan: string | null };

/** Ruang coaching yang boleh dibuka akun ini (coach, penyelenggara, peserta anggota, pembaca). */
export async function listRuang(i: IdentitasAkun, hariIni: string): Promise<RuangRingkasRecord[]> {
  const kelompok: BarisKelompok[] = await prisma.kelompokPeserta.findMany({ where: { jenis: JENIS_KELOMPOK_COACH }, orderBy: { nomor: "asc" } });
  if (!kelompok.length) return [];
  const training: BarisTraining[] = await prisma.training.findMany({
    where: { id: { in: [...new Set(kelompok.map((k) => k.trainingId))] } },
    select: { id: true, name: true, status: true, startDate: true, endDate: true, timKerjaId: true, jenisPelatihan: true },
  });
  const tMap = new Map(training.filter((t) => pakaiKelompok(t.jenisPelatihan)).map((t) => [t.id, t]));

  // Keanggotaan akun ini (peserta AKTIF) — satu kueri.
  const milik: { id: string; trainingId: string }[] = await prisma.peserta.findMany({ where: { akunId: i.akunId, status: "AKTIF" }, select: { id: true, trainingId: true } });
  const anggotaSaya: { kelompokId: string; pesertaId: string }[] = milik.length
    ? await prisma.anggotaKelompok.findMany({ where: { pesertaId: { in: milik.map((m) => m.id) }, jenis: JENIS_KELOMPOK_COACH }, select: { kelompokId: true, pesertaId: true } })
    : [];
  const pesertaDi = new Map(anggotaSaya.map((a) => [a.kelompokId, a.pesertaId]));

  const terlihat: { k: BarisKelompok; t: BarisTraining; peran: PeranCoaching }[] = [];
  for (const k of kelompok) {
    const t = tMap.get(k.trainingId);
    if (!t) continue;
    const peran = peranDari(i, k, t, pesertaDi.get(k.id) ?? null);
    if (peran) terlihat.push({ k, t, peran });
  }
  if (!terlihat.length) return [];
  const ids = terlihat.map((x) => x.k.id);
  const [anggota, sesi, topik, baca]: [
    { kelompokId: string; peserta: { status: string } | null }[],
    { kelompokId: string; tanggal: Date | null; jamMulai: string | null; judul: string }[],
    { id: string; kelompokId: string; terjawab: boolean; tersembunyi: boolean; akunId: string | null; createdAt: Date }[],
    { kelompokId: string; terakhirDibaca: Date }[],
  ] = await Promise.all([
    prisma.anggotaKelompok.findMany({ where: { kelompokId: { in: ids } }, select: { kelompokId: true, peserta: { select: { status: true } } } }),
    prisma.sesiCoaching.findMany({ where: { kelompokId: { in: ids }, tanggal: { gte: tglDb(hariIni) } }, select: { kelompokId: true, tanggal: true, jamMulai: true, judul: true } }),
    prisma.topikForum.findMany({ where: { kelompokId: { in: ids } }, select: { id: true, kelompokId: true, terjawab: true, tersembunyi: true, akunId: true, createdAt: true } }),
    prisma.bacaForum.findMany({ where: { akunId: i.akunId, kelompokId: { in: ids } }, select: { kelompokId: true, terakhirDibaca: true } }),
  ]);
  const balasan: { topikId: string; akunId: string | null; tersembunyi: boolean; createdAt: Date }[] = topik.length
    ? await prisma.balasanForum.findMany({ where: { topikId: { in: topik.map((t) => t.id) } }, select: { topikId: true, akunId: true, tersembunyi: true, createdAt: true } })
    : [];
  const kelompokTopik = new Map(topik.map((t) => [t.id, t.kelompokId]));
  const bacaMap = new Map(baca.map((b) => [b.kelompokId, iso(b.terakhirDibaca)]));

  const out = terlihat.map(({ k, t, peran }): RuangRingkasRecord => {
    const depan = urutkanSesi(
      sesi.filter((s) => s.kelompokId === k.id && s.tanggal).map((s) => ({ tanggal: isoTanggal(s.tanggal!), jamMulai: s.jamMulai, judul: s.judul, dibuat: "" })),
    )[0];
    const tulisan = [
      ...topik.filter((x) => x.kelompokId === k.id).map((x) => ({ waktu: iso(x.createdAt), akunId: x.akunId, tersembunyi: x.tersembunyi })),
      ...balasan.filter((b) => kelompokTopik.get(b.topikId) === k.id).map((b) => ({ waktu: iso(b.createdAt), akunId: b.akunId, tersembunyi: b.tersembunyi })),
    ];
    return {
      kelompokId: k.id,
      label: labelKelompok(k),
      training: { id: t.id, name: t.name, status: t.status, startDate: isoTanggal(t.startDate), endDate: t.endDate ? isoTanggal(t.endDate) : null },
      coachNama: k.coachNama,
      peran,
      anggota: anggota.filter((a) => a.kelompokId === k.id && a.peserta?.status === "AKTIF").length,
      sesiBerikutnya: depan ? { tanggal: depan.tanggal!, jamMulai: depan.jamMulai, judul: depan.judul } : null,
      topikBelumTerjawab: topik.filter((x) => x.kelompokId === k.id && !x.terjawab && !x.tersembunyi).length,
      belumDibaca: hitungBelumDibaca(tulisan, i.akunId, bacaMap.get(k.id) ?? null),
    };
  });
  // Diklat yang belum selesai dulu, lalu yang terbaru; dalam satu diklat urut nomor kelompok.
  const selesai = (s: string) => (s === "Selesai" ? 1 : 0);
  return out.sort(
    (a, b) => selesai(a.training.status) - selesai(b.training.status) || b.training.startDate.localeCompare(a.training.startDate) || a.label.localeCompare(b.label, "id", { numeric: true }),
  );
}

// ------------------------------------------------------------------ RUANG (DETAIL)

export type VideoTerpasangRecord = {
  id: string;
  videoId: string;
  judul: string;
  youtubeId: string;
  jenis: JenisVideo;
  keterangan: string | null;
  sesiId: string | null;
  /** Peserta: sudah menandai ditonton. Peran lain: null. */
  ditontonSaya: boolean | null;
  /** Coach/penyelenggara/pembaca: peserta (anggota aktif) yang sudah menonton. Peserta: null. */
  ditonton: { pesertaId: string; nama: string }[] | null;
};
export type CatatanRecord = { pesertaId: string; nama: string; hadir: boolean | null; catatan: string | null; tindakLanjut: string | null; diisiOleh: string; diperbarui: string };
export type SesiCoachingRecord = {
  id: string;
  judul: string;
  tanggal: string | null;
  jamMulai: string | null;
  tautanRapat: string | null;
  keterangan: string | null;
  video: VideoTerpasangRecord[];
  /** Peserta: catatan coach untuk dirinya. Peran lain: null. */
  catatanSaya: CatatanRecord | null;
  /** Coach/penyelenggara/pembaca: semua catatan sesi ini. Peserta: null. */
  catatan: CatatanRecord[] | null;
};
export type RuangCoachingRecord = {
  kelompok: { id: string; label: string; coachNama: string | null; tautan: string | null };
  training: { id: string; name: string; status: string; startDate: string; endDate: string | null };
  peran: PeranCoaching;
  bolehKelola: boolean;
  bolehMenulis: boolean;
  anggota: { pesertaId: string; nomor: number; nama: string; instansi: string | null }[];
  /** Video yang tidak terikat sesi (mis. pengantar). */
  videoUmum: VideoTerpasangRecord[];
  sesi: SesiCoachingRecord[];
  /** Pilihan video untuk dipasang (milik sendiri + milik coach). Hanya untuk yang boleh kelola. */
  pustaka: (VideoPustakaRecord & { pemilik: string })[] | null;
  forum: { topik: number; belumTerjawab: number; belumDibaca: number };
};

type BarisSesi = { id: string; judul: string; tanggal: Date | null; jamMulai: string | null; tautanRapat: string | null; keterangan: string | null; createdAt: Date };
type BarisVk = { id: string; videoId: string; sesiId: string | null; createdAt: Date };
type BarisCatatan = { sesiId: string; pesertaId: string; hadir: boolean | null; catatan: string | null; tindakLanjut: string | null; diisiOleh: string; updatedAt: Date };

async function anggotaAktif(kelompokId: string) {
  const rows: { peserta: { id: string; nomor: number; nama: string; instansi: string | null; status: string } | null }[] = await prisma.anggotaKelompok.findMany({
    where: { kelompokId },
    select: { peserta: { select: { id: true, nomor: true, nama: true, instansi: true, status: true } } },
  });
  return rows
    .map((r) => r.peserta)
    .filter((p): p is NonNullable<typeof p> => !!p && p.status === "AKTIF")
    .sort((a, b) => a.nomor - b.nomor)
    .map((p) => ({ pesertaId: p.id, nomor: p.nomor, nama: p.nama, instansi: p.instansi }));
}

export async function getRuang(a: AksesRuang): Promise<RuangCoachingRecord> {
  const kid = a.kelompok.id;
  const kelola = bolehKelola(a.peran);
  const lihatSemua = a.peran !== "peserta";
  const [anggota, sesiRows, vkRows]: [Awaited<ReturnType<typeof anggotaAktif>>, BarisSesi[], BarisVk[]] = await Promise.all([
    anggotaAktif(kid),
    prisma.sesiCoaching.findMany({ where: { kelompokId: kid } }),
    prisma.videoKelompok.findMany({ where: { kelompokId: kid }, orderBy: { createdAt: "asc" } }),
  ]);
  const nama = new Map(anggota.map((x) => [x.pesertaId, x.nama]));
  const [videoRows, tonton, catatanRows]: [BarisVideo[], { videoKelompokId: string; pesertaId: string }[], BarisCatatan[]] = await Promise.all([
    vkRows.length ? prisma.videoCoaching.findMany({ where: { id: { in: vkRows.map((v) => v.videoId) } } }) : [],
    vkRows.length
      ? prisma.tontonVideo.findMany({
          where: { videoKelompokId: { in: vkRows.map((v) => v.id) }, ...(lihatSemua ? {} : { pesertaId: a.pesertaId ?? "" }) },
          select: { videoKelompokId: true, pesertaId: true },
        })
      : [],
    sesiRows.length
      ? prisma.catatanCoaching.findMany({ where: { sesiId: { in: sesiRows.map((s) => s.id) }, ...(lihatSemua ? {} : { pesertaId: a.pesertaId ?? "" }) } })
      : [],
  ]);
  const vMap = new Map(videoRows.map((v) => [v.id, v]));
  const video: VideoTerpasangRecord[] = vkRows
    .filter((vk) => vMap.has(vk.videoId))
    .map((vk) => {
      const v = vMap.get(vk.videoId)!;
      const penonton = tonton.filter((t) => t.videoKelompokId === vk.id);
      return {
        id: vk.id,
        videoId: v.id,
        judul: v.judul,
        youtubeId: v.youtubeId,
        jenis: v.jenis as JenisVideo,
        keterangan: v.keterangan,
        sesiId: vk.sesiId,
        ditontonSaya: lihatSemua ? null : penonton.length > 0,
        // Hanya anggota aktif yang dihitung (peserta keluar tidak lagi tampil).
        ditonton: lihatSemua ? penonton.filter((t) => nama.has(t.pesertaId)).map((t) => ({ pesertaId: t.pesertaId, nama: nama.get(t.pesertaId)! })) : null,
      };
    })
    // Pengantar di atas, lalu materi, lalu rekaman.
    .sort((x, y) => ["PENGANTAR", "MATERI", "REKAMAN"].indexOf(x.jenis) - ["PENGANTAR", "MATERI", "REKAMAN"].indexOf(y.jenis));

  const keCatatan = (c: BarisCatatan): CatatanRecord => ({
    pesertaId: c.pesertaId,
    nama: nama.get(c.pesertaId) ?? "(bukan anggota lagi)",
    hadir: c.hadir,
    catatan: c.catatan,
    tindakLanjut: c.tindakLanjut,
    diisiOleh: c.diisiOleh,
    diperbarui: iso(c.updatedAt),
  });
  const sesi = urutkanSesi(
    sesiRows.map((s) => ({
      id: s.id,
      judul: s.judul,
      tanggal: s.tanggal ? isoTanggal(s.tanggal) : null,
      jamMulai: s.jamMulai,
      tautanRapat: s.tautanRapat,
      keterangan: s.keterangan,
      dibuat: iso(s.createdAt),
    })),
  ).map(({ dibuat: _d, ...s }): SesiCoachingRecord => {
    const catatanSesi = catatanRows.filter((c) => c.sesiId === s.id);
    return {
      ...s,
      video: video.filter((v) => v.sesiId === s.id),
      catatanSaya: lihatSemua ? null : catatanSesi[0] ? keCatatan(catatanSesi[0]) : null,
      catatan: lihatSemua ? catatanSesi.map(keCatatan).sort((x, y) => x.nama.localeCompare(y.nama, "id")) : null,
    };
  });

  let pustaka: RuangCoachingRecord["pustaka"] = null;
  if (kelola) {
    const pemilik = [...new Set([a.pegawaiId, a.kelompok.coachPegawaiId].filter((x): x is string => !!x))];
    const rows: BarisVideo[] = pemilik.length ? await prisma.videoCoaching.findMany({ where: { pegawaiId: { in: pemilik } }, orderBy: { judul: "asc" } }) : [];
    const namaPemilik: { id: string; nama: string }[] = pemilik.length ? await prisma.pegawai.findMany({ where: { id: { in: pemilik } }, select: { id: true, nama: true } }) : [];
    const rec = await keVideoPustaka(rows);
    pustaka = rec.map((v, idx) => ({ ...v, pemilik: rows[idx].pegawaiId === a.pegawaiId ? "Saya" : (namaPemilik.find((p) => p.id === rows[idx].pegawaiId)?.nama ?? "Coach") }));
  }

  return {
    kelompok: { id: kid, label: a.kelompok.label, coachNama: a.kelompok.coachNama, tautan: a.kelompok.tautan },
    training: {
      id: a.training.id,
      name: a.training.name,
      status: a.training.status,
      startDate: isoTanggal(a.training.startDate),
      endDate: a.training.endDate ? isoTanggal(a.training.endDate) : null,
    },
    peran: a.peran,
    bolehKelola: kelola,
    bolehMenulis: bolehMenulis(a.peran),
    anggota,
    videoUmum: video.filter((v) => !v.sesiId),
    sesi,
    pustaka,
    forum: await ringkasForum(a),
  };
}

// ------------------------------------------------------------------ SESI, VIDEO, CATATAN (aksi)

async function sesiDiKelompok(kelompokId: string, sesiId: string): Promise<BarisSesi> {
  const s: BarisSesi | null = await prisma.sesiCoaching.findFirst({ where: { id: sesiId, kelompokId } });
  if (!s) throw new NotFoundError("Sesi coaching tidak ditemukan");
  return s;
}

export async function simpanSesi(a: AksesRuang, id: string | null, s: IsianSesiCoaching): Promise<{ id: string }> {
  wajibKelola(a);
  const hasil = periksaSesiCoaching(s);
  if ("galat" in hasil) throw new ValidationError(hasil.galat);
  const data = {
    judul: s.judul.trim(),
    tanggal: s.tanggal ? tglDb(s.tanggal) : null,
    jamMulai: s.jamMulai || null,
    tautanRapat: hasil.tautanRapat,
    keterangan: rapikan(s.keterangan),
  };
  if (id) {
    await sesiDiKelompok(a.kelompok.id, id);
    await prisma.sesiCoaching.update({ where: { id }, data });
    return { id };
  }
  const r: { id: string } = await prisma.sesiCoaching.create({ data: { ...data, kelompokId: a.kelompok.id, dibuatOleh: a.email } });
  return { id: r.id };
}

/** Hapus sesi: catatannya ikut terhapus; video & topik yang tertaut tetap ada (tidak lagi terikat sesi). */
export async function hapusSesi(a: AksesRuang, id: string): Promise<void> {
  wajibKelola(a);
  await sesiDiKelompok(a.kelompok.id, id);
  await prisma.videoKelompok.updateMany({ where: { sesiId: id }, data: { sesiId: null } });
  await prisma.topikForum.updateMany({ where: { sesiId: id }, data: { sesiId: null } });
  await prisma.catatanCoaching.deleteMany({ where: { sesiId: id } });
  await prisma.sesiCoaching.deleteMany({ where: { id, kelompokId: a.kelompok.id } });
}

/**
 * Pasang video pustaka di kelompok (atau pindahkan ke sesi lain bila sudah terpasang). Coach memasang
 * videonya sendiri; penyelenggara boleh memasang videonya sendiri atau video milik coach kelompok ini.
 */
export async function pasangVideo(a: AksesRuang, videoId: string, sesiId: string | null): Promise<{ id: string }> {
  wajibKelola(a);
  const v: { id: string; pegawaiId: string } | null = await prisma.videoCoaching.findUnique({ where: { id: videoId }, select: { id: true, pegawaiId: true } });
  const bolehPakai = !!v && ((!!a.pegawaiId && v.pegawaiId === a.pegawaiId) || (a.peran === "penyelenggara" && v.pegawaiId === a.kelompok.coachPegawaiId));
  if (!v || !bolehPakai) throw new NotFoundError("Video tidak ditemukan di pustaka yang boleh dipakai");
  if (sesiId) await sesiDiKelompok(a.kelompok.id, sesiId);
  const ada: { id: string } | null = await prisma.videoKelompok.findFirst({ where: { kelompokId: a.kelompok.id, videoId }, select: { id: true } });
  if (ada) {
    await prisma.videoKelompok.update({ where: { id: ada.id }, data: { sesiId } });
    return { id: ada.id };
  }
  const r: { id: string } = await prisma.videoKelompok.create({ data: { kelompokId: a.kelompok.id, videoId, sesiId, dipasangOleh: a.email } });
  return { id: r.id };
}

async function videoDiKelompok(kelompokId: string, id: string): Promise<{ id: string; videoId: string }> {
  const vk: { id: string; videoId: string } | null = await prisma.videoKelompok.findFirst({ where: { id, kelompokId }, select: { id: true, videoId: true } });
  if (!vk) throw new NotFoundError("Video tidak terpasang di kelompok ini");
  return vk;
}

export async function lepasVideo(a: AksesRuang, id: string): Promise<void> {
  wajibKelola(a);
  await videoDiKelompok(a.kelompok.id, id);
  await lepasVideoKelompok([id]);
}

/** Peserta menandai sudah/belum menonton satu video kelompoknya. */
export async function tandaiTonton(a: AksesRuang, id: string, sudah: boolean): Promise<void> {
  if (a.peran !== "peserta" || !a.pesertaId) throw new ForbiddenError("Tanda sudah menonton diisi oleh peserta sendiri.");
  await videoDiKelompok(a.kelompok.id, id);
  const ada: { id: string } | null = await prisma.tontonVideo.findFirst({ where: { videoKelompokId: id, pesertaId: a.pesertaId }, select: { id: true } });
  if (sudah && !ada) await prisma.tontonVideo.create({ data: { videoKelompokId: id, pesertaId: a.pesertaId } });
  if (!sudah && ada) await prisma.tontonVideo.deleteMany({ where: { id: ada.id } });
}

/** Catatan coach untuk satu peserta pada satu sesi. Isian kosong = catatan dihapus. */
export async function simpanCatatan(a: AksesRuang, sesiId: string, pesertaId: string, c: IsianCatatan): Promise<void> {
  wajibKelola(a);
  await sesiDiKelompok(a.kelompok.id, sesiId);
  if (!(await anggotaAktif(a.kelompok.id)).some((x) => x.pesertaId === pesertaId)) throw new NotFoundError("Peserta bukan anggota aktif kelompok ini");
  const galat = periksaCatatan(c);
  if (galat) throw new ValidationError(galat);
  const ada: { id: string } | null = await prisma.catatanCoaching.findFirst({ where: { sesiId, pesertaId }, select: { id: true } });
  if (catatanKosong(c)) {
    if (ada) await prisma.catatanCoaching.deleteMany({ where: { id: ada.id } });
    return;
  }
  const data = { hadir: c.hadir ?? null, catatan: rapikan(c.catatan), tindakLanjut: rapikan(c.tindakLanjut), diisiOleh: a.nama };
  if (ada) await prisma.catatanCoaching.update({ where: { id: ada.id }, data });
  else await prisma.catatanCoaching.create({ data: { sesiId, pesertaId, ...data } });
}

// ------------------------------------------------------------------ FORUM

type BarisTopik = {
  id: string;
  kelompokId: string;
  sesiId: string | null;
  videoKelompokId: string | null;
  judul: string;
  isi: string;
  akunId: string | null;
  namaPenulis: string;
  peranPenulis: string;
  disematkan: boolean;
  terjawab: boolean;
  terjawabOleh: string | null;
  tersembunyi: boolean;
  disembunyikanOleh: string | null;
  diubahPada: Date | null;
  aktifPada: Date;
  createdAt: Date;
};
type BarisBalasan = {
  id: string;
  topikId: string;
  isi: string;
  akunId: string | null;
  namaPenulis: string;
  peranPenulis: string;
  tersembunyi: boolean;
  disembunyikanOleh: string | null;
  diubahPada: Date | null;
  createdAt: Date;
};

export type TulisanRecord = {
  id: string;
  /** null = disembunyikan (peserta tidak melihat isinya). */
  isi: string | null;
  namaPenulis: string;
  peranPenulis: PeranPenulis;
  milikSaya: boolean;
  tersembunyi: boolean;
  disembunyikanOleh: string | null;
  diubah: boolean;
  waktu: string;
};
export type TopikRingkasRecord = {
  id: string;
  judul: string | null;
  namaPenulis: string;
  peranPenulis: PeranPenulis;
  disematkan: boolean;
  terjawab: boolean;
  tersembunyi: boolean;
  balasan: number;
  waktu: string;
  aktifPada: string;
  /** Ada tulisan orang lain sejak terakhir membuka forum. */
  baru: boolean;
  sesi: { id: string; judul: string } | null;
  video: { id: string; judul: string } | null;
};
export type TopikRecord = TopikRingkasRecord & {
  topik: TulisanRecord;
  terjawabOleh: string | null;
  balasanList: TulisanRecord[];
};

/** Isi tersembunyi hanya terlihat oleh coach, penyelenggara, dan pembaca (jejak moderasi). */
const lihatTersembunyi = (p: PeranCoaching) => p !== "peserta";

function keTulisan(a: AksesRuang, r: { id: string; isi: string; akunId: string | null; namaPenulis: string; peranPenulis: string; tersembunyi: boolean; disembunyikanOleh: string | null; diubahPada: Date | null; createdAt: Date }): TulisanRecord {
  return {
    id: r.id,
    isi: r.tersembunyi && !lihatTersembunyi(a.peran) ? null : r.isi,
    namaPenulis: r.namaPenulis,
    peranPenulis: r.peranPenulis as PeranPenulis,
    milikSaya: r.akunId === a.akunId,
    tersembunyi: r.tersembunyi,
    disembunyikanOleh: r.disembunyikanOleh,
    diubah: !!r.diubahPada,
    waktu: iso(r.createdAt),
  };
}

async function terakhirDibaca(a: AksesRuang): Promise<string | null> {
  const b: { terakhirDibaca: Date } | null = await prisma.bacaForum.findFirst({ where: { kelompokId: a.kelompok.id, akunId: a.akunId }, select: { terakhirDibaca: true } });
  return b ? iso(b.terakhirDibaca) : null;
}

async function tandaiDibaca(a: AksesRuang, waktu: Date): Promise<void> {
  const ada: { id: string } | null = await prisma.bacaForum.findFirst({ where: { kelompokId: a.kelompok.id, akunId: a.akunId }, select: { id: true } });
  if (ada) await prisma.bacaForum.update({ where: { id: ada.id }, data: { terakhirDibaca: waktu } });
  else await prisma.bacaForum.create({ data: { kelompokId: a.kelompok.id, akunId: a.akunId, terakhirDibaca: waktu } });
}

async function semuaTulisan(kelompokId: string): Promise<{ topik: BarisTopik[]; balasan: BarisBalasan[] }> {
  const topik: BarisTopik[] = await prisma.topikForum.findMany({ where: { kelompokId } });
  const balasan: BarisBalasan[] = topik.length ? await prisma.balasanForum.findMany({ where: { topikId: { in: topik.map((t) => t.id) } }, orderBy: { createdAt: "asc" } }) : [];
  return { topik, balasan };
}

async function ringkasForum(a: AksesRuang): Promise<RuangCoachingRecord["forum"]> {
  const { topik, balasan } = await semuaTulisan(a.kelompok.id);
  const tulisan = [
    ...topik.map((t) => ({ waktu: iso(t.createdAt), akunId: t.akunId, tersembunyi: t.tersembunyi })),
    ...balasan.map((b) => ({ waktu: iso(b.createdAt), akunId: b.akunId, tersembunyi: b.tersembunyi })),
  ];
  return {
    topik: topik.filter((t) => !t.tersembunyi || lihatTersembunyi(a.peran)).length,
    belumTerjawab: topik.filter((t) => !t.terjawab && !t.tersembunyi).length,
    belumDibaca: hitungBelumDibaca(tulisan, a.akunId, await terakhirDibaca(a)),
  };
}

async function tautanTopik(kelompokId: string, topik: BarisTopik[]) {
  const sesiIds = [...new Set(topik.map((t) => t.sesiId).filter((x): x is string => !!x))];
  const vkIds = [...new Set(topik.map((t) => t.videoKelompokId).filter((x): x is string => !!x))];
  const sesi: { id: string; judul: string }[] = sesiIds.length ? await prisma.sesiCoaching.findMany({ where: { id: { in: sesiIds }, kelompokId }, select: { id: true, judul: true } }) : [];
  const vk: { id: string; videoId: string }[] = vkIds.length ? await prisma.videoKelompok.findMany({ where: { id: { in: vkIds }, kelompokId }, select: { id: true, videoId: true } }) : [];
  const video: { id: string; judul: string }[] = vk.length ? await prisma.videoCoaching.findMany({ where: { id: { in: vk.map((v) => v.videoId) } }, select: { id: true, judul: true } }) : [];
  return {
    sesi: new Map(sesi.map((s) => [s.id, s])),
    video: new Map(vk.map((v) => [v.id, { id: v.id, judul: video.find((x) => x.id === v.videoId)?.judul ?? "(video)" }])),
  };
}

function keRingkas(a: AksesRuang, t: BarisTopik, balasan: BarisBalasan[], dibaca: string | null, tautan: Awaited<ReturnType<typeof tautanTopik>>): TopikRingkasRecord {
  const milikTopik = balasan.filter((b) => b.topikId === t.id);
  const tampil = !t.tersembunyi || lihatTersembunyi(a.peran);
  const tulisan = [{ waktu: iso(t.createdAt), akunId: t.akunId, tersembunyi: t.tersembunyi }, ...milikTopik.map((b) => ({ waktu: iso(b.createdAt), akunId: b.akunId, tersembunyi: b.tersembunyi }))];
  return {
    id: t.id,
    judul: tampil ? t.judul : null,
    namaPenulis: t.namaPenulis,
    peranPenulis: t.peranPenulis as PeranPenulis,
    disematkan: t.disematkan,
    terjawab: t.terjawab,
    tersembunyi: t.tersembunyi,
    balasan: milikTopik.filter((b) => !b.tersembunyi || lihatTersembunyi(a.peran)).length,
    waktu: iso(t.createdAt),
    aktifPada: iso(t.aktifPada),
    baru: hitungBelumDibaca(tulisan, a.akunId, dibaca) > 0,
    sesi: t.sesiId ? (tautan.sesi.get(t.sesiId) ?? null) : null,
    video: t.videoKelompokId ? (tautan.video.get(t.videoKelompokId) ?? null) : null,
  };
}

/** Daftar topik forum. Membuka daftar = semua tulisan dianggap sudah dibaca. */
export async function listTopik(a: AksesRuang, now: Date = new Date()): Promise<TopikRingkasRecord[]> {
  const { topik, balasan } = await semuaTulisan(a.kelompok.id);
  const dibaca = await terakhirDibaca(a);
  const tautan = await tautanTopik(a.kelompok.id, topik);
  const hasil = urutkanTopik(topik.map((t) => keRingkas(a, t, balasan, dibaca, tautan)));
  await tandaiDibaca(a, now);
  return hasil;
}

async function topikDiKelompok(kelompokId: string, id: string): Promise<BarisTopik> {
  const t: BarisTopik | null = await prisma.topikForum.findFirst({ where: { id, kelompokId } });
  if (!t) throw new NotFoundError("Topik tidak ditemukan");
  return t;
}

export async function getTopik(a: AksesRuang, id: string, now: Date = new Date()): Promise<TopikRecord> {
  const t = await topikDiKelompok(a.kelompok.id, id);
  const balasan: BarisBalasan[] = await prisma.balasanForum.findMany({ where: { topikId: id }, orderBy: { createdAt: "asc" } });
  const dibaca = await terakhirDibaca(a);
  const ringkas = keRingkas(a, t, balasan, dibaca, await tautanTopik(a.kelompok.id, [t]));
  await tandaiDibaca(a, now);
  return {
    ...ringkas,
    topik: keTulisan(a, t),
    terjawabOleh: t.terjawabOleh,
    balasanList: balasan.map((b) => keTulisan(a, b)),
  };
}

export async function buatTopik(a: AksesRuang, i: { judul: string; isi: string; sesiId?: string | null; videoKelompokId?: string | null }): Promise<{ id: string }> {
  wajibMenulis(a);
  const galat = periksaTopik(i);
  if (galat) throw new ValidationError(galat);
  if (i.sesiId) await sesiDiKelompok(a.kelompok.id, i.sesiId);
  if (i.videoKelompokId) await videoDiKelompok(a.kelompok.id, i.videoKelompokId);
  const r: { id: string } = await prisma.topikForum.create({
    data: {
      kelompokId: a.kelompok.id,
      sesiId: i.sesiId ?? null,
      videoKelompokId: i.videoKelompokId ?? null,
      judul: i.judul.trim(),
      isi: i.isi.trim(),
      akunId: a.akunId,
      namaPenulis: a.nama,
      peranPenulis: peranPenulis(a.peran),
    },
  });
  return { id: r.id };
}

export async function balasTopik(a: AksesRuang, topikId: string, isi: string, now: Date = new Date()): Promise<{ id: string }> {
  wajibMenulis(a);
  const t = await topikDiKelompok(a.kelompok.id, topikId);
  if (t.tersembunyi) throw new ConflictError("Topik ini disembunyikan dan tidak bisa dibalas");
  const galat = periksaIsi(isi);
  if (galat) throw new ValidationError(galat);
  const r: { id: string } = await prisma.balasanForum.create({
    data: { topikId, isi: isi.trim(), akunId: a.akunId, namaPenulis: a.nama, peranPenulis: peranPenulis(a.peran) },
  });
  await prisma.topikForum.update({ where: { id: topikId }, data: { aktifPada: now } });
  return { id: r.id };
}

/** Penulis mengubah tulisannya sendiri (ditandai "diubah"). Tulisan yang disembunyikan tidak bisa diubah. */
export async function ubahTopik(a: AksesRuang, id: string, i: { judul: string; isi: string }, now: Date = new Date()): Promise<void> {
  wajibMenulis(a);
  const t = await topikDiKelompok(a.kelompok.id, id);
  if (t.akunId !== a.akunId) throw new ForbiddenError("Hanya penulis yang dapat mengubah tulisannya.");
  if (t.tersembunyi) throw new ConflictError("Tulisan yang disembunyikan tidak bisa diubah");
  const galat = periksaTopik(i);
  if (galat) throw new ValidationError(galat);
  await prisma.topikForum.update({ where: { id }, data: { judul: i.judul.trim(), isi: i.isi.trim(), diubahPada: now } });
}

async function balasanDiKelompok(kelompokId: string, id: string): Promise<BarisBalasan> {
  const b: BarisBalasan | null = await prisma.balasanForum.findUnique({ where: { id } });
  if (!b) throw new NotFoundError("Balasan tidak ditemukan");
  await topikDiKelompok(kelompokId, b.topikId);
  return b;
}

export async function ubahBalasan(a: AksesRuang, id: string, isi: string, now: Date = new Date()): Promise<void> {
  wajibMenulis(a);
  const b = await balasanDiKelompok(a.kelompok.id, id);
  if (b.akunId !== a.akunId) throw new ForbiddenError("Hanya penulis yang dapat mengubah tulisannya.");
  if (b.tersembunyi) throw new ConflictError("Tulisan yang disembunyikan tidak bisa diubah");
  const galat = periksaIsi(isi);
  if (galat) throw new ValidationError(galat);
  await prisma.balasanForum.update({ where: { id }, data: { isi: isi.trim(), diubahPada: now } });
}

/** Sematkan / tandai terjawab topik. Sematkan: coach & penyelenggara. Terjawab: juga penanya sendiri. */
export async function aturTopik(a: AksesRuang, id: string, i: { disematkan?: boolean; terjawab?: boolean }): Promise<void> {
  const t = await topikDiKelompok(a.kelompok.id, id);
  if (i.disematkan !== undefined) wajibKelola(a);
  if (i.terjawab !== undefined && !bolehKelola(a.peran) && t.akunId !== a.akunId) {
    throw new ForbiddenError("Hanya penanya, coach, atau penyelenggara yang menandai pertanyaan terjawab.");
  }
  await prisma.topikForum.update({
    where: { id },
    data: {
      ...(i.disematkan !== undefined ? { disematkan: i.disematkan } : {}),
      ...(i.terjawab !== undefined ? { terjawab: i.terjawab, terjawabOleh: i.terjawab ? a.nama : null } : {}),
    },
  });
}

/** Sembunyikan / tampilkan lagi topik atau balasan (coach & penyelenggara). Isi tetap tersimpan. */
export async function sembunyikan(a: AksesRuang, jenis: "topik" | "balasan", id: string, sembunyi: boolean, now: Date = new Date()): Promise<{ penulis: string; kutipan: string }> {
  wajibKelola(a);
  const data = sembunyi ? { tersembunyi: true, disembunyikanOleh: a.nama, disembunyikanPada: now } : { tersembunyi: false, disembunyikanOleh: null, disembunyikanPada: null };
  if (jenis === "topik") {
    const t = await topikDiKelompok(a.kelompok.id, id);
    await prisma.topikForum.update({ where: { id }, data });
    return { penulis: t.namaPenulis, kutipan: t.judul };
  }
  const b = await balasanDiKelompok(a.kelompok.id, id);
  await prisma.balasanForum.update({ where: { id }, data });
  return { penulis: b.namaPenulis, kutipan: b.isi };
}

// ------------------------------------------------------------------ PERLU PERHATIAN

export async function faktaCoaching(i: Pick<IdentitasAkun, "akunId"> & { pegawaiId: string | null }): Promise<FaktaCoaching> {
  const fakta: FaktaCoaching = { belumTerjawab: [], peserta: [] };
  const aktif = async (trainingIds: string[]) => {
    const t: { id: string; name: string; status: string; jenisPelatihan: string | null }[] = trainingIds.length
      ? await prisma.training.findMany({ where: { id: { in: [...new Set(trainingIds)] } }, select: { id: true, name: true, status: true, jenisPelatihan: true } })
      : [];
    return new Map(t.filter((x) => x.status !== "Selesai" && pakaiKelompok(x.jenisPelatihan)).map((x) => [x.id, x.name]));
  };

  if (i.pegawaiId) {
    const dibimbing: BarisKelompok[] = await prisma.kelompokPeserta.findMany({ where: { coachPegawaiId: i.pegawaiId, jenis: JENIS_KELOMPOK_COACH } });
    const nama = await aktif(dibimbing.map((k) => k.trainingId));
    const ids = dibimbing.filter((k) => nama.has(k.trainingId)).map((k) => k.id);
    const topik: { kelompokId: string }[] = ids.length
      ? await prisma.topikForum.findMany({ where: { kelompokId: { in: ids }, terjawab: false, tersembunyi: false }, select: { kelompokId: true } })
      : [];
    for (const k of dibimbing) {
      const jumlah = topik.filter((t) => t.kelompokId === k.id).length;
      if (jumlah && nama.has(k.trainingId)) fakta.belumTerjawab.push({ kelompokId: k.id, label: labelKelompok(k), training: nama.get(k.trainingId)!, jumlah });
    }
  }

  const milik: { id: string; trainingId: string }[] = await prisma.peserta.findMany({ where: { akunId: i.akunId, status: "AKTIF" }, select: { id: true, trainingId: true } });
  if (milik.length) {
    const nama = await aktif(milik.map((m) => m.trainingId));
    const anggota: { kelompokId: string; pesertaId: string }[] = await prisma.anggotaKelompok.findMany({
      where: { pesertaId: { in: milik.filter((m) => nama.has(m.trainingId)).map((m) => m.id) }, jenis: JENIS_KELOMPOK_COACH },
      select: { kelompokId: true, pesertaId: true },
    });
    for (const an of anggota) {
      const k: BarisKelompok | null = await prisma.kelompokPeserta.findUnique({ where: { id: an.kelompokId } });
      if (!k) continue;
      const { topik, balasan } = await semuaTulisan(k.id);
      const b: { terakhirDibaca: Date } | null = await prisma.bacaForum.findFirst({ where: { kelompokId: k.id, akunId: i.akunId }, select: { terakhirDibaca: true } });
      const belumDibaca = hitungBelumDibaca(
        [...topik.map((t) => ({ waktu: iso(t.createdAt), akunId: t.akunId, tersembunyi: t.tersembunyi })), ...balasan.map((x) => ({ waktu: iso(x.createdAt), akunId: x.akunId, tersembunyi: x.tersembunyi }))],
        i.akunId,
        b ? iso(b.terakhirDibaca) : null,
      );
      const vk: { id: string; videoId: string }[] = await prisma.videoKelompok.findMany({ where: { kelompokId: k.id }, select: { id: true, videoId: true } });
      const pengantar: { id: string }[] = vk.length ? await prisma.videoCoaching.findMany({ where: { id: { in: vk.map((v) => v.videoId) }, jenis: "PENGANTAR" }, select: { id: true } }) : [];
      const vkPengantar = vk.filter((v) => pengantar.some((p) => p.id === v.videoId)).map((v) => v.id);
      const sudah: { videoKelompokId: string }[] = vkPengantar.length
        ? await prisma.tontonVideo.findMany({ where: { videoKelompokId: { in: vkPengantar }, pesertaId: an.pesertaId }, select: { videoKelompokId: true } })
        : [];
      const pengantarBelumDitonton = vkPengantar.length - sudah.length;
      if (belumDibaca || pengantarBelumDitonton) fakta.peserta.push({ kelompokId: k.id, label: labelKelompok(k), belumDibaca, pengantarBelumDitonton });
    }
  }
  return fakta;
}
