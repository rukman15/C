import "server-only";
import { env } from "@/lib/server/env";
import { createHash, createSign } from "node:crypto";
import { AppError } from "@/lib/server/errors";
import { kutipKueriDrive as kutip, namaBerkasDrive } from "@/lib/server/token-berkas";

/**
 * Penyimpanan berkas di Google Drive akun balai (keputusan 26 Okt 2026; lihat
 * docs/fitur/CATATAN-PENYIMPANAN-GDRIVE.md). Aktif bila `GDRIVE_FOLDER_ID` diisi.
 *
 * Susunan: folder induk (GDRIVE_FOLDER_ID, JANGAN dibagikan ke publik) → satu subfolder per bucket
 * (`dokumen-peserta`, `surat-masuk`, dibuat otomatis) → berkas bernama jalur dengan "/" diganti "__".
 *
 * Masuk ke Google (pilih salah satu):
 *  - Akun Google balai (Gmail biasa / Workspace): GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN.
 *  - Service account: GDRIVE_SERVICE_ACCOUNT_JSON (isi berkas kunci JSON). Hanya bisa menulis ke
 *    Shared Drive (Google Workspace) — service account tidak punya kuota di "My Drive".
 *
 * Saat uji, `$lib/server/penyimpanan` diganti tiruan, jadi modul ini tidak dipanggil.
 */

class GDriveError extends AppError {
  constructor(pesan: string, status = 503) {
    super(pesan, status);
  }
}

const API = "https://www.googleapis.com/drive/v3/files";
const API_UNGGAH = "https://www.googleapis.com/upload/drive/v3/files";
const SEMUA_DRIVE = "supportsAllDrives=true";
const MIME_FOLDER = "application/vnd.google-apps.folder";

export const driveAktif = () => !!env.GDRIVE_FOLDER_ID?.trim();

type Kredensial =
  | { jenis: "service-account"; email: string; kunciPrivat: string }
  | { jenis: "akun"; clientId: string; clientSecret: string; refreshToken: string };

function kredensial(): Kredensial {
  const sa = env.GDRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (sa) {
    try {
      const j = JSON.parse(sa) as { client_email?: string; private_key?: string };
      if (j.client_email && j.private_key) return { jenis: "service-account", email: j.client_email, kunciPrivat: j.private_key };
    } catch {
      /* jatuh ke galat di bawah */
    }
    throw new GDriveError("GDRIVE_SERVICE_ACCOUNT_JSON tidak valid (perlu client_email dan private_key)");
  }
  const clientId = env.GDRIVE_CLIENT_ID?.trim();
  const clientSecret = env.GDRIVE_CLIENT_SECRET?.trim();
  const refreshToken = env.GDRIVE_REFRESH_TOKEN?.trim();
  if (clientId && clientSecret && refreshToken) return { jenis: "akun", clientId, clientSecret, refreshToken };
  throw new GDriveError("Google Drive belum dikonfigurasi (GDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN atau GDRIVE_SERVICE_ACCOUNT_JSON)");
}

/** Kunci HMAC tautan unduh — diturunkan dari kredensial Drive, jadi tidak perlu env tambahan. */
export function kunciTautan(): string {
  const k = kredensial();
  const bahan = k.jenis === "service-account" ? k.kunciPrivat : `${k.clientSecret}:${k.refreshToken}`;
  return createHash("sha256").update(`e-balai/tautan-berkas/${bahan}`).digest("hex");
}

let token: { nilai: string; habis: number } | null = null;

async function tokenAkses(): Promise<string> {
  if (token && token.habis > Date.now() + 60_000) return token.nilai;
  const k = kredensial();
  let body: URLSearchParams;
  if (k.jenis === "service-account") {
    const kini = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const isi = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: k.email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: kini,
      exp: kini + 3600,
    })}`;
    const tanda = createSign("RSA-SHA256").update(isi).sign(k.kunciPrivat, "base64url");
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${isi}.${tanda}` });
  } else {
    body = new URLSearchParams({ grant_type: "refresh_token", client_id: k.clientId, client_secret: k.clientSecret, refresh_token: k.refreshToken });
  }
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  if (!res.ok) throw new GDriveError(`Masuk ke Google Drive gagal (${res.status})`);
  const d = (await res.json()) as { access_token: string; expires_in: number };
  token = { nilai: d.access_token, habis: Date.now() + d.expires_in * 1000 };
  return token.nilai;
}

