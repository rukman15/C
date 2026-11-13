import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { getTrainingByIdOrThrow } from "@/lib/server/repositories/training";
import { statusDokumenPeserta } from "@/lib/server/repositories/dokumen-peserta";
import { getJenjang } from "@/lib/kurikulum";
import {
  JUMLAH_SOAL_MAKS,
  LABEL_JENIS_TES,
  SOAL_MAKS_PER_IMPOR,
  TENGGANG_DETIK,
  analisisButir,
  batasPengerjaan,
  buatUrutan,
  isProgramTes,
  kategoriGain,
  nGain,
  nilaiJawaban,
  normalTeks,
  periksaSoal,
  ringkasKelas,
  sebaranKisi,
  sisaDetik,
  statusTes,
  susunPaket,
  type ButirHasil,
  type JenisTes,
  type Kisi,
  type ProgramTes,
  type StatusSoal,
  type StatusTesBerlaku,
  type UrutanSoal,
} from "@/lib/tes";

/**
 * Pre-test & post-test (BARU). Tiga bagian:
 *  1. Bank soal per program — admin & Ketua Diklat (penyelenggara) mengelola semua
 *     soal; Widyaiswara menyusun soalnya sendiri (masuk "Menunggu diperiksa").
 *     Admin boleh menginput atas nama WI (kolom penyusun) bila WI belum membuat.
 *  2. Tes per jadwal diklat — paket soal, jendela waktu, durasi, terbit/tutup,
 *     pemantauan, reset pengerjaan, hasil & analisis butir.
 *  3. Pengerjaan peserta — sekali kerja, waktu dihitung server, jawaban
 *     tersimpan otomatis, kunci jawaban tidak pernah dikirim ke peserta.
 */

export type Pelaku = {
  peran: "PENYELENGGARA" | "WI" | "PIMPINAN";
  email: string;
  nama: string;
  pegawaiId: string | null;
};

type SoalRow = {
  id: string;
  program: string;
  kisi: string;
  pertanyaan: string;
  opsi: unknown;
  kunci: number;
  pembahasan: string | null;
  status: string;
  catatanPeriksa: string | null;
  penyusun: string | null;
  dibuatOleh: string;
  pegawaiId: string | null;
  diperiksaOleh: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TesRow = {
  id: string;
  trainingId: string;
  jenis: string;
  status: string;
  buka: Date | null;
  tutup: Date | null;
  durasiMenit: number;
  soalIds: unknown;
  acakSoal: boolean;
  acakOpsi: boolean;
  tampilkanHasil: boolean;
  diubahOleh: string;
  updatedAt: Date;
};

type PengerjaanRow = {
  id: string;
  tesId: string;
  pesertaId: string;
  mulai: Date;
  batas: Date;
  selesai: Date | null;
  urutan: unknown;
  jawaban: unknown;
  benar: number | null;
  jumlahSoal: number;
  skor: number | null;
};

const daftarTeks = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const opsiDari = (v: unknown): string[] => daftarTeks(v);
const urutanDari = (v: unknown): UrutanSoal[] =>
  Array.isArray(v)
    ? v.filter((u): u is UrutanSoal => !!u && typeof u === "object" && typeof (u as UrutanSoal).soalId === "string" && Array.isArray((u as UrutanSoal).opsi))
    : [];
const jawabanDari = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === "number" && Number.isInteger(x)) out[k] = x;
  }
  return out;
};

// ============================================================ 1. BANK SOAL

export type SoalRecord = {
  id: string;
  program: ProgramTes;
  kisi: Kisi;
  pertanyaan: string;
  opsi: string[];
  kunci: number;
  pembahasan: string | null;
  status: StatusSoal;
  catatanPeriksa: string | null;
  penyusun: string | null;
  dibuatOleh: string;
  milikSaya: boolean;
  /** Sudah dikerjakan peserta / dipakai tes yang terbit: isi tidak bisa diubah lagi. */
  terkunci: boolean;
  /** Jumlah tes (jadwal) yang memuat soal ini di paketnya. */
  dipakaiTes: number;
  diperbarui: string;
};

export type BankSoalRecord = {
  soal: SoalRecord[];
  /** Jumlah soal SIAP per program & kisi — cukup tidaknya untuk menyusun paket. */
  siap: Record<string, Record<string, number>>;
  menunggu: number;
  bolehPeriksa: boolean;
  agenda: Record<string, string[]>;
};

const milik = (s: { dibuatOleh: string; pegawaiId: string | null }, p: Pelaku) =>
  s.dibuatOleh === p.email || (!!p.pegawaiId && s.pegawaiId === p.pegawaiId);

/** Soal yang tidak boleh diubah isinya: ada di paket tes yang sudah terbit/ditutup, atau sudah dikerjakan. */
async function petaPemakaian(): Promise<{ terkunci: Set<string>; dipakai: Map<string, number> }> {
  const tes: { id: string; status: string; soalIds: unknown }[] = await prisma.tes.findMany({ select: { id: true, status: true, soalIds: true } });
  const dikerjakan = new Set<string>(
    (await prisma.pengerjaanTes.findMany({ select: { tesId: true } })).map((p: { tesId: string }) => p.tesId),
  );
  const terkunci = new Set<string>();
  const dipakai = new Map<string, number>();
  for (const t of tes) {
    for (const id of daftarTeks(t.soalIds)) {
      dipakai.set(id, (dipakai.get(id) ?? 0) + 1);
      if (t.status !== "DRAF" || dikerjakan.has(t.id)) terkunci.add(id);
    }
  }
  return { terkunci, dipakai };
}

function keRecord(s: SoalRow, p: Pelaku, pakai: { terkunci: Set<string>; dipakai: Map<string, number> }): SoalRecord {
  return {
    id: s.id,
    program: s.program as ProgramTes,
    kisi: s.kisi as Kisi,
    pertanyaan: s.pertanyaan,
    opsi: opsiDari(s.opsi),
    kunci: s.kunci,
    pembahasan: s.pembahasan,
    status: s.status as StatusSoal,
    catatanPeriksa: s.catatanPeriksa,
    penyusun: s.penyusun,
    dibuatOleh: s.dibuatOleh,
    milikSaya: milik(s, p),
    terkunci: pakai.terkunci.has(s.id),
    dipakaiTes: pakai.dipakai.get(s.id) ?? 0,
    diperbarui: s.updatedAt.toISOString(),
  };
}

