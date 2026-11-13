import { UKURAN_MAKS_BERKAS } from "@/lib/berkas-peserta";
import { UKURAN_MAKS_TUGAS } from "@/lib/tugas";
import { UKURAN_MAKS_BYTE } from "@/lib/dokumen-peserta";

/** Batas ukuran per jenis unggahan (sama dengan pemeriksaan di rute masing-masing). */
export const MAKS_TITIPAN = { "berkas-peserta": UKURAN_MAKS_BERKAS, tugas: UKURAN_MAKS_TUGAS, dokumen: UKURAN_MAKS_BYTE, kunjungan: 10 * 1024 * 1024 } as const;
export type JenisUnggah = keyof typeof MAKS_TITIPAN;

type Hasil<T> = { ok: true; data: T } | { ok: false; error: string };
const GAGAL_SAMBUNG = "Tidak bisa terhubung ke server. Periksa koneksi Anda.";

/**
 * Kirim berkas + isian ke rute unggah (klien). Bila server mengizinkan, berkas diunggah langsung ke Supabase lebih dulu
 * (lolos batas ±4,5 MB Vercel) lalu rute menerima JSON `{ ...isian, titipan }`; bila tidak, multipart biasa.
 */
export async function kirimBerkas<T>(url: string, jenis: JenisUnggah, isian: Record<string, string>, berkas: File | null): Promise<Hasil<T>> {
  try {
    if (berkas) {
      const m = (await (
        await fetch("/api/unggah", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jenis, nama: berkas.name, tipe: berkas.type, ukuran: berkas.size }),
        })
      ).json()) as Hasil<{ langsung: boolean; url?: string; token?: string }>;
      if (!m.ok) return m;
      if (m.data.langsung && m.data.url && m.data.token) {
        const put = await fetch(m.data.url, { method: "PUT", headers: { "content-type": berkas.type || "application/octet-stream", "x-upsert": "false" }, body: berkas });
        if (!put.ok) return { ok: false, error: `Berkas gagal diunggah ke penyimpanan (${put.status}). Coba lagi.` };
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...isian, titipan: m.data.token }) });
        return (await res.json()) as Hasil<T>;
      }
    }
    const form = new FormData();
    for (const [k, v] of Object.entries(isian)) form.set(k, v);
    if (berkas) form.set("berkas", berkas);
    return (await (await fetch(url, { method: "POST", body: form })).json()) as Hasil<T>;
  } catch {
    return { ok: false, error: GAGAL_SAMBUNG };
  }
}
