/** Satu baris rata-rata aspek dengan batang 0–100 (rekap evaluasi). */
export function BatangAspek({ nama, rata, catatan }: { nama: string; rata: number | null; catatan?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span className="flex-1 text-muted-foreground">
        {nama}
        {catatan ? <span className="opacity-70"> ({catatan})</span> : null}
      </span>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${rata ?? 0}%` }} />
      </div>
      <span className="w-12 text-right font-mono">{rata == null ? "—" : rata.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span>
    </div>
  );
}
