import "server-only";
import { env } from "@/lib/server/env";
import { AppError, NotFoundError } from "@/lib/server/errors";
import { driveAktif, hapusDrive, idBerkasDrive, kunciTautan, salinDrive, unggahDrive } from "@/lib/server/penyimpanan-gdrive";
import { buatTokenBerkas } from "@/lib/server/token-berkas";

/**
 * Penyimpanan berkas PRIVAT (dokumen peserta, pindaian surat masuk) — hanya di server; berkas tidak
 * pernah punya URL publik. Unduhan memakai tautan berjangka yang kedaluwarsa cepat.
 *
 * Dua tempat (database hanya menyimpan bucket + jalur, jadi berpindah tempat tidak mengubah data):
 *  - Google Drive akun balai — dipakai bila `GDRIVE_FOLDER_ID` diisi (penyimpanan-gdrive.ts).
 *    Tautan unduh = `/api/berkas/<token>` (token HMAC berjangka).
 *  - Supabase Storage (bucket privat) — env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Bila Drive aktif,
 *    Supabase tetap dipakai untuk MEMBACA/menyalin/menghapus berkas lama yang belum ada di Drive.
 *
 * Saat uji, modul ini diganti `uji/tiruan/penyimpanan.ts` (di memori).
 */

export const BUCKET_DOKUMEN_PESERTA = "dokumen-peserta";
/** Masa berlaku tautan unduh (detik). */
export const UMUR_TAUTAN_DETIK = 60;

class PenyimpananError extends AppError {
  constructor(pesan: string) {
    super(pesan, 503);
  }
}

const supabaseAda = () => !!(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());

function konfigurasi(): { url: string; kunci: string } {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const kunci = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !kunci) throw new PenyimpananError("Penyimpanan berkas belum dikonfigurasi (GDRIVE_FOLDER_ID atau SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return { url, kunci };
}

const jalurAman = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export async function unggahBerkas(bucket: string, path: string, isi: Uint8Array, tipe: string): Promise<void> {
  if (driveAktif()) return unggahDrive(bucket, path, isi, tipe);
  const { url, kunci } = konfigurasi();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${jalurAman(path)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${kunci}`, apikey: kunci, "content-type": tipe, "x-upsert": "false" },
    body: new Blob([isi as BlobPart], { type: tipe }),
  });
  if (!res.ok) throw new PenyimpananError(`Berkas gagal disimpan (${res.status})`);
}

export async function hapusBerkas(bucket: string, path: string): Promise<void> {
  if (driveAktif()) {
    const id = await idBerkasDrive(bucket, path).catch(() => null);
    if (id) return hapusDrive(id);
    if (!supabaseAda()) return;
  }
  const { url, kunci } = konfigurasi();
  // Gagal menghapus berkas lama tidak menggagalkan permintaan (paling buruk tertinggal di bucket privat).
  await fetch(`${url}/storage/v1/object/${bucket}/${jalurAman(path)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${kunci}`, apikey: kunci },
  }).catch(() => undefined);
}

/** Tautan unduh berjangka, berlaku `UMUR_TAUTAN_DETIK` detik. */
export async function tautanUnduh(bucket: string, path: string, namaUnduh?: string): Promise<string> {
  if (driveAktif()) {
    const id = await idBerkasDrive(bucket, path);
    if (id) return `/api/berkas/${buatTokenBerkas({ id, exp: Date.now() + UMUR_TAUTAN_DETIK * 1000, ...(namaUnduh ? { nama: namaUnduh } : {}) }, kunciTautan())}`;
    if (!supabaseAda()) throw new NotFoundError("Berkas tidak ditemukan di Google Drive");
  }
  const { url, kunci } = konfigurasi();
  const res = await fetch(`${url}/storage/v1/object/sign/${bucket}/${jalurAman(path)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${kunci}`, apikey: kunci, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: UMUR_TAUTAN_DETIK }),
  });
  if (!res.ok) throw new PenyimpananError(`Tautan unduh gagal dibuat (${res.status})`);
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new PenyimpananError("Tautan unduh gagal dibuat");
  const dl = namaUnduh ? `&download=${encodeURIComponent(namaUnduh)}` : "";
  return `${url}/storage/v1${data.signedURL}${dl}`;
}

/** Salin berkas di dalam satu bucket (berkas lama tetap ada) — dipakai "pakai berkas dari diklat sebelumnya". */
export async function salinBerkas(bucket: string, dari: string, ke: string): Promise<void> {
  if (driveAktif()) {
    const id = await idBerkasDrive(bucket, dari);
    if (id) return salinDrive(id, bucket, ke);
    if (!supabaseAda()) throw new NotFoundError("Berkas sumber tidak ditemukan di Google Drive");
    // Berkas lama masih di Supabase: ambil isinya lalu simpan salinannya ke Drive.
    const { url, kunci } = konfigurasi();
    const res = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${jalurAman(dari)}`, {
      headers: { authorization: `Bearer ${kunci}`, apikey: kunci },
    });
    if (!res.ok) throw new PenyimpananError(`Berkas sumber gagal dibaca (${res.status})`);
    return unggahDrive(bucket, ke, new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type") ?? "application/octet-stream");
  }
  const { url, kunci } = konfigurasi();
  const res = await fetch(`${url}/storage/v1/object/copy`, {
    method: "POST",
    headers: { authorization: `Bearer ${kunci}`, apikey: kunci, "content-type": "application/json" },
    body: JSON.stringify({ bucketId: bucket, sourceKey: dari, destinationKey: ke }),
  });
  if (!res.ok) throw new PenyimpananError(`Berkas gagal disalin (${res.status})`);
}
