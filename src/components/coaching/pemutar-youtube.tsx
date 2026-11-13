"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { gambarYoutube, sematanYoutube, tautanYoutube } from "@/lib/coaching";

/**
 * Pemutar YouTube di dalam halaman (sama dengan aplikasi lama): iframe baru dimuat setelah diklik, jadi YouTube tidak
 * dihubungi sampai peserta memilih menonton. Mode privasi youtube-nocookie.
 */
export function PemutarYoutube({ youtubeId, judul }: { youtubeId: string; judul: string }) {
  const [putar, setPutar] = useState(false);
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
        {putar ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`${sematanYoutube(youtubeId)}&autoplay=1`}
            title={judul}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" className="group absolute inset-0 size-full" onClick={() => setPutar(true)} aria-label={`Putar video: ${judul}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gambarYoutube(youtubeId)} alt="" loading="lazy" className="size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                <Play size={24} fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <a
        href={tautanYoutube(youtubeId)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:underline"
      >
        Buka di YouTube <ExternalLink size={10} />
      </a>
    </div>
  );
}
