import { failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { getSuratKeterangan } from "@/lib/server/repositories/surat-keterangan";
import { docxSuratKeterangan, namaBerkas, siapkanLogo } from "@/lib/server/docx-dokumen";
import { MIME_DOCX, unduhan } from "@/lib/server/unduhan";

/** Konsep Word surat keterangan (tanpa tanda tangan; ditandatangani lewat TTE). */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const s = await requireRole(["ketua-diklat", "kepala-balai", "kabag-tu"]);
    const r = await getSuratKeterangan(id, s.email);
    await siapkanLogo((u) => fetch(new URL(u, request.url)));
    return unduhan(await docxSuratKeterangan(r), `${namaBerkas("Surat Keterangan", r.pesertaNama, r.trainingName)}.docx`, MIME_DOCX);
  } catch (e) {
    return failFromError(e);
  }
}
