import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENOMOR, pengguna } from "@/lib/server/akses-persuratan";
import { beriNomor, listAgenda } from "@/lib/server/repositories/persuratan";
import { skemaBeriNomor } from "@/lib/server/skema-persuratan";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { awalHariWib } from "@/lib/tanggal";
import { unduhan } from "@/lib/server/unduhan";

/** Buku agenda surat keluar: ?tahun=YYYY[&format=csv] (GET), beri nomor (POST). Hanya TU. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna([...PENOMOR, "kepala-balai"]);
    const tahun = Number(url.searchParams.get("tahun") ?? "") || awalHariWib().getUTCFullYear();
    const agenda = await listAgenda(tahun);
    if (url.searchParams.get("format") !== "csv") return ok(agenda);
    const sel = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const baris = [
      ["No. Urut", "Nomor Surat", "Tanggal", "Jenis", "Hal", "Kode Klasifikasi", "Dicatat oleh"],
      ...[...agenda.baris].reverse().map((r) => [r.nomorUrut, r.nomor, r.tanggal, r.jenis, r.hal, r.kodeKlasifikasi, r.dicatatOleh]),
    ];
    const isi = "\ufeff" + baris.map((b) => b.map(sel).join(";")).join("\r\n");
    return unduhan(Buffer.from(isi, "utf8"), `Agenda_Surat_Keluar_${tahun}.csv`, "text/csv; charset=utf-8");
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const p = await pengguna(PENOMOR);
    const parsed = skemaBeriNomor.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    const hasil = await beriNomor(parsed.data, p.email);
    await catatAudit(await pelakuSesi(), AKSI_AUDIT.NOMOR_SURAT, hasil.map((h) => h.nomor).join(" & "), hasil[0]?.hal ?? null);
    return ok(hasil, { status: 201 });
  } catch (e) {
    return failFromError(e);
  }
}
