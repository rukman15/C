import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/server/halaman";
import { listBentrokan, type BentrokanRecord } from "@/lib/server/repositories/bentrokan";
import { HalamanDasbor } from "@/components/dasbor/halaman";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cek Bentrokan" };

const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const irisan = (b: BentrokanRecord) => (b.irisanMulai === b.irisanSelesai ? tgl(b.irisanMulai) : `${tgl(b.irisanMulai)} – ${tgl(b.irisanSelesai)}`);

/** Cek Bentrokan: WI yang ditugaskan ke dua pelatihan dengan periode beririsan (sama dengan aplikasi lama). */
export default async function HalamanBentrokan() {
  const p = await wajibPengguna();
  const boleh = ["admin", "ketua-diklat", "kepala-balai"].includes(p.role) || p.koordinatorWi;
  const list = boleh ? await listBentrokan() : [];
  const pasti = list.filter((b) => b.tingkat === "pasti").length;
  return (
    <HalamanDasbor
      judul="Cek Bentrokan"
      keterangan="Widyaiswara yang ditugaskan ke dua pelatihan dengan periode beririsan. Dihitung dari penugasan menunggu atau disetujui pada pelatihan yang belum selesai."
    >
      {!boleh ? (
        <EmptyState title="Tidak berwenang" description="Khusus Ketua Diklat, Kepala Balai, dan Koordinator WI." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="danger">
              Bentrok pasti: <span className="font-mono">{pasti}</span>
            </Badge>
            <Badge tone="warning">
              Potensi (menunggu persetujuan): <span className="font-mono">{list.length - pasti}</span>
            </Badge>
          </div>
          {!list.length ? (
            <EmptyState title="Tidak ada bentrokan jadwal" description="Tidak ada Widyaiswara yang ditugaskan ke dua pelatihan dengan periode beririsan." />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((b) => (
                <li key={b.a.approvalId + b.b.approvalId} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{b.instructorName}</span>
                    <Badge size="sm" tone={b.tingkat === "pasti" ? "danger" : "warning"}>
                      {b.tingkat === "pasti" ? "Bentrok pasti" : "Potensi bentrok"}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Irisan {irisan(b)} · <span className="font-mono">{b.hariBentrok}</span> hari
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[b.a, b.b].map((s) => (
                      <div key={s.approvalId} className="rounded-xl bg-muted/50 px-3 py-2">
                        <p className="text-sm font-medium">{s.trainingName}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.periode} · {s.status === "disetujui" ? "Disetujui" : "Menunggu persetujuan"}
                        </p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div>
            <ButtonLink href="/dashboard/jadwal">Buka Jadwal Diklat</ButtonLink>
          </div>
        </div>
      )}
    </HalamanDasbor>
  );
}