const agendaProgram = () => ({
  PKA: (getJenjang("PKA")?.agenda ?? []).map((a) => a.nama),
  PKP: (getJenjang("PKP")?.agenda ?? []).map((a) => a.nama),
});

export async function getBankSoal(p: Pelaku, saring: { program?: string } = {}): Promise<BankSoalRecord> {
  const program = isProgramTes(saring.program) ? saring.program : undefined;
  // Widyaiswara hanya melihat soal susunannya sendiri (kunci soal orang lain tidak dibuka).
  const rows: SoalRow[] = await prisma.soalTes.findMany({
    where: {
      ...(program ? { program } : {}),
      ...(p.peran === "WI" ? { OR: [{ dibuatOleh: p.email }, ...(p.pegawaiId ? [{ pegawaiId: p.pegawaiId }] : [])] } : {}),
    },
    orderBy: [{ program: "asc" }, { kisi: "asc" }, { createdAt: "asc" }],
  });
  const pakai = await petaPemakaian();
  const semuaSiap: { program: string; kisi: string }[] = await prisma.soalTes.findMany({
    where: { status: "SIAP" },
    select: { program: true, kisi: true },
  });
  const siap: Record<string, Record<string, number>> = { PKA: {}, PKP: {} };
  for (const s of semuaSiap) {
    siap[s.program] ??= {};
    siap[s.program][s.kisi] = (siap[s.program][s.kisi] ?? 0) + 1;
  }
  return {
    soal: rows.map((s) => keRecord(s, p, pakai)),
    siap,
    menunggu: rows.filter((s) => s.status === "DIAJUKAN").length,
    bolehPeriksa: p.peran === "PENYELENGGARA",
    agenda: agendaProgram(),
  };
}

export type SoalBaru = {
  kisi: Kisi;
  pertanyaan: string;
  opsi: string[];
  kunci: number;
  pembahasan?: string | null;
};

/**
 * Tambah satu atau banyak soal (impor tempelan Excel). Pertanyaan yang sudah ada
 * di bank program yang sama dilewati dan dilaporkan. Soal dari admin/Ketua Diklat
 * langsung SIAP; dari Widyaiswara masuk DIAJUKAN.
 */
export async function tambahSoal(
  input: { program: string; soal: SoalBaru[]; penyusun?: string | null },
  p: Pelaku,
): Promise<{ dibuat: number; dilewati: { nomor: number; alasan: string }[] }> {
  if (p.peran === "PIMPINAN") throw new ForbiddenError();
  if (!isProgramTes(input.program)) throw new ValidationError("Program harus PKA atau PKP");
  if (input.soal.length === 0) throw new ValidationError("Tidak ada soal yang dikirim");
  if (input.soal.length > SOAL_MAKS_PER_IMPOR) throw new ValidationError(`Maksimal ${SOAL_MAKS_PER_IMPOR} soal sekali simpan`);
  const ada: { pertanyaan: string }[] = await prisma.soalTes.findMany({ where: { program: input.program }, select: { pertanyaan: true } });
  const terlihat = new Set(ada.map((s) => normalTeks(s.pertanyaan)));
  const dilewati: { nomor: number; alasan: string }[] = [];
  type DataSoal = {
    program: string; kisi: string; pertanyaan: string; opsi: string[]; kunci: number; pembahasan: string | null;
    status: string; penyusun: string | null; dibuatOleh: string; pegawaiId: string | null; diperiksaOleh: string | null;
  };
  const data: DataSoal[] = [];
  input.soal.forEach((s, i) => {
    const opsi = s.opsi.map((o) => o.trim());
    const salah = periksaSoal({ ...s, opsi });
    if (salah) return dilewati.push({ nomor: i + 1, alasan: salah });
    const n = normalTeks(s.pertanyaan);
    if (terlihat.has(n)) return dilewati.push({ nomor: i + 1, alasan: "Pertanyaan yang sama sudah ada di bank soal" });
    terlihat.add(n);
    data.push({
      program: input.program,
      kisi: s.kisi,
      pertanyaan: s.pertanyaan.trim(),
      opsi,
      kunci: s.kunci,
      pembahasan: s.pembahasan?.trim() || null,
      status: p.peran === "PENYELENGGARA" ? "SIAP" : "DIAJUKAN",
      // WI: penyusun = dirinya; admin/Ketua Diklat boleh menulis nama WI penyusun.
      penyusun: p.peran === "WI" ? p.nama : input.penyusun?.trim() || null,
      dibuatOleh: p.email,
      pegawaiId: p.peran === "WI" ? p.pegawaiId : null,
      diperiksaOleh: p.peran === "PENYELENGGARA" ? p.email : null,
    });
  });
  if (data.length) await prisma.$transaction(data.map((d) => prisma.soalTes.create({ data: d })));
  return { dibuat: data.length, dilewati };
}

async function soalAtau404(id: string): Promise<SoalRow> {
  const s: SoalRow | null = await prisma.soalTes.findUnique({ where: { id } });
  if (!s) throw new NotFoundError("Soal tidak ditemukan");
  return s;
}

export type UbahSoal = Partial<SoalBaru> & { penyusun?: string | null };

