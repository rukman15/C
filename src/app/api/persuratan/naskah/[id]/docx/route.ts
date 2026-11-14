import { failFromError } from "@/lib/server/http";
import { PENOMOR, PENYUSUN_NASKAH, pengguna } from "@/lib/server/akses-persuratan";
import { getNaskah } from "@/lib/server/repositories/persuratan";
import { namaBerkas, siapkanLogo } from "@/lib/server/docx-dokumen";
import { docxNaskah } from "@/lib/server/docx-naskah";
import { MIME_DOCX, unduhan } from "@/lib/server/unduhan";

type Ctx = { params: Promise<{ id: string }> };

/** Konsep Word naskah dinas (tanpa tanda tangan; ditandatangani lewat TTE). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    await pengguna([...PENYUSUN_NASKAH, ...PENOMOR]);
    const n = await getNaskah(params.id);
    await siapkanLogo(fetch);
    return unduhan(await docxNaskah(n), `${namaBerkas(n.label, n.hal || n.tanggal)}.docx`, MIME_DOCX);
  } catch (e) {
    return failFromError(e);
  }
}
