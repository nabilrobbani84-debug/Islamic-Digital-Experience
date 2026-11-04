import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "./http-client";
import { ApiError } from "./errors";

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http client", () => {
  it("membuka envelope sukses dan meta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { success: true, data: { id: 1 }, meta: { version: "1.0.0" } })));
    const client = createHttpClient("/api/v1");
    const result = await client.request<{ id: number }>("/quran/surahs/1");
    expect(result.data.id).toBe(1);
    expect(fetch).toHaveBeenCalledWith("/api/v1/quran/surahs/1", expect.objectContaining({ credentials: "include" }));
  });

  it("memetakan envelope error ke ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request data" } })));
    const client = createHttpClient("/api/v1");
    await expect(client.request("/x", { method: "POST", body: {} })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("kegagalan jaringan menjadi NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const client = createHttpClient("/api/v1");
    const error = await client.request("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetwork).toBe(true);
  });

  it("401 memicu satu kali refresh sesi lalu mengulang request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { success: false, error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockResolvedValueOnce(json(200, { success: true, data: null }))
      .mockResolvedValueOnce(json(200, { success: true, data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("/api/v1");
    const result = await client.request<{ ok: boolean }>("/users/me");
    expect(result.data.ok).toBe(true);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/refresh");
  });

  it("refresh gagal memberi tahu listener unauthorized", async () => {
    const fetchMock = vi.fn(async () => json(401, { success: false, error: { code: "UNAUTHORIZED", message: "expired" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("/api/v1");
    const listener = vi.fn();
    client.onUnauthorized(listener);
    await expect(client.request("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("mengirim header CSRF dari cookie untuk request yang mengubah data", async () => {
    document.cookie = "nur_csrf=token123";
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(200, { success: true, data: null }));
    vi.stubGlobal("fetch", fetchMock);
    await createHttpClient("/api/v1").request("/bookmarks", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("token123");
  });
});