export async function ubahSoal(id: string, patch: UbahSoal, p: Pelaku): Promise<void> {
  const s = await soalAtau404(id);
  if (p.peran === "PIMPINAN") throw new ForbiddenError();
  if (p.peran === "WI") {
    if (!milik(s, p)) throw new ForbiddenError("Hanya soal susunan Anda sendiri yang bisa diubah");
    if (s.status === "SIAP" || s.status === "NONAKTIF") {
      throw new ConflictError("Soal yang sudah diperiksa tidak bisa diubah. Hubungi admin/Ketua Diklat bila perlu perbaikan.");
    }
  }
  const { terkunci } = await petaPemakaian();
  if (terkunci.has(id)) {
    throw new ConflictError("Soal sudah dipakai pada tes yang terbit/dikerjakan, jadi isinya dikunci. Nonaktifkan lalu buat soal baru.");
  }
  const baru = {
    pertanyaan: (patch.pertanyaan ?? s.pertanyaan).trim(),
    opsi: (patch.opsi ?? opsiDari(s.opsi)).map((o) => o.trim()),
    kunci: patch.kunci ?? s.kunci,
    pembahasan: patch.pembahasan === undefined ? s.pembahasan : patch.pembahasan?.trim() || null,
  };
  const salah = periksaSoal(baru);
  if (salah) throw new ValidationError(salah);
  if (normalTeks(baru.pertanyaan) !== normalTeks(s.pertanyaan)) {
    const lain: { id: string; pertanyaan: string }[] = await prisma.soalTes.findMany({ where: { program: s.program }, select: { id: true, pertanyaan: true } });
    if (lain.some((x) => x.id !== id && normalTeks(x.pertanyaan) === normalTeks(baru.pertanyaan))) {
      throw new ConflictError("Pertanyaan yang sama sudah ada di bank soal");
    }
  }
  await prisma.soalTes.update({
    where: { id },
    data: {
      ...baru,
      ...(patch.kisi ? { kisi: patch.kisi } : {}),
      ...(p.peran === "PENYELENGGARA" && patch.penyusun !== undefined ? { penyusun: patch.penyusun?.trim() || null } : {}),
      // Perbaikan oleh WI = diajukan ulang untuk diperiksa.
      ...(p.peran === "WI" ? { status: "DIAJUKAN" } : {}),
    },
  });
}

export type AksiPeriksa = "setujui" | "kembalikan" | "nonaktifkan" | "aktifkan";

export async function periksaSoalBank(id: string, aksi: AksiPeriksa, catatan: string | null | undefined, p: Pelaku): Promise<StatusSoal> {
  if (p.peran !== "PENYELENGGARA") throw new ForbiddenError("Pemeriksaan soal oleh admin atau Ketua Diklat");
  const s = await soalAtau404(id);
  const c = catatan?.trim() || null;
  let status: StatusSoal;
  if (aksi === "setujui" || aksi === "aktifkan") {
    const salah = periksaSoal({ pertanyaan: s.pertanyaan, opsi: opsiDari(s.opsi), kunci: s.kunci, pembahasan: s.pembahasan });
    if (salah) throw new ValidationError(`Soal belum sah: ${salah}`);
    status = "SIAP";
  } else if (aksi === "kembalikan") {
    if (!c) throw new ValidationError("Tulis catatan perbaikan untuk penyusun");
    const { terkunci } = await petaPemakaian();
    if (terkunci.has(id)) throw new ConflictError("Soal sudah dipakai tes yang terbit — nonaktifkan saja");
    status = "DIKEMBALIKAN";
  } else {
    status = "NONAKTIF";
  }
  await prisma.soalTes.update({
    where: { id },
    data: { status, catatanPeriksa: aksi === "kembalikan" ? c : aksi === "setujui" ? null : s.catatanPeriksa, diperiksaOleh: p.email },
  });
  return status;
}

export async function hapusSoal(id: string, p: Pelaku): Promise<void> {
  const s = await soalAtau404(id);
  if (p.peran === "PIMPINAN") throw new ForbiddenError();
  if (p.peran === "WI" && (!milik(s, p) || s.status === "SIAP")) {
    throw new ForbiddenError("Widyaiswara hanya bisa menghapus soal sendiri yang belum disetujui");
  }
  const { dipakai } = await petaPemakaian();
  if (dipakai.has(id)) throw new ConflictError("Soal ada di paket tes. Keluarkan dari paket atau nonaktifkan saja.");
  await prisma.soalTes.deleteMany({ where: { id } });
}

// ============================================================ 2. TES PER DIKLAT

export type PengaturanTes = {
  buka: string | null; // ISO datetime
  tutup: string | null;
  durasiMenit: number;
  soalIds: string[];
  acakSoal: boolean;
  acakOpsi: boolean;
  tampilkanHasil: boolean;
};

export type SoalPaketRecord = { id: string; kisi: string; pertanyaan: string; opsi: string[]; kunci: number | null; status: string };

export type TesKelolaRecord = PengaturanTes & {
  id: string | null;
  jenis: JenisTes;
  label: string;
  status: string; // DRAF | TERBIT | DITUTUP
  statusBerlaku: StatusTesBerlaku;
  sebaran: Record<string, number>;
  soal: SoalPaketRecord[];
  selesai: number;
  berjalan: number;
  belum: number;
  adaPengerjaan: boolean;
  butir: (ButirHasil & { kisi: string; pertanyaan: string })[];
};

export type HasilPesertaRecord = {
  pesertaId: string;
  nomor: number;
  nama: string;
  nip: string | null;
  status: string;
  punyaAkun: boolean;
  pre: { status: "BELUM" | "BERJALAN" | "SELESAI"; skor: number | null; benar: number | null; jumlah: number | null; selesai: string | null };
  post: { status: "BELUM" | "BERJALAN" | "SELESAI"; skor: number | null; benar: number | null; jumlah: number | null; selesai: string | null };
  kenaikan: number | null;
  nGain: number | null;
  kategori: string | null;
};

export type KelolaTesRecord = {
  training: { id: string; name: string; jenisPelatihan: string; angkatan: string | null; startDate: string; endDate: string | null };
  bolehKelola: boolean;
  tes: Record<JenisTes, TesKelolaRecord>;
  bankSiap: { id: string; kisi: string; pertanyaan: string }[];
  peserta: HasilPesertaRecord[];
  ringkasan: ReturnType<typeof ringkasKelas>;
  agenda: string[];
  /** Saran waktu: pre-test sebelum pembukaan, post-test sebelum penutupan pelatihan. */
  saran: { pre: string; post: string };
};

