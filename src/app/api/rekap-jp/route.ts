import { ok, fail, failFromError } from "@/lib/server/http";
import { PEMBACA_REKAP_JP } from "@/lib/server/akses-dokumen";
import { wajibKoordinatorAtau } from "@/lib/server/akses";
import { rekapJpBulanan } from "@/lib/server/repositories/dokumen";
import { isBulan } from "@/lib/dokumen";
import { unduhan } from "@/lib/server/unduhan";

/** Rekap JP tatap muka bulanan semua WI: ?bulan=YYYY-MM[&format=csv]. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await wajibKoordinatorAtau(PEMBACA_REKAP_JP);
    const bulan = url.searchParams.get("bulan") ?? "";
    if (!isBulan(bulan)) return fail("Bulan tidak valid (YYYY-MM)");
    const rekap = await rekapJpBulanan(bulan);
    if (url.searchParams.get("format") !== "csv") return ok(rekap);
    // CSV untuk Excel (pemisah ";" + BOM, NIP sebagai teks).
    const sel = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const baris = [
      ["No", "Nama", "NIP", "Jabatan", "JP Tatap Muka"],
      ...rekap.map((r, i) => [i + 1, r.nama, r.nip ? `'${r.nip}` : "", r.jabatan, r.tatapMuka]),
    ];
    const isi = "\ufeff" + baris.map((b) => b.map(sel).join(";")).join("\r\n");
    return unduhan(Buffer.from(isi, "utf8"), `Rekap_JP_WI_${bulan}.csv`, "text/csv; charset=utf-8");
  } catch (e) {
    return failFromError(e);
  }
}
