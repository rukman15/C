import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { LembarPenilaianRecord, PesertaPenilaianRecord, SelNilaiRecord } from "@/lib/server/types";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, kodePrisma } from "@/lib/server/errors";
import { getTrainingByIdOrThrow, toTrainingRecord } from "@/lib/server/repositories/training";
import { listPeserta } from "@/lib/server/repositories/peserta";
import type { JenisEvaluasi } from "@/lib/kurikulum";
import {
  bacaNilai,
  daftarAspek,
  hitungHasil,
  jenisDariKodeRemedial,
  nilaiAspek,
  peringkat,
  EVALUASI,
  type AspekPenilaian,
  type EntriNilai,
  type SumberNilai,
} from "@/lib/penilaian";

/**
 * Penilaian peserta PKA/PKP (BARU, LMS tahap 3).
 *
 * Nilai disimpan per (peserta, aspek, penilai). Ketua Diklat/admin mengisi
 * sebagai REKAP (didahulukan); WI yang penugasannya disetujui pada jadwal ini
 * mengisi aspek bagiannya (pengampu/penguji/pendamping/coach) sebagai PENILAI,
 * dan bila lebih dari satu WI menilai aspek yang sama nilainya dirata-rata.
 * Nilai akhir, kualifikasi, dan kelulusan dihitung saat dibaca (src/lib/penilaian.ts),
 * jadi tidak pernah selisih dengan isiannya.
 */
type NilaiRow = { pesertaId: string; kodeAspek: string; nilai: number; sumber: string; penilai: string };

export type Penilai =
  | { peran: "PENYELENGGARA"; email: string; nama?: string }
  | { peran: "WI"; email: string; nama?: string; pegawaiId: string | null }
  | { peran: "PIMPINAN"; email: string };

/**
 * Kolom `penilai` pada baris nilai. Isian Ketua Diklat/admin memakai satu kunci
 * bersama "REKAP" — jadi satu sel hanya punya SATU nilai rekap, siapa pun
 * penyelenggara yang terakhir mengubahnya (namanya di `penilaiNama`). Isian WI
 * memakai emailnya sendiri.
 */
const PENILAI_REKAP = "REKAP";
const kunciPenilai = (siapa: Penilai) => (siapa.peran === "PENYELENGGARA" ? PENILAI_REKAP : siapa.email);

async function aspekTraining(trainingId: string): Promise<AspekPenilaian[]> {
  const t = await getTrainingByIdOrThrow(trainingId);
  const aspek = daftarAspek(t.jenisPelatihan, t.modePelatihan);
  if (aspek.length === 0) {
    throw new ValidationError("Penilaian hanya tersedia untuk jadwal berprogram PKA/PKP (dengan mode pembelajaran)");
  }
  return aspek;
}

/** WI boleh menilai kalau punya penugasan DISETUJUI pada jadwal ini. */
async function pastikanWiDitugaskan(trainingId: string, pegawaiId: string | null): Promise<void> {
  const ditugaskan: number = pegawaiId ? await prisma.penugasanApproval.count({ where: { trainingId, instructorId: pegawaiId, status: "disetujui" } }) : 0;
  if (ditugaskan === 0) {
    throw new ForbiddenError("Anda belum ditugaskan (disetujui) pada jadwal diklat ini, jadi belum bisa menilai pesertanya");
  }
}

