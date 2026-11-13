"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Tombol "Salin tautan" + "Gabung" untuk sesi daring (sama dengan beranda peserta aplikasi lama). */
export function SalinTautan({ tautan }: { tautan: string }) {
  const [tersalin, setTersalin] = useState(false);
  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      window.prompt("Salin tautan ini:", tautan);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink size="sm" href={tautan} target="_blank" rel="noopener noreferrer">
        Gabung <ExternalLink size={14} />
      </ButtonLink>
      <Button size="sm" variant="secondary" onClick={salin}>
        {tersalin ? <Check size={14} /> : <Copy size={14} />} {tersalin ? "Tersalin" : "Salin tautan"}
      </Button>
    </div>
  );
}