async function trainingTes(trainingId: string) {
  const t = await getTrainingByIdOrThrow(trainingId);
  if (!isProgramTes(t.jenisPelatihan)) {
    throw new ValidationError("Pre-test & post-test tersedia untuk jadwal berprogram PKA/PKP");
  }
  return t as typeof t & { jenisPelatihan: ProgramTes };
}

async function tesAtauNull(trainingId: string, jenis: JenisTes): Promise<TesRow | null> {
  return prisma.tes.findUnique({ where: { trainingId_jenis: { trainingId, jenis } } });
}

/** Selesaikan pengerjaan yang waktunya habis (dipanggil saat dibaca — tidak butuh penjadwal). */
async function tuntaskan(pk: PengerjaanRow, now: Date, paksa = false): Promise<PengerjaanRow> {
  if (pk.selesai) return pk;
  if (!paksa && now.getTime() <= pk.batas.getTime() + TENGGANG_DETIK * 1000) return pk;
  const urutan = urutanDari(pk.urutan);
  const ids = urutan.map((u) => u.soalId);
  const kunci = await petaKunci(ids);
  const n = nilaiJawaban(ids, jawabanDari(pk.jawaban), kunci);
  const selesai = now < pk.batas ? now : pk.batas;
  // Hanya yang BELUM selesai yang diperbarui (dua permintaan bersamaan tidak menilai dua kali).
  await prisma.pengerjaanTes.updateMany({ where: { id: pk.id, selesai: null }, data: { selesai, benar: n.benar, skor: n.skor } });
  return { ...pk, selesai, benar: n.benar, skor: n.skor };
}

async function petaKunci(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows: { id: string; kunci: number }[] = await prisma.soalTes.findMany({ where: { id: { in: ids } }, select: { id: true, kunci: true } });
  return new Map(rows.map((r) => [r.id, r.kunci]));
}

const tglIso = (d: Date | null) => (d ? d.toISOString() : null);
const statusPk = (pk: PengerjaanRow | undefined): "BELUM" | "BERJALAN" | "SELESAI" => (!pk ? "BELUM" : pk.selesai ? "SELESAI" : "BERJALAN");

export async function getKelolaTes(trainingId: string, p: Pelaku, now: Date = new Date()): Promise<KelolaTesRecord> {
  if (p.peran === "WI") throw new ForbiddenError();
  const t = await trainingTes(trainingId);
  const pesertaRows: { id: string; nomor: number; nama: string; nip: string | null; status: string; akunId: string | null }[] =
    await prisma.peserta.findMany({
      where: { trainingId },
      select: { id: true, nomor: true, nama: true, nip: true, status: true, akunId: true },
      orderBy: { nomor: "asc" },
    });
  const bank: SoalRow[] = await prisma.soalTes.findMany({ where: { program: t.jenisPelatihan } });
  const bankById = new Map(bank.map((s) => [s.id, s]));
  const kunci = new Map(bank.map((s) => [s.id, s.kunci]));
  const kelola = p.peran === "PENYELENGGARA";
  const agenda = (getJenjang(t.jenisPelatihan)?.agenda ?? []).map((a) => a.nama);

  const tesOut = {} as Record<JenisTes, TesKelolaRecord>;
  const pkPer: Record<JenisTes, Map<string, PengerjaanRow>> = { PRE: new Map(), POST: new Map() };
  for (const jenis of ["PRE", "POST"] as JenisTes[]) {
    const row = await tesAtauNull(trainingId, jenis);
    const soalIds = row ? daftarTeks(row.soalIds) : [];
    let pk: PengerjaanRow[] = row ? await prisma.pengerjaanTes.findMany({ where: { tesId: row.id } }) : [];
    pk = await Promise.all(pk.map((x) => tuntaskan(x, now, row ? statusTes(row, now) === "DITUTUP" : false)));
    for (const x of pk) pkPer[jenis].set(x.pesertaId, x);
    const selesaiPk = pk.filter((x) => x.selesai);
    const aktifIds = new Set(pesertaRows.filter((x) => x.status === "AKTIF").map((x) => x.id));
    tesOut[jenis] = {
      id: row?.id ?? null,
      jenis,
      label: LABEL_JENIS_TES[jenis],
      status: row?.status ?? "DRAF",
      statusBerlaku: row ? statusTes(row, now) : "DRAF",
      buka: tglIso(row?.buka ?? null),
      tutup: tglIso(row?.tutup ?? null),
      durasiMenit: row?.durasiMenit ?? 30,
      soalIds,
      acakSoal: row?.acakSoal ?? true,
      acakOpsi: row?.acakOpsi ?? true,
      tampilkanHasil: row?.tampilkanHasil ?? true,
      sebaran: sebaranKisi(soalIds, new Map(bank.map((s) => [s.id, s.kisi]))),
      soal: soalIds.map((id) => {
        const s = bankById.get(id);
        return {
          id,
          kisi: s?.kisi ?? "?",
          pertanyaan: s?.pertanyaan ?? "(soal tidak ditemukan)",
          opsi: s ? opsiDari(s.opsi) : [],
          kunci: kelola ? (s?.kunci ?? null) : null,
          status: s?.status ?? "HILANG",
        };
      }),
      selesai: selesaiPk.filter((x) => aktifIds.has(x.pesertaId)).length,
      berjalan: pk.filter((x) => !x.selesai && aktifIds.has(x.pesertaId)).length,
      belum: [...aktifIds].filter((id) => !pkPer[jenis].has(id)).length,
      adaPengerjaan: pk.length > 0,
      butir: [],
    };
  }

  // Analisis butir memakai paket post-test (kalau kosong, paket pre-test).
  const idsButir = tesOut.POST.soalIds.length ? tesOut.POST.soalIds : tesOut.PRE.soalIds;
  const jwb = (j: JenisTes) =>
    [...pkPer[j].values()].filter((x) => x.selesai).map((x) => jawabanDari(x.jawaban));
  const butir = analisisButir(idsButir, kunci, jwb("PRE"), jwb("POST")).map((b) => ({
    ...b,
    kisi: bankById.get(b.soalId)?.kisi ?? "?",
    pertanyaan: bankById.get(b.soalId)?.pertanyaan ?? "",
  }));
  tesOut.POST.butir = butir;

  const ringkas = (pk: PengerjaanRow | undefined) => ({
    status: statusPk(pk),
    skor: pk?.selesai ? pk.skor : null,
    benar: pk?.selesai ? pk.benar : null,
    jumlah: pk?.jumlahSoal ?? null,
    selesai: tglIso(pk?.selesai ?? null),
  });
  const peserta: HasilPesertaRecord[] = pesertaRows.map((x) => {
    const pre = ringkas(pkPer.PRE.get(x.id));
    const post = ringkas(pkPer.POST.get(x.id));
    const g = nGain(pre.skor, post.skor);
    return {
      pesertaId: x.id,
      nomor: x.nomor,
      nama: x.nama,
      nip: x.nip,
      status: x.status,
      punyaAkun: !!x.akunId,
      pre,
      post,
      kenaikan: pre.skor != null && post.skor != null ? Math.round((post.skor - pre.skor) * 100) / 100 : null,
      nGain: g,
      kategori: kategoriGain(g),
    };
  });

  return {
    training: {
      id: t.id,
      name: t.name,
      jenisPelatihan: t.jenisPelatihan,
      angkatan: t.angkatan ?? null,
      startDate: t.startDate.toISOString().slice(0, 10),
      endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
    },
    bolehKelola: kelola,
    tes: tesOut,
    bankSiap: kelola
      ? bank.filter((s) => s.status === "SIAP").map((s) => ({ id: s.id, kisi: s.kisi, pertanyaan: s.pertanyaan }))
      : [],
    peserta,
    ringkasan: ringkasKelas(peserta.filter((x) => x.status === "AKTIF").map((x) => ({ pre: x.pre.skor, post: x.post.skor }))),
    agenda,
    saran: {
      pre: "Sebelum pembukaan pelatihan, agar menjadi titik awal yang bersih.",
      post: "Sebelum penutupan pelatihan.",
    },
  };
}

