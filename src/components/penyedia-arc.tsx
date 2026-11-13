"use client";

import Link from "next/link";
import { ArcProvider, type ArcLinkProps } from "@/components/arc/lib/arc-provider";

/** Tautan di dalam komponen Arc memakai next/link (navigasi tanpa muat ulang). */
function TautanNext({ href, ...props }: ArcLinkProps) {
  return <Link href={href} {...props} />;
}

export function PenyediaArc({ children }: { children: React.ReactNode }) {
  return <ArcProvider link={TautanNext}>{children}</ArcProvider>;
}
