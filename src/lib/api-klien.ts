/** Pemanggil API sisi browser. Semua endpoint menjawab `{ ok, data | error }`. */
export type Hasil<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function kirimJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<Hasil<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
    if (json?.ok) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Terjadi kesalahan. Coba lagi.", status: res.status };
  } catch {
    return { ok: false, error: "Tidak bisa terhubung ke server. Periksa koneksi Anda.", status: 0 };
  }
}

export async function ambilJson<T>(url: string): Promise<Hasil<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
    if (json?.ok) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Terjadi kesalahan. Coba lagi.", status: res.status };
  } catch {
    return { ok: false, error: "Tidak bisa terhubung ke server. Periksa koneksi Anda.", status: 0 };
  }
}
