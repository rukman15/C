import { z } from "zod";
import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { getActiveSession, requireRole } from "@/lib/server/auth";
import { UnauthorizedError } from "@/lib/server/errors";
import { pesanZod } from "@/lib/server/skema-lms";
import { getProfilSaya, ubahProfilSaya } from "@/lib/server/repositories/registrasi";

const teks = (maks: number) => z.string().max(maks).default("");
const skema = z.object({
  kodeProvinsi: teks(10),
  kodeKabKota: teks(10),
  instansi: teks(300),
  unitOrganisasi: teks(300),
  unitKerja: teks(300),
  golongan: teks(10),
  jabatan: teks(300),
  telepon: teks(30),
  ponsel: teks(30),
  alamat: teks(600),
  alamatKantor: teks(600),
  tempatLahir: teks(150),
  tanggalLahir: teks(10),
  jenisKelamin: teks(1),
  pendidikanTerakhir: teks(150),
  eselon: teks(30),
  tmtPangkat: teks(10),
  tmtJabatan: teks(10),
});

/** Profil Saya (akun peserta hasil registrasi mandiri): GET data, PUT ubah isian yang boleh diubah sendiri. */
async function email(): Promise<string> {
  await requireRole(["peserta"]);
  const s = (await getActiveSession());
  if (!s) throw new UnauthorizedError();
  return s.email;
}

export async function GET() {
  try {
    return ok(await getProfilSaya(await email()));
  } catch (e) {
    return failFromError(e);
  }
}

export async function PUT(request: Request) {
  try {
    const e = await email();
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    return ok(await ubahProfilSaya(e, parsed.data));
  } catch (err) {
    return failFromError(err);
  }
}
