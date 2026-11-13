import { z } from "zod";
import { fail, failFromError, ok, parseJson } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { simpanSeminarKelompok, wajibKelolaSeminar } from "@/lib/server/repositories/seminar";

/**
 * Pengaturan seminar satu kelompok bimbingan & seminar (EB-055): kelas/ruang, penguji, evaluator, jam per peserta,
 * istirahat. `terapkan: true` sekaligus mengisi jadwal anggotanya. Penyelenggara pemegang diklat (admin selalu boleh).
 */
type Ctx = { params: Promise<{ id: string }> };
const teks = (n: number) => z.string().max(n).nullish();
const skema = z.object({
  jenis: z.enum(["RAP", "LAP"]),
  kelompokId: z.string().min(1).max(60),
  terapkan: z.boolean().default(false),
  tanggal: teks(10),
  jamMulai: teks(5),
  durasiMenit: z.number().int().nullish(),
  istirahatMulai: teks(5),
  istirahatSelesai: teks(5),
  ruang: teks(300),
  tautanDaring: teks(600),
  pengujiPegawaiId: teks(60),
  pengujiNama: teks(300),
  evaluatorNama: teks(300),
  evaluatorPonsel: teks(30),
});

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await wajibKelolaSeminar(id);
    const parsed = skema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const { jenis, kelompokId, terapkan, ...isian } = parsed.data;
    return ok(await simpanSeminarKelompok(id, jenis, kelompokId, isian, terapkan, a.email));
  } catch (e) {
    return failFromError(e);
  }
}