function wajibKelola(p: Pelaku) {
  if (p.peran !== "PENYELENGGARA") throw new ForbiddenError("Pengaturan tes oleh admin atau Ketua Diklat");
}

async function adaPengerjaan(tesId: string): Promise<boolean> {
  return (await prisma.pengerjaanTes.count({ where: { tesId } })) > 0;
}

/** Soal paket harus SIAP dan milik program jadwal ini (soal lama yang sudah di paket boleh tetap). */
async function periksaPaket(program: string, soalIds: string[], lama: string[]): Promise<void> {
  if (new Set(soalIds).size !== soalIds.length) throw new ValidationError("Ada soal yang dipilih dua kali");
  if (soalIds.length > JUMLAH_SOAL_MAKS) throw new ValidationError(`Paket maksimal ${JUMLAH_SOAL_MAKS} soal`);
  if (!soalIds.length) return;
  const rows: { id: string; program: string; status: string }[] = await prisma.soalTes.findMany({
    where: { id: { in: soalIds } },
    select: { id: true, program: true, status: true },
  });
  const peta = new Map(rows.map((r) => [r.id, r]));
  for (const id of soalIds) {
    const r = peta.get(id);
    if (!r || r.program !== program) throw new ValidationError("Ada soal yang tidak ditemukan di bank program ini");
    if (r.status !== "SIAP" && !lama.includes(id)) throw new ValidationError("Hanya soal berstatus Siap dipakai yang bisa masuk paket");
  }
}

export async function simpanTes(trainingId: string, jenis: JenisTes, input: PengaturanTes, p: Pelaku): Promise<void> {
  wajibKelola(p);
  const t = await trainingTes(trainingId);
  const buka = input.buka ? new Date(input.buka) : null;
  const tutup = input.tutup ? new Date(input.tutup) : null;
  if ((buka && Number.isNaN(buka.getTime())) || (tutup && Number.isNaN(tutup.getTime()))) throw new ValidationError("Waktu buka/tutup tidak valid");
  if (buka && tutup && tutup <= buka) throw new ValidationError("Waktu tutup harus sesudah waktu buka");
  const lama = await tesAtauNull(trainingId, jenis);
  const lamaIds = lama ? daftarTeks(lama.soalIds) : [];
  if (lama && (await adaPengerjaan(lama.id)) && JSON.stringify(lamaIds) !== JSON.stringify(input.soalIds)) {
    throw new ConflictError("Paket soal tidak bisa diubah karena sudah ada peserta yang mengerjakan");
  }
  await periksaPaket(t.jenisPelatihan, input.soalIds, lamaIds);
  const data = {
    buka,
    tutup,
    durasiMenit: input.durasiMenit,
    soalIds: input.soalIds,
    acakSoal: input.acakSoal,
    acakOpsi: input.acakOpsi,
    tampilkanHasil: input.tampilkanHasil,
    diubahOleh: p.email,
  };
  await prisma.tes.upsert({
    where: { trainingId_jenis: { trainingId, jenis } },
    update: data,
    create: { trainingId, jenis, ...data },
  });
}

export type AksiTes = "susun" | "salin-pre" | "terbitkan" | "tutup" | "buka-lagi" | "kembali-draf";

