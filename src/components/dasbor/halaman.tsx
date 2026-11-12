import { cn } from "@/lib/utils";

/** Pembungkus halaman dasbor: judul (= label menu), keterangan, isi. */
export function HalamanDasbor({
  judul,
  keterangan,
  lebar = "sedang",
  children,
}: {
  judul: string;
  keterangan?: React.ReactNode;
  lebar?: "sempit" | "sedang" | "penuh";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", lebar === "sempit" ? "max-w-2xl" : lebar === "sedang" ? "max-w-5xl" : "max-w-7xl")}>
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">{judul}</h1>
        {keterangan ? <p className="mt-1.5 text-sm text-muted-foreground">{keterangan}</p> : null}
      </header>
      {children}
    </div>
  );
}

/** Kartu bergaris tanpa bayangan. */
export function Kartu({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-border p-5", className)}>{children}</section>;
}