async function panggil(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await tokenAkses()}`);
  return fetch(url, { ...init, headers });
}

async function cariSatu(q: string): Promise<string | null> {
  const res = await panggil(`${API}?${SEMUA_DRIVE}&includeItemsFromAllDrives=true&pageSize=1&fields=files(id)&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new GDriveError(`Pencarian berkas di Google Drive gagal (${res.status})`);
  const d = (await res.json()) as { files?: { id: string }[] };
  return d.files?.[0]?.id ?? null;
}

const folderBucket = new Map<string, string>();

async function folderUntuk(bucket: string): Promise<string> {
  const ada = folderBucket.get(bucket);
  if (ada) return ada;
  const induk = env.GDRIVE_FOLDER_ID!.trim();
  let id = await cariSatu(`name = '${kutip(bucket)}' and '${kutip(induk)}' in parents and mimeType = '${MIME_FOLDER}' and trashed = false`);
  if (!id) {
    const res = await panggil(`${API}?${SEMUA_DRIVE}&fields=id`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: bucket, mimeType: MIME_FOLDER, parents: [induk] }),
    });
    if (!res.ok) throw new GDriveError(`Folder ${bucket} gagal dibuat di Google Drive (${res.status})`);
    id = ((await res.json()) as { id: string }).id;
  }
  folderBucket.set(bucket, id);
  return id;
}

/** Id berkas Drive untuk jalur bucket, atau null bila belum ada di Drive (mis. berkas lama di Supabase). */
export async function idBerkasDrive(bucket: string, path: string): Promise<string | null> {
  const folder = await folderUntuk(bucket);
  return cariSatu(`name = '${kutip(namaBerkasDrive(path))}' and '${kutip(folder)}' in parents and trashed = false`);
}

export async function unggahDrive(bucket: string, path: string, isi: Uint8Array, tipe: string): Promise<void> {
  const folder = await folderUntuk(bucket);
  const batas = `ebalai-${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name: namaBerkasDrive(path), parents: [folder], mimeType: tipe });
  const body = new Blob([
    `--${batas}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${batas}\r\ncontent-type: ${tipe}\r\n\r\n`,
    isi as BlobPart,
    `\r\n--${batas}--`,
  ]);
  const res = await panggil(`${API_UNGGAH}?uploadType=multipart&${SEMUA_DRIVE}&fields=id`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${batas}` },
    body,
  });
  if (!res.ok) throw new GDriveError(`Berkas gagal disimpan ke Google Drive (${res.status})`);
}

export async function hapusDrive(id: string): Promise<void> {
  // Gagal menghapus berkas lama tidak menggagalkan permintaan (paling buruk tertinggal di folder privat).
  await panggil(`${API}/${encodeURIComponent(id)}?${SEMUA_DRIVE}`, { method: "DELETE" }).catch(() => undefined);
}

export async function salinDrive(id: string, bucket: string, ke: string): Promise<void> {
  const folder = await folderUntuk(bucket);
  const res = await panggil(`${API}/${encodeURIComponent(id)}/copy?${SEMUA_DRIVE}&fields=id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: namaBerkasDrive(ke), parents: [folder] }),
  });
  if (!res.ok) throw new GDriveError(`Berkas gagal disalin di Google Drive (${res.status})`);
}

/** Isi berkas (respons Drive `alt=media`; badannya dialirkan ke peramban). */
export async function unduhDrive(id: string): Promise<Response> {
  const res = await panggil(`${API}/${encodeURIComponent(id)}?alt=media&${SEMUA_DRIVE}`);
  if (!res.ok) throw new GDriveError(`Berkas gagal dibaca dari Google Drive (${res.status})`, res.status === 404 ? 404 : 503);
  return res;
}
