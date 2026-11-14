import { failFromError } from "@/lib/server/http";
import { wajibBacaSuratId } from "@/lib/server/akses-dokumen";
import { getSuratTugas } from "@/lib/server/repositories/dokumen";
import { docxSuratTugas, namaBerkas, siapkanLogo } from "@/lib/server/docx-dokumen";
import { MIME_DOCX, unduhan } from "@/lib/server/unduhan";

type Ctx = { params: Promise<{ id: string }> };

/** Konsep Word surat tugas (tanpa tanda tangan; ditandatangani lewat TTE). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await wajibBacaSuratId(params.id);
    const s = await getSuratTugas(params.id);
    const nama = namaBerkas("Surat Tugas", s.trainingName, s.penerima.length === 1 ? s.penerima[0].nama : `${s.penerima.length} orang`);
    await siapkanLogo(fetch);
    return unduhan(await docxSuratTugas(s), `${nama}.docx`, MIME_DOCX);
  } catch (e) {
    return failFromError(e);
  }
}