export async function aksiTes(
  trainingId: string,
  jenis: JenisTes,
  aksi: AksiTes,
  o: { jumlah?: number },
  p: Pelaku,
  acak: () => number = Math.random,
): Promise<{ status: string; soalIds: string[] }> {
  wajibKelola(p);
  const t = await trainingTes(trainingId);
  let row = await tesAtauNull(trainingId, jenis);
  if (!row) {
    row = await prisma.tes.create({ data: { trainingId, jenis, diubahOleh: p.email } });
  }
  const tes = row as TesRow;
  const soalIds = daftarTeks(tes.soalIds);
  const sudah = await adaPengerjaan(tes.id);
  const ubah = async (data: { soalIds?: string[]; status?: string }) => {
    await prisma.tes.update({ where: { id: tes.id }, data: { ...data, diubahOleh: p.email } });
  };

  switch (aksi) {
    case "susun": {
      if (sudah) throw new ConflictError("Paket soal tidak bisa disusun ulang karena sudah ada peserta yang mengerjakan");
      if (tes.status !== "DRAF") throw new ConflictError("Kembalikan tes ke draf dulu untuk menyusun ulang paket");
      const jumlah = Math.min(Math.max(Math.trunc(o.jumlah ?? 0), 1), JUMLAH_SOAL_MAKS);
      const siap: { id: string; kisi: string }[] = await prisma.soalTes.findMany({
        where: { program: t.jenisPelatihan, status: "SIAP" },
        select: { id: true, kisi: true },
      });
      if (!siap.length) throw new ValidationError(`Belum ada soal ${t.jenisPelatihan} berstatus Siap dipakai di bank soal`);
      const ids = susunPaket(siap, jumlah, acak);
      await ubah({ soalIds: ids });
      return { status: tes.status, soalIds: ids };
    }
    case "salin-pre": {
      if (jenis !== "POST") throw new ValidationError("Salin paket hanya untuk post-test");
      if (sudah) throw new ConflictError("Paket soal tidak bisa diubah karena sudah ada peserta yang mengerjakan");
      if (tes.status !== "DRAF") throw new ConflictError("Kembalikan tes ke draf dulu");
      const pre = await tesAtauNull(trainingId, "PRE");
      const ids = pre ? daftarTeks(pre.soalIds) : [];
      if (!ids.length) throw new ValidationError("Paket pre-test masih kosong");
      await ubah({ soalIds: ids });
      return { status: tes.status, soalIds: ids };
    }
    case "terbitkan": {
      if (!soalIds.length) throw new ValidationError("Paket soal masih kosong — susun paket dulu");
      const nonaktif: number = await prisma.soalTes.count({ where: { id: { in: soalIds }, status: { not: "SIAP" } } });
      if (nonaktif > 0) throw new ValidationError(`${nonaktif} soal di paket tidak lagi berstatus Siap — ganti dulu`);
      if (tes.tutup && tes.tutup <= new Date()) throw new ValidationError("Waktu tutup sudah lewat — ubah dulu waktunya");
      await ubah({ status: "TERBIT" });
      return { status: "TERBIT", soalIds };
    }
    case "tutup": {
      if (tes.status === "DRAF") throw new ConflictError("Tes masih draf");
      await ubah({ status: "DITUTUP" });
      // Pengerjaan yang masih berjalan dinilai dengan jawaban yang sudah tersimpan.
      const berjalan: PengerjaanRow[] = await prisma.pengerjaanTes.findMany({ where: { tesId: tes.id, selesai: null } });
      for (const pk of berjalan) await tuntaskan(pk, new Date(), true);
      return { status: "DITUTUP", soalIds };
    }
    case "buka-lagi": {
      if (tes.status !== "DITUTUP") throw new ConflictError("Tes belum ditutup");
      if (tes.tutup && tes.tutup <= new Date()) throw new ValidationError("Waktu tutup sudah lewat — perpanjang dulu waktunya");
      await ubah({ status: "TERBIT" });
      return { status: "TERBIT", soalIds };
    }
    case "kembali-draf": {
      if (sudah) throw new ConflictError("Sudah ada peserta yang mengerjakan — tes tidak bisa kembali ke draf (tutup saja)");
      await ubah({ status: "DRAF" });
      return { status: "DRAF", soalIds };
    }
  }
}

/** Hapus pengerjaan satu peserta (mis. koneksi putus) supaya bisa mengulang dari awal. */
export async function resetPengerjaan(trainingId: string, jenis: JenisTes, pesertaId: string, p: Pelaku): Promise<string> {
  wajibKelola(p);
  const tes = await tesAtauNull(trainingId, jenis);
  if (!tes) throw new NotFoundError("Tes belum dibuat");
  const peserta: { id: string; nama: string; trainingId: string } | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { id: true, nama: true, trainingId: true },
  });
  if (!peserta || peserta.trainingId !== trainingId) throw new NotFoundError("Peserta tidak ditemukan di jadwal ini");
  const r = await prisma.pengerjaanTes.deleteMany({ where: { tesId: tes.id, pesertaId } });
  if (r.count === 0) throw new ConflictError("Peserta ini belum mengerjakan tes");
  return peserta.nama;
}

/** CSV hasil (dibuka di Excel). */
export function csvHasil(d: KelolaTesRecord, sel: (v: unknown) => string): string {
  const judul = ["No", "Nama", "NIP", "Status", "Pre-test", "Post-test", "Kenaikan", "N-gain", "Kategori"];
  const baris = d.peserta.map((x) =>
    [x.nomor, x.nama, x.nip ?? "", x.status, x.pre.skor ?? "", x.post.skor ?? "", x.kenaikan ?? "", x.nGain ?? "", x.kategori ?? ""].map(sel).join(";"),
  );
  return "﻿" + [judul.join(";"), ...baris].join("\r\n") + "\r\n";
}

// ============================================================ 3. PESERTA

export type TesPesertaRecord = {
  jenis: JenisTes;
  label: string;
  statusBerlaku: StatusTesBerlaku;
  buka: string | null;
  tutup: string | null;
  durasiMenit: number;
  jumlahSoal: number;
  pengerjaan: "BELUM" | "BERJALAN" | "SELESAI";
  sisaDetik: number | null;
  /** Skor hanya terlihat setelah post-test dikirim (dan bila penyelenggara mengizinkan). */
  skor: number | null;
  benar: number | null;
};

export type SoalPengerjaanRecord = {
  soalId: string;
  nomor: number;
  pertanyaan: string;
  opsi: { i: number; huruf: string; teks: string }[];
  jawaban: number | null;
};

export type PengerjaanRecord = {
  jenis: JenisTes;
  label: string;
  status: "BERJALAN" | "SELESAI";
  sisaDetik: number;
  batas: string;
  soal: SoalPengerjaanRecord[];
  terjawab: number;
  skor: number | null;
  benar: number | null;
  jumlahSoal: number;
};

