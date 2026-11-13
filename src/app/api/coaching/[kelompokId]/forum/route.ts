import { fail, ok, parseJson, failFromError } from "@/lib/server/http";
import { pesanZod } from "@/lib/server/skema-lms";
import { skemaAksiForum } from "@/lib/server/skema-coaching";
import { aksesRuangCoaching } from "@/lib/server/akses-coaching";
import { AKSI_AUDIT, catatAudit, pelakuSesi } from "@/lib/server/audit";
import { kutip } from "@/lib/perhatian";
import * as repo from "@/lib/server/repositories/coaching";

type Ctx = { params: Promise<{ kelompokId: string }> };

/**
 * Forum tanya-jawab satu kelompok coaching.
 *  GET  — daftar topik (membuka daftar = tulisan dianggap sudah dibaca).
 *  POST { aksi } — topik | balas (semua kecuali pembaca); ubah-topik | ubah-balasan (penulis sendiri);
 *                  atur (sematkan: coach & penyelenggara; terjawab: juga penanya);
 *                  sembunyikan (coach & penyelenggara, tercatat di Log Audit — tulisan tidak dihapus).
 */
export async function GET(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await aksesRuangCoaching(params.kelompokId);
    return ok(await repo.listTopik(a));
  } catch (e) {
    return failFromError(e);
  }
}

export async function POST(request: Request, { params: p }: Ctx) {
  const params = await p;
  try {
    const a = await aksesRuangCoaching(params.kelompokId);
    const parsed = skemaAksiForum.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) return fail(pesanZod(parsed.error));
    const d = parsed.data;
    switch (d.aksi) {
      case "topik":
        return ok(await repo.buatTopik(a, d), { status: 201 });
      case "balas":
        return ok(await repo.balasTopik(a, d.topikId, d.isi), { status: 201 });
      case "ubah-topik":
        await repo.ubahTopik(a, d.id, d);
        break;
      case "ubah-balasan":
        await repo.ubahBalasan(a, d.id, d.isi);
        break;
      case "atur":
        await repo.aturTopik(a, d.id, d);
        break;
      case "sembunyikan": {
        const t = await repo.sembunyikan(a, d.jenis, d.id, d.sembunyi);
        await catatAudit(
          await pelakuSesi(),
          d.sembunyi ? AKSI_AUDIT.FORUM_DISEMBUNYIKAN : AKSI_AUDIT.FORUM_DITAMPILKAN,
          t.penulis,
          `${a.kelompok.label} · ${a.training.name}: "${kutip(t.kutipan, 80)}"`,
        );
        break;
      }
    }
    return ok({ disimpan: true });
  } catch (e) {
    return failFromError(e);
  }
}
