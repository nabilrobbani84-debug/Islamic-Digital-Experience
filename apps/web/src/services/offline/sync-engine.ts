import { create } from "zustand";
import { api, isApiError } from "@/services/api";
import type {
  Bookmark,
  DhikrSessionRecord,
  ReadingHistoryEntry,
  ReadingProgress,
  SyncChangeInput,
  SyncEntityType,
  SyncPullChange,
  ZakatRecord,
} from "@/types/domain";
import { db, getSetting, setSetting, type FavoriteContentType, type PendingSyncRow } from "./db";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

export type SyncState = "idle" | "syncing" | "offline" | "error";

type Listener = (state: SyncState) => void;

/** Status sinkronisasi untuk UI (indikator online/offline/syncing/success/failed/conflict). */
export const useSyncStatus = create<{ state: SyncState; lastSyncAt: string | null }>()(() => ({ state: "idle", lastSyncAt: null }));

const listeners = new Set<Listener>();
let state: SyncState = "idle";
let flushing: Promise<void> | null = null;
let started = false;

function setState(next: SyncState, succeeded = false): void {
  state = next;
  useSyncStatus.setState(succeeded ? { state: next, lastSyncAt: new Date().toISOString() } : { state: next });
  listeners.forEach((l) => l(next));
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mencatat perubahan lokal ke antrean `pending_sync`. */
export async function enqueueChange(
  entityType: SyncEntityType,
  entityId: string,
  operation: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  baseVersion: number | null,
): Promise<void> {
  const change: PendingSyncRow = {
    entityType,
    entityId,
    operation,
    payload,
    baseVersion,
    idempotencyKey: crypto.randomUUID(),
    clientCreatedAt: new Date().toISOString(),
    status: "PENDING",
    attempts: 0,
    lastError: null,
  };
  await db.pending_sync.add(change);
  void flushSync();
}

function toInput(row: PendingSyncRow): SyncChangeInput {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    operation: row.operation,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    baseVersion: row.baseVersion,
    clientCreatedAt: row.clientCreatedAt,
  };
}

const VERSIONED_TABLES: Partial<Record<SyncEntityType, string>> = {
  BOOKMARK: "bookmarks",
  READING_PROGRESS: "reading_progress",
  DHIKR_SESSION: "dhikr_sessions",
  ZAKAT_CALCULATION: "zakat_history",
  PRAYER_LOCATION: "prayer_locations",
};

async function updateLocalVersion(entityType: SyncEntityType, entityId: string, version: number): Promise<void> {
  const name = VERSIONED_TABLES[entityType];
  if (!name) return;
  await db.table(name).update(entityId, { version });
}

