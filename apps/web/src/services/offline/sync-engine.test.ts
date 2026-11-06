import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncChangeInput, SyncPushResultItem } from "@/types/domain";

const push = vi.fn<(changes: SyncChangeInput[]) => Promise<SyncPushResultItem[]>>(async (changes) =>
  changes.map((c) => ({ idempotencyKey: c.idempotencyKey, status: "APPLIED", resultVersion: 1 })),
);
const pull = vi.fn(async () => ({ cursor: "1", changes: [], hasMore: false }));

vi.mock("@/services/api", async () => {
  const errors = await vi.importActual<typeof import("@/services/api/errors")>("@/services/api/errors");
  return { api: { sync: { push, pull } }, isApiError: errors.isApiError };
});

const { db } = await import("./db");
const { flushSync } = await import("./sync-engine");
const { toggleBookmark, saveReadingProgress } = await import("./personal");

describe("offline-first personal data + sync engine", () => {
  beforeEach(async () => {
    push.mockClear();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("bookmark tersimpan lokal, dikirim ke server, lalu antrean kosong", async () => {
    await toggleBookmark(2, 255);
    await flushSync();
    const saved = await db.bookmarks.where("[surahNumber+verseNumber]").equals([2, 255]).first();
    expect(saved?.deletedAt ?? null).toBeNull();
    expect(saved?.version).toBe(1);
    expect(push).toHaveBeenCalled();
    expect(await db.pending_sync.count()).toBe(0);
  });

  it("perubahan ditahan saat offline dan tidak hilang", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    await saveReadingProgress(36, 12);
    await flushSync();
    expect(push).not.toHaveBeenCalled();
    expect(await db.pending_sync.count()).toBe(1);
    expect((await db.reading_progress.get("last-read"))?.verseNumber).toBe(12);
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    await flushSync();
    expect(await db.pending_sync.count()).toBe(0);
  });

  it("konflik versi disimpan untuk ditinjau, bukan ditimpa diam-diam", async () => {
    push.mockImplementationOnce(async (changes) => changes.map((c) => ({ idempotencyKey: c.idempotencyKey, status: "CONFLICT", resultVersion: 3 })));
    await toggleBookmark(1, 1);
    await flushSync();
    const rows = await db.pending_sync.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("CONFLICT");
  });
});
