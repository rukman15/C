"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, IdCard, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HALAMAN_AKUN } from "@/lib/akun";
import { kirimJson } from "@/lib/api-klien";

export function FormMasuk() {
  const router = useRouter();
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  async function masuk(e: FormEvent) {
    e.preventDefault();
    if (memuat) return;
    if (!nip.trim() || !password) {
      setGalat("Isi NIP, email, atau nama pengguna dan kata sandi.");
      return;
    }
    setMemuat(true);
    setGalat(null);
    const res = await kirimJson<{ wajibGantiSandi: boolean }>("/api/auth/session", "POST", { nip, password });
    if (!res.ok) {
      setGalat(res.error);
      setMemuat(false);
      return;
    }
    router.replace(res.data.wajibGantiSandi ? HALAMAN_AKUN : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={masuk} className="flex flex-col gap-4" noValidate>
      <Input
        label="NIP, email, atau nama pengguna"
        name="nip"
        autoComplete="username"
        autoFocus
        value={nip}
        onChange={setNip}
        leftIcon={<IdCard className="size-4" aria-hidden />}
        disabled={memuat}
      />
      <Input
        label="Kata sandi"
        name="password"
        type={lihat ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        leftIcon={<LockKeyhole className="size-4" aria-hidden />}
        rightIcon={
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={lihat}
          >
            {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
        error={galat ?? undefined}
        reserveErrorLine
        disabled={memuat}
      />
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={memuat}>
        {memuat ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
