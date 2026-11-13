import { pecahTautan } from "@/lib/coaching";
import { cn } from "@/lib/utils";

/** Teks tulisan forum/catatan: baris baru dipertahankan, alamat http(s) menjadi tautan (tanpa HTML mentah). */
export function TeksTautan({ teks, className }: { teks: string; className?: string }) {
  return (
    <p className={cn("text-sm break-words whitespace-pre-line", className)}>
      {pecahTautan(teks).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {p.teks}
          </a>
        ) : (
          <span key={i}>{p.teks}</span>
        ),
      )}
    </p>
  );
}