export async function getLembarPenilaian(trainingId: string, siapa: Penilai): Promise<LembarPenilaianRecord> {
  const aspek = await aspekTraining(trainingId);
  if (siapa.peran === "WI") await pastikanWiDitugaskan(trainingId, siapa.pegawaiId);

  const daftar = await listPeserta(trainingId);
  const rows: NilaiRow[] = await prisma.nilaiPeserta.findMany({
    where: { peserta: { trainingId } },
    select: { pesertaId: true, kodeAspek: true, nilai: true, sumber: true, penilai: true },
  });
  const perPeserta = new Map<string, NilaiRow[]>();
  for (const r of rows) {
    const arr = perPeserta.get(r.pesertaId);
    if (arr) arr.push(r);
    else perPeserta.set(r.pesertaId, [r]);
  }

  const wi = siapa.peran === "WI";
  const aspekTampil = wi ? aspek.filter((a) => a.bisaDiisiWi) : aspek;

  const peserta: PesertaPenilaianRecord[] = daftar.peserta.map((p) => {
    const milik = perPeserta.get(p.id) ?? [];
    const nilai: Record<string, SelNilaiRecord> = {};
    const angka = new Map<string, number | null>();
    for (const a of aspek) {
      const entri: EntriNilai[] = milik
        .filter((r) => r.kodeAspek === a.kode && (r.sumber === "REKAP" || r.sumber === "PENILAI"))
        .map((r) => ({ nilai: r.nilai, sumber: r.sumber as SumberNilai }));
      const n = nilaiAspek(entri);
      angka.set(a.kode, n.nilai);
      if (aspekTampil.includes(a)) {
        const sendiri = milik.find((r) => r.kodeAspek === a.kode && r.penilai === kunciPenilai(siapa));
        // WI hanya melihat isiannya sendiri, bukan isian penilai lain.
        nilai[a.kode] = wi ? { nilai: sendiri?.nilai ?? null, dari: null, jumlahPenilai: 0, milikSaya: sendiri?.nilai ?? null } : { ...n, milikSaya: sendiri?.nilai ?? null };
      }
    }
    const base: PesertaPenilaianRecord = {
      id: p.id,
      nomor: p.nomor,
      nama: p.nama,
      nip: p.nip,
      instansi: p.instansi,
      status: p.status,
      kehadiran: p.rekap.tingkat,
      nilai,
    };
    if (wi) return base;
    const remedial: Partial<Record<JenisEvaluasi, number>> = {};
    for (const r of milik) {
      const j = jenisDariKodeRemedial(r.kodeAspek);
      if (j && r.sumber === "REKAP") remedial[j] = r.nilai;
    }
    return { ...base, remedial, hasil: hitungHasil(aspek, angka, remedial) };
  });

  if (!wi) {
    const rank = peringkat(
      peserta
        // Peserta yang ketidakhadirannya mencapai batas Pedoman tidak diberi peringkat
        // (penyelenggara yang memutuskan statusnya).
        .filter((p) => p.status === "AKTIF" && p.kehadiran !== "batas" && p.hasil)
        .map((p) => ({ id: p.id, nilaiAkhir: p.hasil!.nilaiAkhir, status: p.hasil!.status })),
    );
    for (const p of peserta) p.peringkat = rank.get(p.id) ?? null;
  }

  return {
    training: toTrainingRecord(await getTrainingByIdOrThrow(trainingId)),
    peran: siapa.peran,
    bolehUbah: siapa.peran !== "PIMPINAN",
    aspek: aspekTampil,
    peserta,
  };
}

export type IsianNilai = { pesertaId: string; kodeAspek: string; nilai: number | string | null };

/**
 * Simpan banyak nilai sekaligus. `nilai` null/"" = hapus isian pengisi ini
 * (penyelenggara: nilai rekap sel itu).
 * Semua baris diperiksa dulu; satu salah = tidak ada yang disimpan.
 */
