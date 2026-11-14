import "server-only";
export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Balasan berkas unduhan (nama berkas aman untuk header). */
export function unduhan(isi: Buffer, namaBerkas: string, mime: string): Response {
  const ascii = namaBerkas.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(isi), {
    status: 200,
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(namaBerkas)}`,
      "cache-control": "no-store",
    },
  });
}
