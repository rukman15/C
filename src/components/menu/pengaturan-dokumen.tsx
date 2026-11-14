"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import Toast from "@/components/arc/toast/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { kirimJson } from "@/lib/api-klien";
import type { PengaturanDokumenRecord } from "@/lib/server/repositories/dokumen";

/** Pengaturan Dokumen (admin): pejabat penanda tangan (Kepala Balai, Kabag TU) dan perjalanan dinas (PPK, DIPA, akun). */
export function PengaturanDokumen({ awal }: { awal: PengaturanDokumenRecord }) {
  const [kepala, setKepala] = useState(awal.kepalaBalai);
  const [kabag, setKabag] = useState(awal.kabagTu);
  const [jalan, setJalan] = useState(awal.perjalanan);
  const [info, setInfo] = useState(awal);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  async function simpan(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<PengaturanDokumenRecord>("/api/admin/pengaturan-dokumen", "PUT", { kabagTu: kabag, kepalaBalai: kepala, perjalanan: jalan });
    setSibuk(false);
    if (!r.ok) return setGalat(r.error);
    setInfo(r.data);
    setToast("Tersimpan.");
  }
  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg font-medium">Pejabat penanda tangan</h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Input label="Kepala Balai Besar — nama & gelar" value={kepala.nama} onChange={(v) => setKepala((x) => ({ ...x, nama: v }))} maxLength={150} />
          <Input label="NIP" value={kepala.nip} onChange={(v) => setKepala((x) => ({ ...x, nip: v }))} maxLength={30} inputMode="numeric" />
          <Input label="Kepala Bagian Tata Usaha — nama & gelar" value={kabag.nama} onChange={(v) => setKabag((x) => ({ ...x, nama: v }))} maxLength={150} />
          <Input label="NIP" value={kabag.nip} onChange={(v) => setKabag((x) => ({ ...x, nip: v }))} maxLength={30} inputMode="numeric" />
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <div>
          <h2 className="font-display text-lg font-medium">Perjalanan dinas (surat tugas & SPD)</h2>
          <p className="text-sm text-muted-foreground">PPK menandatangani SPD; nomor SP DIPA dan akun dipakai sebagai isian bawaan.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Input label="Pejabat Pembuat Komitmen (PPK) — nama & gelar" value={jalan.ppkNama} onChange={(v) => setJalan((x) => ({ ...x, ppkNama: v }))} maxLength={150} />
          <Input label="NIP" value={jalan.ppkNip} onChange={(v) => setJalan((x) => ({ ...x, ppkNip: v }))} maxLength={30} inputMode="numeric" />
          <Input
            label="Nomor SP DIPA tahun berjalan"
            value={jalan.dipaTeks}
            onChange={(v) => setJalan((x) => ({ ...x, dipaTeks: v }))}
            maxLength={200}
            placeholder="SP DIPA-010.121.403216/2026 tanggal 1 Desember 2025"
          />
          <Input
            label="Akun (MAK) perjalanan dinas"
            value={jalan.akunPerjalanan}
            onChange={(v) => setJalan((x) => ({ ...x, akunPerjalanan: v }))}
            maxLength={60}
            placeholder="mis. 524111"
          />
        </div>
      </section>
      {galat ? <Alert tone="danger" title={galat} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {info.updatedAt ? `Terakhir diubah ${new Date(info.updatedAt).toLocaleString("id-ID")}${info.diubahOleh ? ` oleh ${info.diubahOleh}` : ""}` : ""}
        </span>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
      <Toast title="Pengaturan Dokumen" description={toast ?? undefined} open={toast !== null} onOpenChange={(o) => !o && setToast(null)} />
    </form>
  );
}
