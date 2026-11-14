"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/ui/input";
import { ambilJson } from "@/lib/api-klien";
import type { LogAuditRecord } from "@/lib/server/audit";

const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Log Audit (admin): jejak tindakan yang menyangkut hak akses, dengan pencarian. */
export function LogAudit({ awal }: { awal: LogAuditRecord[] }) {
  const [list, setList] = useState(awal);
  const [cari, setCari] = useState("");
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = cari.trim();
      const r = await ambilJson<LogAuditRecord[]>(`/api/admin/audit?take=300${q ? `&cari=${encodeURIComponent(q)}` : ""}`);
      if (r.ok) setList(r.data);
    }, 350);
    return () => clearTimeout(t);
  }, [cari]);
  return (
    <div className="flex flex-col gap-4">
      <Input label="Cari" value={cari} onChange={setCari} placeholder="Pelaku, tindakan, atau sasaran…" leftIcon={<Search size={16} />} />
      {!list.length ? (
        <EmptyState title="Belum ada catatan" description="Catatan audit tampil di sini." />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {list.map((l) => (
            <li key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  {l.aksi}
                  {l.sasaran ? ` — ${l.sasaran}` : ""}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{waktu(l.waktu)}</span>
              </div>
              {l.rincian ? <p className="mt-0.5 text-xs text-muted-foreground">{l.rincian}</p> : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                oleh {l.pelakuNama}
                {l.sebagai ? ` sebagai ${l.sebagai}` : ""} · {l.pelaku}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