/** Mengirim antrean ke backend. Aman dipanggil berkali-kali (idempotency key per perubahan). */
export function flushSync(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      return;
    }
    setState("syncing");
    try {
      for (;;) {
        const batch = await db.pending_sync
          .where("status")
          .anyOf("PENDING", "FAILED")
          .filter((r) => r.attempts < MAX_ATTEMPTS)
          .limit(BATCH_SIZE)
          .toArray();
        if (batch.length === 0) break;
        const results = await api.sync.push(batch.map(toInput));
        const byKey = new Map(results.map((r) => [r.idempotencyKey, r]));
        await db.transaction("rw", [db.pending_sync, db.bookmarks, db.reading_progress, db.dhikr_sessions, db.zakat_history, db.prayer_locations], async () => {
          for (const row of batch) {
            const result = byKey.get(row.idempotencyKey);
            if (!result || row.seq === undefined) continue;
            if (result.status === "APPLIED") {
              await db.pending_sync.delete(row.seq);
              if (result.resultVersion) await updateLocalVersion(row.entityType, row.entityId, result.resultVersion);
            } else if (result.status === "CONFLICT") {
              // Data catatan tidak boleh ditimpa diam-diam: simpan sebagai konflik untuk ditinjau pengguna.
              await db.pending_sync.update(row.seq, { status: "CONFLICT", lastError: result.reason ?? "CONFLICT", serverVersion: result.resultVersion ?? null });
            } else {
              await db.pending_sync.update(row.seq, { status: "FAILED", attempts: MAX_ATTEMPTS, lastError: result.reason ?? "REJECTED" });
            }
          }
        });
        if (batch.length < BATCH_SIZE) break;
      }
      await pullChanges();
      setState("idle", true);
    } catch (error) {
      if (isApiError(error) && error.isNetwork) {
        setState("offline");
      } else {
        setState("error");
        const pending = await db.pending_sync.where("status").anyOf("PENDING", "FAILED").toArray();
        await Promise.all(
          pending
            .filter((r): r is PendingSyncRow & { seq: number } => r.seq !== undefined)
            .map((r) => db.pending_sync.update(r.seq, { status: "FAILED", attempts: r.attempts + 1, lastError: String(error) })),
        );
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Menerapkan perubahan dari server ke IndexedDB tanpa menimpa perubahan lokal yang belum terkirim. */
export async function pullChanges(): Promise<number> {
  let cursor = (await getSetting<string>("sync_cursor")) ?? null;
  let applied = 0;
  for (let page = 0; page < 20; page++) {
    const result = await api.sync.pull(cursor);
    const pendingIds = new Set((await db.pending_sync.toArray()).map((r) => `${r.entityType}:${r.entityId}`));
    await db.transaction("rw", [db.bookmarks, db.reading_progress, db.reading_history, db.dhikr_sessions, db.zakat_history, db.prayer_locations, db.favorites, db.app_settings], async () => {
      for (const change of result.changes) {
        if (pendingIds.has(`${change.entityType}:${change.entityId}`)) continue;
        await applyRemoteChange(change);
        applied++;
      }
      await setSetting("sync_cursor", result.cursor);
    });
    cursor = result.cursor;
    if (!result.hasMore) break;
  }
  return applied;
}

async function applyRemoteChange(change: SyncPullChange): Promise<void> {
  if (change.entityType === "USER_FAVORITE") {
    const { contentType, contentId } = change.payload as { contentType?: FavoriteContentType; contentId?: string };
    if (!contentType || !contentId) return;
    if (change.operation === "DELETE") await db.favorites.delete(change.entityId);
    else await db.favorites.put({ id: change.entityId, contentType, contentId, createdAt: String(change.payload.createdAt ?? new Date().toISOString()) });
    return;
  }
  const payload = { ...change.payload, id: change.entityId, version: change.version };
  switch (change.entityType) {
    case "BOOKMARK":
      if (change.operation === "DELETE") await db.bookmarks.delete(change.entityId);
      else await db.bookmarks.put(payload as unknown as Bookmark);
      break;
    case "READING_PROGRESS":
      if (change.operation === "DELETE") await db.reading_progress.delete(change.entityId);
      else await db.reading_progress.put(payload as unknown as ReadingProgress);
      break;
    case "READING_HISTORY":
      if (change.operation !== "DELETE") await db.reading_history.put(payload as unknown as ReadingHistoryEntry);
      break;
    case "DHIKR_SESSION":
      if (change.operation === "DELETE") await db.dhikr_sessions.delete(change.entityId);
      else await db.dhikr_sessions.put(payload as unknown as DhikrSessionRecord);
      break;
    case "ZAKAT_CALCULATION":
      if (change.operation === "DELETE") await db.zakat_history.delete(change.entityId);
      else await db.zakat_history.put(payload as unknown as ZakatRecord);
      break;
    default:
      break;
  }
}

/** Mulai sinkronisasi otomatis: saat kembali online, saat tab aktif, dan berkala. */
export function startSyncEngine(): () => void {
  if (started) return () => undefined;
  started = true;
  const onOnline = (): void => void flushSync();
  const onOffline = (): void => setState("offline");
  const onVisible = (): void => {
    if (document.visibilityState === "visible") void flushSync();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(() => void flushSync(), 60_000);
  void flushSync();
  return () => {
    started = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}

/** Mengembalikan konflik ke antrean dengan versi server sebagai basis (pengguna memilih "pakai versi saya"). */
export async function retryConflict(seq: number, serverVersion: number): Promise<void> {
  await db.pending_sync.update(seq, { status: "PENDING", baseVersion: serverVersion, attempts: 0, lastError: null });
  void flushSync();
}

export async function discardChange(seq: number): Promise<void> {
  await db.pending_sync.delete(seq);
}
