"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import Toast from "@/components/arc/toast/toast";
import { Button } from "@/components/ui/button";
import { FormTambahJadwal } from "@/components/jadwal/form-jadwal";
import { NADA_STATUS } from "@/components/jadwal/kartu-diklat";
import { getJenjang, labelMode } from "@/lib/kurikulum";
import { labelKategori } from "@/lib/skema-training";
import { periodeTeks } from "@/lib/jadwal";
import { kirimJson } from "@/lib/api-klien";
import type { KunciTab, RincianDiklat } from "@/lib/rincian";
import type { TimDiklat } from "@/lib/tim-kerja";

/** Kepala halaman satu diklat: kembali, judul, lencana, ubah/hapus, dan tab bagian (Tabs Arc). */
export function KepalaDiklat({
  rincian: d,
  tab,
  bolehAtur,
  bolehHapus,
  global,
  pilihanTim,
}: {
  rincian: RincianDiklat;
  tab: { kunci: KunciTab; label: string; jalur: string }[];
  bolehAtur: boolean;
  bolehHapus: boolean;
  global: boolean;
  pilihanTim: TimDiklat[];
}) {
  const router = useRouter();
  const path = usePathname();
  const dasar = `/dashboard/diklat/${encodeURIComponent(d.id)}`;
  const aktif = tab.find((t) => t.jalur && path.startsWith(dasar + t.jalur))?.kunci ?? "rincian";
  const [ubah, setUbah] = useState(false);
  const [kabar, setKabar] = useState<{ judul: string; isi?: string } | null>(null);
  const jenjang = getJenjang(d.jenisPelatihan);
  const nada = NADA_STATUS[d.status];

  async function hapus() {
    const res = await kirimJson(`/api/training/${encodeURIComponent(d.id)}`, "DELETE");
    if (!res.ok) {
      setKabar({ judul: "Jadwal tidak dihapus", isi: res.error });
      // ConfirmMorph menampilkan keadaan gagal.
      throw new Error(res.error);
    }
    router.replace("/dashboard/jadwal");
    router.refresh();
  }

  return (
    <header>
      <Link href="/dashboard/jadwal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Jadwal Diklat
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-medium tracking-tight text-pretty break-words">{d.name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {periodeTeks(d.startDate, d.endDate)} · {d.tempat}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone={nada.tone} dot>
              {nada.label}
            </Badge>
            {jenjang ? (
              <Badge color="sky">
                {jenjang.kode} · {labelMode(d.modePelatihan)}
              </Badge>
            ) : null}
            {jenjang && d.angkatan ? <Badge outline>Angkatan {d.angkatan}</Badge> : null}
            <Badge outline>{labelKategori(d.category)}</Badge>
            {d.timKerjaNama ? <Badge outline>{/^tim\b/i.test(d.timKerjaNama) ? d.timKerjaNama : `Tim ${d.timKerjaNama}`}</Badge> : null}
          </div>
        </div>
        {bolehAtur ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setUbah(true)}>
              <Pencil className="size-4" aria-hidden />
              Ubah
            </Button>
            {bolehHapus ? (
              <ConfirmMorph
                label="Hapus"
                icon={<Trash2 size={16} />}
                prompt="Hapus jadwal ini?"
                confirmLabel="Ya, hapus"
                cancelLabel="Batal"
                pendingLabel="Menghapus"
                doneLabel="Dihapus"
                errorLabel="Gagal dihapus"
                retryLabel="Coba lagi"
                tone="danger"
                onConfirm={hapus}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {tab.length > 1 ? (
        <div className="tanpa-bilah -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Tabs value={aktif} onValueChange={(v) => router.push(dasar + (tab.find((t) => t.kunci === v)?.jalur ?? ""))}>
            <TabsList aria-label="Bagian diklat">
              {tab.map((t) => (
                <TabsTrigger key={t.kunci} value={t.kunci}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {bolehAtur ? (
        <FormTambahJadwal
          buka={ubah}
          global={global}
          pilihanTim={pilihanTim}
          awal={d}
          onTutup={() => setUbah(false)}
          onTersimpan={() => {
            setUbah(false);
            setKabar({ judul: "Perubahan jadwal disimpan" });
          }}
        />
      ) : null}
      <Toast title={kabar?.judul ?? ""} description={kabar?.isi} open={kabar !== null} onOpenChange={(o) => !o && setKabar(null)} />
    </header>
  );
}
