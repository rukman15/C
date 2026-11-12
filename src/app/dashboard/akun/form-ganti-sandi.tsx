"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PANJANG_SANDI_MIN } from "@/lib/akun";
import { kirimJson } from "@/lib/api-klien";

type Galat = { lama?: string; baru?: string; ulang?: string; umum?: string };

export function FormGantiSandi({ wajib }: { wajib: boolean }) {
  const router = useRouter();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState<Galat>({});
  const [memuat, setMemuat] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (memuat) return;
    const g: Galat = {};
    if (!lama) g.lama = "Isi kata sandi lama";
    if (baru.length < PANJANG_SANDI_MIN) g.baru = `Minimal ${PANJANG_SANDI_MIN} karakter`;
    if (ulang !== baru) g.ulang = "Tidak sama dengan kata sandi baru";
    setGalat(g);
    if (Object.keys(g).length > 0) return;

    setMemuat(true);
    const res = await kirimJson("/api/akun/kata-sandi", "POST", { passwordLama: lama, passwordBaru: baru });
    setMemuat(false);
    if (!res.ok) {
      setGalat(/lama salah/i.test(res.error) ? { lama: res.error } : { umum: res.error });
      return;
    }
    setLama("");
    setBaru("");
    setUlang("");
    setBerhasil(true);
    // Sesi sudah ditandatangani ulang tanpa tanda wajib ganti: muat ulang supaya menu tampil.
    if (wajib) router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={simpan} className="mt-5 flex flex-col gap-3" noValidate>
      <Input label="Kata sandi lama" type="password" autoComplete="current-password" value={lama} onChange={setLama} error={galat.lama} reserveErrorLine />
      <Input
        label="Kata sandi baru"
        type="password"
        autoComplete="new-password"
        value={baru}
        onChange={(v) => {
          setBaru(v);
          setBerhasil(false);
        }}
        error={galat.baru}
        reserveErrorLine
      />
      <Input label="Ulangi kata sandi baru" type="password" autoComplete="new-password" value={ulang} onChange={setUlang} error={galat.ulang} reserveErrorLine />
      {galat.umum ? (
        <p role="alert" className="text-sm text-destructive">
          {galat.umum}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={memuat}>
          {memuat ? "Menyimpan…" : "Simpan kata sandi"}
        </Button>
        <AnimatePresence>
          {berhasil ? (
            <motion.p
              role="status"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-sm text-success"
            >
              <CircleCheck className="size-4" aria-hidden />
              Kata sandi diganti
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </form>
  );
}
