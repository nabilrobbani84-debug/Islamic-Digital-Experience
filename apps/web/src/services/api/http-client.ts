import { ApiError, codeForStatus } from "./errors";
import type { ContentMeta } from "@/types/domain";

type Envelope<T> =
  | { success: true; data: T; meta?: ContentMeta & Record<string, unknown> }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Jangan coba refresh sesi saat 401 (dipakai untuk endpoint auth itu sendiri). */
  skipRefresh?: boolean;
  timeoutMs?: number;
}

export interface HttpResult<T> {
  data: T;
  meta: ContentMeta;
}

const CSRF_COOKIE = "nur_csrf";
const CSRF_HEADER = "X-CSRF-Token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<HttpResult<T>>;
  onUnauthorized(listener: () => void): () => void;
}

/**
 * Klien fetch untuk backend NUR.
 * - Autentikasi memakai cookie HttpOnly (credentials: "include"); token tidak pernah disentuh JS.
 * - CSRF double-submit: nilai cookie `nur_csrf` dikirim ulang lewat header untuk request yang mengubah data.
 * - 401 memicu satu kali POST /auth/refresh (refresh token rotation di server), lalu request diulang.
 */
export function createHttpClient(baseUrl: string): HttpClient {
  const listeners = new Set<() => void>();
  let refreshing: Promise<boolean> | null = null;

  const buildUrl = (path: string, query?: RequestOptions["query"]): string => {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  };

  async function rawRequest<T>(path: string, options: RequestOptions): Promise<HttpResult<T>> {
    const method = options.method ?? "GET";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), options.timeoutMs ?? 15_000);
    const onAbort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers[CSRF_HEADER] = csrf;
    }

    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const timedOut = controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError";
      throw new ApiError(0, timedOut ? "TIMEOUT" : "NETWORK_ERROR", timedOut ? "Request timeout" : "Network error");
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }

    if (response.status === 204) return { data: undefined as T, meta: {} };

    let envelope: Envelope<T> | null = null;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      envelope = null;
    }

    if (!response.ok || !envelope || envelope.success === false) {
      const err = envelope && envelope.success === false ? envelope.error : null;
      throw new ApiError(response.status, err?.code ?? codeForStatus(response.status), err?.message ?? response.statusText, err?.details);
    }
    if (typeof envelope !== "object" || !("data" in envelope)) {
      throw new ApiError(response.status, "INVALID_RESPONSE", "Format respons tidak sesuai kontrak API");
    }
    return { data: envelope.data, meta: envelope.meta ?? {} };
  }

  async function refreshSession(): Promise<boolean> {
    refreshing ??= rawRequest<unknown>("/auth/refresh", { method: "POST", skipRefresh: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      });
    return refreshing;
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<HttpResult<T>> {
      try {
        return await rawRequest<T>(path, options);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && !options.skipRefresh) {
          if (await refreshSession()) return rawRequest<T>(path, options);
          listeners.forEach((l) => l());
        }
        throw error;
      }
    },
    onUnauthorized(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
