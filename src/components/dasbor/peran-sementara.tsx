"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/ui/button";
import { kirimJson } from "@/lib/api-klien";

type Pilihan = { id: string; role: string; sebagai: string; selesai: string };
const tgl = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Pita Plt/Plh di atas halaman (sama dengan aplikasi lama): muncul bila akun ini punya penugasan sementara yang berlaku. Pemiliknya
 * memilih kapan bertindak sebagai Plt/Plh (peran & menu ikut berganti) dan kapan kembali ke peran sendiri. Server memeriksa ulang.
 */
export function PeranSementara({ sebagai, pilihan }: { sebagai: string | null; pilihan: Pilihan[] }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  if (!sebagai && !pilihan.length) return null;

  async function pilih(pltId: string | null) {
    setSibuk(true);
    setGalat("");
    const r = await kirimJson("/api/auth/peran", "POST", { pltId });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
      {sebagai ? (
        <>
          <span>
            Anda sedang bertindak sebagai <span className="font-medium">{sebagai}</span>. Tindakan tercatat atas nama jabatan ini.
          </span>
          <Button size="sm" variant="secondary" disabled={sibuk} onClick={() => pilih(null)}>
            Kembali ke peran sendiri
          </Button>
        </>
      ) : (
        pilihan.map((p) => (
          <span key={p.id} className="flex flex-wrap items-center gap-2">
            <span>
              Anda ditetapkan sebagai <span className="font-medium">{p.sebagai}</span> s.d. <span className="font-mono">{tgl(p.selesai)}</span>.
            </span>
            <Button size="sm" variant="secondary" disabled={sibuk} onClick={() => pilih(p.id)}>
              Bertindak sebagai {p.sebagai}
            </Button>
          </span>
        ))
      )}
      {galat ? <Alert tone="danger" title={galat} /> : null}
    </div>
  );
}
