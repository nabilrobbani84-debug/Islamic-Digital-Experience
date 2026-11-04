import type { Bookmark, DhikrSessionRecord, ReadingProgress, ZakatRecord } from "@/types/domain";
import { db, type FavoriteContentType } from "./db";
import { enqueueChange } from "./sync-engine";

/**
 * Repositori data personal offline-first.
 * Setiap penulisan: (1) transaksi IndexedDB, (2) masuk antrean sinkronisasi.
 * UI membaca dari IndexedDB (useLiveQuery) sehingga tetap berfungsi tanpa koneksi.
 */

const nowIso = (): string => new Date().toISOString();

export async function toggleBookmark(surahNumber: number, verseNumber: number): Promise<boolean> {
  const existing = await db.bookmarks.where("[surahNumber+verseNumber]").equals([surahNumber, verseNumber]).first();
  if (existing && !existing.deletedAt) {
    const deleted: Bookmark = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
    await db.bookmarks.put(deleted);
    await enqueueChange("BOOKMARK", existing.id, "DELETE", { surahNumber, verseNumber }, existing.version);
    return false;
  }
  const timestamp = nowIso();
  const bookmark: Bookmark = existing
    ? { ...existing, deletedAt: null, updatedAt: timestamp }
    : { id: crypto.randomUUID(), surahNumber, verseNumber, note: null, createdAt: timestamp, updatedAt: timestamp, version: 0 };
  await db.bookmarks.put(bookmark);
  await enqueueChange("BOOKMARK", bookmark.id, "UPSERT", { surahNumber, verseNumber, note: bookmark.note ?? null }, existing ? existing.version : null);
  return true;
}

export async function updateBookmarkNote(id: string, note: string): Promise<void> {
  const existing = await db.bookmarks.get(id);
  if (!existing) return;
  const updated: Bookmark = { ...existing, note: note.trim() || null, updatedAt: nowIso() };
  await db.bookmarks.put(updated);
  await enqueueChange("BOOKMARK", id, "UPSERT", { surahNumber: updated.surahNumber, verseNumber: updated.verseNumber, note: updated.note }, existing.version);
}

/** Progres bacaan: satu baris per pengguna (posisi terakhir), konflik diselesaikan dengan posisi terbaru. */
export async function saveReadingProgress(surahNumber: number, verseNumber: number): Promise<void> {
  const id = "last-read";
  const existing = await db.reading_progress.get(id);
  if (existing && existing.surahNumber === surahNumber && existing.verseNumber === verseNumber) return;
  const progress: ReadingProgress = { id, surahNumber, verseNumber, updatedAt: nowIso(), version: existing?.version ?? 0 };
  await db.transaction("rw", db.reading_progress, db.reading_history, async () => {
    await db.reading_progress.put(progress);
    await db.reading_history.add({ id: crypto.randomUUID(), surahNumber, verseNumber, readAt: progress.updatedAt });
  });
  await enqueueChange("READING_PROGRESS", id, "UPSERT", { surahNumber, verseNumber, updatedAt: progress.updatedAt }, existing?.version ?? null);
}

export async function saveDhikrSession(session: Omit<DhikrSessionRecord, "updatedAt" | "version">): Promise<void> {
  const existing = await db.dhikr_sessions.get(session.id);
  const record: DhikrSessionRecord = { ...session, updatedAt: nowIso(), version: existing?.version ?? 0 };
  await db.dhikr_sessions.put(record);
  await enqueueChange("DHIKR_SESSION", record.id, "UPSERT", { ...session }, existing?.version ?? null);
}

export async function saveZakatRecord(record: Omit<ZakatRecord, "id" | "updatedAt" | "version">): Promise<ZakatRecord> {
  const full: ZakatRecord = { ...record, id: crypto.randomUUID(), updatedAt: nowIso(), version: 0 };
  await db.zakat_history.put(full);
  await enqueueChange("ZAKAT_CALCULATION", full.id, "UPSERT", { ...record }, null);
  return full;
}

export async function deleteZakatRecord(id: string): Promise<void> {
  const existing = await db.zakat_history.get(id);
  if (!existing) return;
  await db.zakat_history.delete(id);
  await enqueueChange("ZAKAT_CALCULATION", id, "DELETE", {}, existing.version);
}

/** Favorit konten (Asmaul Husna, doa, hadis, dzikir). Server memvalidasi keberadaan konten. */
export async function toggleFavorite(contentType: FavoriteContentType, contentId: string): Promise<boolean> {
  const id = `${contentType}:${contentId}`;
  const existing = await db.favorites.get(id);
  if (existing) {
    await db.favorites.delete(id);
    await enqueueChange("USER_FAVORITE", id, "DELETE", { contentType, contentId }, null);
    return false;
  }
  await db.favorites.put({ id, contentType, contentId, createdAt: nowIso() });
  await enqueueChange("USER_FAVORITE", id, "UPSERT", { contentType, contentId }, null);
  return true;
}