export async function simpanNilai(trainingId: string, isian: IsianNilai[], siapa: Penilai): Promise<LembarPenilaianRecord> {
  if (siapa.peran === "PIMPINAN") throw new ForbiddenError("Pimpinan hanya dapat melihat penilaian");
  if (isian.length === 0) throw new ValidationError("Tidak ada nilai yang dikirim");
  const aspek = await aspekTraining(trainingId);
  if (siapa.peran === "WI") await pastikanWiDitugaskan(trainingId, siapa.pegawaiId);
  const sumber: SumberNilai = siapa.peran === "PENYELENGGARA" ? "REKAP" : "PENILAI";

  const pesertaRows: { id: string; nama: string; status: string }[] = await prisma.peserta.findMany({
    where: { trainingId },
    select: { id: true, nama: true, status: true },
  });
  const pesertaById = new Map(pesertaRows.map((p) => [p.id, p]));

  const kunci = new Set<string>();
  const bersih = isian.map((x, i) => {
    const ke = `Baris ke-${i + 1}`;
    const p = pesertaById.get(x.pesertaId);
    if (!p) throw new NotFoundError(`${ke}: peserta tidak ada pada jadwal ini`);
    const a = aspek.find((y) => y.kode === x.kodeAspek);
    const jenisRemedial = jenisDariKodeRemedial(x.kodeAspek);
    if (!a && !jenisRemedial) throw new ValidationError(`${ke}: aspek "${x.kodeAspek}" tidak dikenal untuk program ini`);
    if (siapa.peran === "WI" && (!a || !a.bisaDiisiWi)) {
      throw new ForbiddenError(`${ke}: aspek ini diisi penyelenggara, bukan Widyaiswara`);
    }
    const n = bacaNilai(x.nilai);
    if (n === undefined) throw new ValidationError(`${ke} (${p.nama}): nilai harus angka 0–100, paling banyak 2 desimal`);
    if (n !== null && p.status !== "AKTIF") {
      throw new ValidationError(`${ke}: ${p.nama} tidak aktif lagi, jadi tidak bisa diberi nilai baru`);
    }
    const k = `${x.pesertaId}|${x.kodeAspek}`;
    if (kunci.has(k)) throw new ValidationError(`${ke}: nilai ${p.nama} untuk aspek yang sama dikirim dua kali`);
    kunci.add(k);
    return { pesertaId: x.pesertaId, kodeAspek: x.kodeAspek, nilai: n, jenisRemedial, nama: p.nama };
  });

  // Hitung keadaan tiap peserta SETELAH kiriman ini diterapkan, untuk:
  //  - menolak remedial pada evaluasi yang tidak (lagi) kurang baik;
  //  - menghapus remedial lama yang tidak berlaku lagi karena nilai aspeknya berubah
  //    (supaya tidak "hidup kembali" bila nilainya turun lagi kelak).
  const penilai = kunciPenilai(siapa);
  const ids = [...new Set(bersih.map((b) => b.pesertaId))];
  const ada: NilaiRow[] = await prisma.nilaiPeserta.findMany({
    where: { pesertaId: { in: ids } },
    select: { pesertaId: true, kodeAspek: true, nilai: true, sumber: true, penilai: true },
  });
  const remedialUsang: { pesertaId: string; kodeAspek: string }[] = [];
  for (const id of ids) {
    const kiriman = bersih.filter((b) => b.pesertaId === id);
    const entri = ada.filter((r) => r.pesertaId === id && !jenisDariKodeRemedial(r.kodeAspek));
    for (const b of kiriman.filter((b) => !b.jenisRemedial)) {
      const j = entri.findIndex((r) => r.kodeAspek === b.kodeAspek && r.penilai === penilai);
      if (j >= 0) entri.splice(j, 1);
      if (b.nilai !== null) entri.push({ pesertaId: id, kodeAspek: b.kodeAspek, nilai: b.nilai, sumber, penilai });
    }
    const angka = new Map(
      aspek.map((a) => [a.kode, nilaiAspek(entri.filter((r) => r.kodeAspek === a.kode).map((r) => ({ nilai: r.nilai, sumber: r.sumber as SumberNilai }))).nilai]),
    );
    const { perluRemedial } = hitungHasil(aspek, angka);
    for (const b of kiriman.filter((b) => b.jenisRemedial && b.nilai !== null)) {
      if (!perluRemedial.includes(b.jenisRemedial as JenisEvaluasi)) {
        const label = EVALUASI.find((e) => e.kode === b.jenisRemedial)?.label ?? b.jenisRemedial;
        throw new ValidationError(`${b.nama}: remedial ${label} hanya bisa diisi kalau evaluasi itu berkualifikasi kurang baik dan kelulusannya ditunda`);
      }
    }
    for (const r of ada.filter((r) => r.pesertaId === id)) {
      const j = jenisDariKodeRemedial(r.kodeAspek);
      if (j && !perluRemedial.includes(j)) remedialUsang.push({ pesertaId: id, kodeAspek: r.kodeAspek });
    }
  }

  const nama = siapa.nama ?? null;
  try {
    await prisma.$transaction([
      ...bersih.map((b) =>
        b.nilai === null
          ? prisma.nilaiPeserta.deleteMany({ where: { pesertaId: b.pesertaId, kodeAspek: b.kodeAspek, penilai } })
          : prisma.nilaiPeserta.upsert({
              where: { pesertaId_kodeAspek_penilai: { pesertaId: b.pesertaId, kodeAspek: b.kodeAspek, penilai } },
              create: { pesertaId: b.pesertaId, kodeAspek: b.kodeAspek, nilai: b.nilai, sumber, penilai, penilaiNama: nama },
              update: { nilai: b.nilai, sumber, penilaiNama: nama },
            }),
      ),
      ...remedialUsang.map((r) => prisma.nilaiPeserta.deleteMany({ where: { pesertaId: r.pesertaId, kodeAspek: r.kodeAspek } })),
    ]);
  } catch (e) {
    if (kodePrisma(e) === "P2003" || kodePrisma(e) === "P2025") throw new NotFoundError("Peserta sudah dihapus");
    if (kodePrisma(e) === "P2002") throw new ConflictError("Nilai yang sama sedang disimpan dari tempat lain. Muat ulang halaman lalu coba lagi.");
    throw e;
  }
  return getLembarPenilaian(trainingId, siapa);
}
