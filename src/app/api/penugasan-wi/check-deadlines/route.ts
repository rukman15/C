import { ok, failFromError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import * as penugasanRepo from "@/lib/server/repositories/penugasan";
import * as updatesRepo from "@/lib/server/repositories/updates";

/**
 * Port dari app/api/penugasan-wi/check-deadlines/route.ts (Next.js). Logic
 * identik, termasuk komentar sumber di bawah ini.
 *
 * Fondasi otomasi buat aturan "penugasan WI maksimal H-3 sebelum diklat
 * mulai" (lihat CATATAN-PENUGASAN-WI.md sumber). BELUM disambung ke cron
 * apa pun — sekarang cuma bisa dipicu manual (admin) lewat POST ini. Kalau
 * nanti mau beneran otomatis, tinggal panggil endpoint ini dari scheduled
 * job (mis. Vercel Cron) sekali sehari; nggak perlu ubah kode di sini.
 *
 * Idempotent: id update dibikin deterministik per training
 * (`AUTO-DEADLINE-<trainingId>`), jadi dipanggil berkali-kali nggak bikin
 * notifikasi dobel buat training yang sama.
 */
export async function POST() {
  try {
    await requireRole(["admin"]);
    const overdue = await penugasanRepo.trainingLewatBatasTanpaWI();
    const existing = await updatesRepo.listUpdates("ketua-diklat");
    const existingIds = new Set(existing.map((u) => u.id));

    let dibuat = 0;
    for (const t of overdue) {
      const id = `AUTO-DEADLINE-${t.id}`;
      if (existingIds.has(id)) continue;
      await updatesRepo.createUpdate({
        id,
        role: "ketua-diklat",
        type: "penugasan",
        priority: "penting",
        title: `WI belum ditugaskan: ${t.name}`,
        description: `Sudah lewat batas H-3 — training mulai ${t.startDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`,
        time: "Hari ini",
        unread: true,
      });
      dibuat += 1;
    }

    return ok({ ditemukan: overdue.length, notifikasiBaru: dibuat });
  } catch (e) {
    return failFromError(e);
  }
}
