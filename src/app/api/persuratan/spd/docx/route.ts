import { fail, failFromError } from "@/lib/server/http";
import { PEMBACA_SPD, pengguna } from "@/lib/server/akses-persuratan";
import { setSpd, type SumberSpd } from "@/lib/server/repositories/spd";
import { namaBerkas } from "@/lib/server/docx-dokumen";
import { docxSpd } from "@/lib/server/docx-naskah";
import { MIME_DOCX, unduhan } from "@/lib/server/unduhan";

/** Word SPD (lembar I & II) semua penerima satu surat tugas: ?sumber=…&sumberId=…. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await pengguna(PEMBACA_SPD);
    const sumber = url.searchParams.get("sumber");
    const sumberId = url.searchParams.get("sumberId") ?? "";
    if ((sumber !== "naskah" && sumber !== "surat-tugas") || !sumberId) return fail("Pilih surat tugas");
    const set = await setSpd(sumber as SumberSpd, sumberId);
    if (!set.spd.length) return fail("Belum ada SPD untuk surat tugas ini", 404);
    return unduhan(await docxSpd(set), `${namaBerkas("SPD", set.surat.nomor ?? set.surat.tanggal)}.docx`, MIME_DOCX);
  } catch (e) {
    return failFromError(e);
  }
}
