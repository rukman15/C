import { ok, fail, parseJson, failFromError } from "@/lib/server/http";
import { PENOMOR, PENYUSUN_NASKAH, pengguna, termasuk } from "@/lib/server/akses-persuratan";
import { ForbiddenError } from "@/lib/server/errors";
import { getNaskah, hapusNaskah, ubahNaskah } from "@/lib/server/repositories/persuratan";
import { skemaNaskah } from "@/lib/server/skema-persuratan";

type Ctx = { params: Promise<{ id: string }> };

/** Satu naskah: data lengkap untuk dicetak (GET), ubah (PUT), hapus konsep (DELETE). */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pengguna();
    const n = await getNaskah(params.id);
    // Penerima surat tugas boleh membaca/mencetak surat tugasnya sendiri setelah bernomor (Surat Tugas Saya).
    const penerima = n.jenis === "SURAT_TUGAS" && !!n.nomor && !!p.pegawaiId && n.pegawaiIds.includes(p.pegawaiId);
    if (!penerima && !termasuk(p, [...PENYUSUN_NASKAH, ...PENOMOR])) throw new ForbiddenError();
    return ok(n);
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pengguna([...PENYUSUN_NASKAH, ...PENOMOR]);
    const parsed = skemaNaskah.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));
    return ok(await ubahNaskah(params.id, parsed.data, p));
  } catch (e) {
    return failFromError(e);
  }
}

export async function DELETE(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const p = await pengguna([...PENYUSUN_NASKAH, ...PENOMOR]);
    await hapusNaskah(params.id, p);
    return ok({ id: params.id });
  } catch (e) {
    return failFromError(e);
  }
}
