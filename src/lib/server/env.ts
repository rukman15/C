import "server-only";
/** Pengganti `$env/dynamic/private` aplikasi lama: variabel lingkungan dibaca saat dipakai. */
export const env = process.env as Record<string, string | undefined>;
