/**
 * Error domain yang membawa status HTTP-nya sendiri. Repository melempar error
 * yang tepat (`NotFoundError`, `ConflictError`, dst.) dan `failFromError()` di
 * `server/http.ts` memetakannya ke status HTTP.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

/** Data yang direferensikan tidak ada (mis. id pegawai/jadwal/approval salah). */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/** Aksi bentrok dengan state saat ini (mis. approval sudah diproses, id duplikat). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

/** Input tidak valid secara bisnis (lolos schema Zod tapi melanggar aturan domain). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = "ValidationError";
  }
}

/**
 * Kode galat Prisma ("P2003", "P2025", …) kalau `error` berasal dari Prisma.
 * Dipakai untuk menerjemahkan balapan langka (baris dihapus/ditambah orang lain
 * di antara pengecekan dan penulisan) menjadi 404/409, bukan 500.
 */
export function kodePrisma(error: unknown): string | undefined {
  const kode = (error as { code?: unknown } | null)?.code;
  return typeof kode === "string" && /^P\d{4}$/.test(kode) ? kode : undefined;
}

/** Belum login. */
export class UnauthorizedError extends AppError {
  constructor(message = "Belum login. Masuk dengan NIP dan kata sandi.") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/** Sudah login, tapi perannya tidak berwenang untuk aksi ini. */
export class ForbiddenError extends AppError {
  constructor(message = "Peran ini tidak berwenang melakukan aksi tersebut.") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}
