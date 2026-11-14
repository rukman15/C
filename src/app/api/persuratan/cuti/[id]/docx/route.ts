import { failFromError } from "@/lib/server/http";
import { pengguna } from "@/lib/server/akses-persuratan";
import { suratCuti } from "@/lib/server/repositories/cuti";
import { namaBerkas, siapkanLogo } from "@/lib/server/docx-dokumen";
import { docxCuti } from "@/lib/server/docx-naskah";
import { MIME_DOCX, unduhan } from "@/lib/server/unduhan";

type Ctx = { params: Promise<{ id: string }> };

/** Word Nota Dinas permohonan + Surat Izin Cuti (cuti yang sudah disetujui). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const s = await suratCuti(params.id, await pengguna());
    await siapkanLogo(fetch);
    return unduhan(await docxCuti(s), `${namaBerkas(s.cuti.label, s.cuti.pegawaiNama, s.cuti.mulai)}.docx`, MIME_DOCX);
  } catch (e) {
    return failFromError(e);
  }
}