export type PembacaPeserta = { pratinjau: true } | { pratinjau: false; email: string };

async function pesertaMilik(pesertaId: string, pembaca: PembacaPeserta) {
  const ps: { id: string; trainingId: string; status: string; akunId: string | null } | null = await prisma.peserta.findUnique({
    where: { id: pesertaId },
    select: { id: true, trainingId: true, status: true, akunId: true },
  });
  if (!ps) throw new NotFoundError("Data peserta tidak ditemukan");
  if (!pembaca.pratinjau) {
    const akun: { id: string } | null = await prisma.akun.findUnique({ where: { email: pembaca.email }, select: { id: true } });
    if (!akun || ps.akunId !== akun.id) throw new NotFoundError("Data peserta tidak ditemukan");
  }
  return ps;
}

/** Tes yang perlu dikerjakan peserta sekarang (untuk beranda): dibuka dan belum selesai. */
export async function tesTerbuka(trainingId: string, pesertaId: string, now: Date = new Date()): Promise<JenisTes[]> {
  const rows: TesRow[] = await prisma.tes.findMany({ where: { trainingId } });
  const out: JenisTes[] = [];
  for (const t of rows) {
    if (statusTes(t, now) !== "DIBUKA" || !daftarTeks(t.soalIds).length) continue;
    const pk: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: t.id, pesertaId } });
    if (!pk || (!pk.selesai && now.getTime() <= pk.batas.getTime())) out.push(t.jenis as JenisTes);
  }
  return out.sort();
}

export async function listTesPeserta(pesertaId: string, pembaca: PembacaPeserta, now: Date = new Date()): Promise<TesPesertaRecord[]> {
  const ps = await pesertaMilik(pesertaId, pembaca);
  const rows: TesRow[] = await prisma.tes.findMany({ where: { trainingId: ps.trainingId } });
  const per = new Map(rows.map((r) => [r.jenis, r]));
  const pkPer = new Map<string, PengerjaanRow>();
  for (const r of rows) {
    const pk: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: r.id, pesertaId } });
    if (pk) pkPer.set(r.jenis, await tuntaskan(pk, now, statusTes(r, now) === "DITUTUP"));
  }
  const post = per.get("POST");
  const lihatSkor = !!post && post.tampilkanHasil && !!pkPer.get("POST")?.selesai;
  const out: TesPesertaRecord[] = [];
  for (const jenis of ["PRE", "POST"] as JenisTes[]) {
    const r = per.get(jenis);
    if (!r || r.status === "DRAF") continue; // draf tidak terlihat peserta
    const pk = pkPer.get(jenis);
    out.push({
      jenis,
      label: LABEL_JENIS_TES[jenis],
      statusBerlaku: statusTes(r, now),
      buka: tglIso(r.buka),
      tutup: tglIso(r.tutup),
      durasiMenit: r.durasiMenit,
      jumlahSoal: daftarTeks(r.soalIds).length,
      pengerjaan: statusPk(pk),
      sisaDetik: pk && !pk.selesai ? sisaDetik(pk.batas, now) : null,
      skor: lihatSkor && pk?.selesai ? pk.skor : null,
      benar: lihatSkor && pk?.selesai ? pk.benar : null,
    });
  }
  return out;
}

async function tesUntukPeserta(trainingId: string, jenis: JenisTes): Promise<TesRow> {
  const t = await tesAtauNull(trainingId, jenis);
  if (!t || t.status === "DRAF") throw new NotFoundError(`${LABEL_JENIS_TES[jenis]} belum tersedia`);
  return t;
}

async function susunRecord(t: TesRow, pk: PengerjaanRow, jenis: JenisTes, now: Date): Promise<PengerjaanRecord> {
  const urutan = urutanDari(pk.urutan);
  const rows: SoalRow[] = await prisma.soalTes.findMany({ where: { id: { in: urutan.map((u) => u.soalId) } } });
  const peta = new Map(rows.map((r) => [r.id, r]));
  const jawaban = jawabanDari(pk.jawaban);
  const selesai = !!pk.selesai;
  const postSelesai =
    jenis === "POST" ? selesai : !!(await (async () => {
      const post = await tesAtauNull(t.trainingId, "POST");
      if (!post) return null;
      return prisma.pengerjaanTes.findFirst({ where: { tesId: post.id, pesertaId: pk.pesertaId, selesai: { not: null } } });
    })());
  const postRow = jenis === "POST" ? t : await tesAtauNull(t.trainingId, "POST");
  const lihatSkor = selesai && !!postRow?.tampilkanHasil && postSelesai;
  return {
    jenis,
    label: LABEL_JENIS_TES[jenis],
    status: selesai ? "SELESAI" : "BERJALAN",
    sisaDetik: selesai ? 0 : sisaDetik(pk.batas, now),
    batas: pk.batas.toISOString(),
    // Soal tidak dikirim lagi setelah selesai (tidak bisa dipakai untuk membocorkan paket).
    soal: selesai
      ? []
      : urutan.map((u, n) => {
          const s = peta.get(u.soalId);
          const opsi = s ? opsiDari(s.opsi) : [];
          return {
            soalId: u.soalId,
            nomor: n + 1,
            pertanyaan: s?.pertanyaan ?? "(soal tidak tersedia)",
            opsi: u.opsi.filter((i) => i < opsi.length).map((i, k) => ({ i, huruf: String.fromCharCode(65 + k), teks: opsi[i] })),
            jawaban: jawaban[u.soalId] ?? null,
          };
        }),
    terjawab: urutan.filter((u) => jawaban[u.soalId] != null).length,
    skor: lihatSkor ? pk.skor : null,
    benar: lihatSkor ? pk.benar : null,
    jumlahSoal: pk.jumlahSoal,
  };
}

