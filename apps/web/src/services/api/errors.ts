export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NOT_SUPPORTED"
  | "INVALID_RESPONSE"
  | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork(): boolean {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT";
  }

  get isRetryable(): boolean {
    return this.isNetwork || this.status >= 500 || this.status === 429;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
};

export function codeForStatus(status: number): ApiErrorCode {
  return STATUS_CODES[status] ?? (status >= 500 ? "SERVER_ERROR" : "INVALID_RESPONSE");
}

/** Pesan yang aman ditampilkan ke pengguna (tanpa detail teknis server). */
export function userMessage(error: unknown): string {
  if (!isApiError(error)) return "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.";
  switch (error.code) {
    case "NETWORK_ERROR":
      return "Tidak dapat terhubung ke server NUR. Periksa koneksi internet Anda.";
    case "TIMEOUT":
      return "Server terlalu lama merespons. Silakan coba lagi.";
    case "UNAUTHORIZED":
      return "Sesi Anda telah berakhir. Silakan masuk kembali.";
    case "FORBIDDEN":
      return "Anda tidak memiliki izin untuk tindakan ini.";
    case "NOT_FOUND":
      return "Data yang diminta tidak ditemukan.";
    case "RATE_LIMITED":
      return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
    case "NOT_SUPPORTED":
      return error.message;
    case "VALIDATION_ERROR":
    case "CONFLICT":
      return error.message || "Data tidak valid.";
    default:
      return "Server sedang mengalami gangguan. Silakan coba beberapa saat lagi.";
  }
}