/** Buka pengerjaan yang sudah ada (melanjutkan). null bila belum mulai. */
export async function getPengerjaan(pesertaId: string, jenis: JenisTes, email: string, now: Date = new Date()): Promise<PengerjaanRecord | null> {
  const ps = await pesertaMilik(pesertaId, { pratinjau: false, email });
  const t = await tesUntukPeserta(ps.trainingId, jenis);
  let pk: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: t.id, pesertaId } });
  if (!pk) return null;
  pk = await tuntaskan(pk, now, statusTes(t, now) === "DITUTUP");
  return susunRecord(t, pk, jenis, now);
}

export async function mulaiTes(pesertaId: string, jenis: JenisTes, email: string, now: Date = new Date(), acak: () => number = Math.random): Promise<PengerjaanRecord> {
  const ps = await pesertaMilik(pesertaId, { pratinjau: false, email });
  if (ps.status !== "AKTIF") throw new ForbiddenError("Status Anda di pelatihan ini tidak aktif");
  const t = await tesUntukPeserta(ps.trainingId, jenis);
  const ada: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: t.id, pesertaId } });
  if (ada) {
    const pk = await tuntaskan(ada, now, statusTes(t, now) === "DITUTUP");
    return susunRecord(t, pk, jenis, now); // melanjutkan, bukan mulai ulang
  }
  // Dokumen persyaratan (bila jadwal mewajibkannya) harus lengkap sebelum tes baru dimulai — penjaga di server,
  // bukan hanya tombol yang disembunyikan di layar (keputusan 14 Okt 2026: ruang belajar terkunci sampai lengkap).
  const dok = await statusDokumenPeserta(pesertaId, now);
  if (dok.wajib && !dok.ringkas.lengkap) throw new ForbiddenError("Lengkapi dokumen persyaratan terlebih dahulu sebelum mengerjakan tes");
  const st = statusTes(t, now);
  if (st === "TERJADWAL") throw new ConflictError(`${LABEL_JENIS_TES[jenis]} belum dibuka`);
  if (st !== "DIBUKA") throw new ConflictError(`${LABEL_JENIS_TES[jenis]} sudah ditutup`);
  // Post-test baru bisa dikerjakan setelah pre-test (bila pre-test ada & sudah dibuka) — supaya urutannya benar.
  if (jenis === "POST") {
    const pre = await tesAtauNull(ps.trainingId, "PRE");
    if (pre && pre.status !== "DRAF" && statusTes(pre, now) === "DIBUKA") {
      const pkPre: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: pre.id, pesertaId } });
      if (!pkPre?.selesai) throw new ConflictError("Selesaikan pre-test terlebih dahulu");
    }
  }
  const ids = daftarTeks(t.soalIds);
  if (!ids.length) throw new ConflictError("Paket soal belum tersedia");
  const soal: SoalRow[] = await prisma.soalTes.findMany({ where: { id: { in: ids } } });
  const peta = new Map(soal.map((s) => [s.id, s]));
  const urutan = buatUrutan(
    ids.filter((id) => peta.has(id)).map((id) => ({ id, jumlahOpsi: opsiDari(peta.get(id)!.opsi).length })),
    { acakSoal: t.acakSoal, acakOpsi: t.acakOpsi },
    acak,
  );
  let pk: PengerjaanRow;
  try {
    pk = await prisma.pengerjaanTes.create({
      data: {
        tesId: t.id,
        pesertaId,
        mulai: now,
        batas: batasPengerjaan(now, t.durasiMenit, t.tutup),
        urutan,
        jawaban: {},
        jumlahSoal: urutan.length,
      },
    });
  } catch (e) {
    // Dua klik "Mulai" bersamaan: yang kedua memakai pengerjaan yang sudah dibuat.
    if (kodePrisma(e) === "P2002") {
      const lagi: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: t.id, pesertaId } });
      if (lagi) return susunRecord(t, lagi, jenis, now);
    }
    throw e;
  }
  return susunRecord(t, pk, jenis, now);
}

/**
 * Simpan jawaban (otomatis tiap memilih) dan/atau kirim. Lewat batas waktu
 * (+ tenggang) jawaban baru ditolak dan pengerjaan dinilai dengan yang tersimpan.
 */
export async function simpanJawaban(
  pesertaId: string,
  jenis: JenisTes,
  jawabanBaru: Record<string, number | null>,
  kirim: boolean,
  email: string,
  now: Date = new Date(),
): Promise<PengerjaanRecord> {
  const ps = await pesertaMilik(pesertaId, { pratinjau: false, email });
  const t = await tesUntukPeserta(ps.trainingId, jenis);
  let pk: PengerjaanRow | null = await prisma.pengerjaanTes.findFirst({ where: { tesId: t.id, pesertaId } });
  if (!pk) throw new ConflictError("Tes belum dimulai");
  if (pk.selesai) throw new ConflictError("Tes sudah dikirim — jawaban tidak bisa diubah");
  // Ditutup manual oleh penyelenggara = jawaban baru ditolak; lewat waktu tutup sudah tercakup `batas`.
  const ditutup = t.status === "DITUTUP";
  if (ditutup || now.getTime() > pk.batas.getTime() + TENGGANG_DETIK * 1000) {
    pk = await tuntaskan(pk, now, true);
    throw new ConflictError("Waktu habis. Jawaban terakhir yang tersimpan sudah dinilai.");
  }
  const urutan = urutanDari(pk.urutan);
  const boleh = new Map(urutan.map((u) => [u.soalId, new Set(u.opsi)]));
  const jawaban = jawabanDari(pk.jawaban);
  for (const [id, v] of Object.entries(jawabanBaru)) {
    const opsi = boleh.get(id);
    if (!opsi) throw new ValidationError("Ada jawaban untuk soal yang bukan bagian tes ini");
    if (v === null) delete jawaban[id];
    else if (!opsi.has(v)) throw new ValidationError("Pilihan jawaban tidak dikenal");
    else jawaban[id] = v;
  }
  await prisma.pengerjaanTes.updateMany({ where: { id: pk.id, selesai: null }, data: { jawaban } });
  pk = { ...pk, jawaban };
  if (kirim) pk = await tuntaskan(pk, now, true);
  return susunRecord(t, pk, jenis, now);
}
