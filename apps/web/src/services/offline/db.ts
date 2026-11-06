import Dexie, { type EntityTable } from "dexie";
import type {
  Bookmark,
  ContentMeta,
  DhikrSessionRecord,
  Qari,
  ReadingHistoryEntry,
  ReadingProgress,
  Surah,
  SurahDetail,
  SyncChangeInput,
  TafsirEntry,
  TranslationEdition,
  ZakatRecord,
} from "@/types/domain";

export type LocalSyncStatus = "PENDING" | "FAILED" | "CONFLICT";

export interface PendingSyncRow extends SyncChangeInput {
  /** Auto-increment lokal untuk urutan pengiriman. */
  seq?: number;
  status: LocalSyncStatus;
  attempts: number;
  lastError?: string | null;
  /** Versi server saat terjadi konflik; dipakai sebagai basis ketika pengguna memilih versi perangkat ini. */
  serverVersion?: number | null;
}

export interface CachedSurahDetail {
  /** `${surahNumber}:${editionId}` */
  key: string;
  surahNumber: number;
  editionId: string;
  detail: SurahDetail;
  meta: ContentMeta;
  cachedAt: string;
}

export interface CachedTafsir {
  key: string;
  entries: TafsirEntry[];
  cachedAt: string;
}

export interface CachedContent {
  key: "dhikr" | "duas" | "hadith-nawawi" | "asmaul-husna";
  data: unknown;
  meta: ContentMeta;
  cachedAt: string;
}

export interface AudioMetadataRow {
  /** `${qariId}:${surahNumber}` */
  key: string;
  qariId: string;
  surahNumber: number;
  url: string;
  sizeBytes: number;
  checksum: string | null;
  verified: boolean;
  downloadedAt: string;
}

export type OfflinePackageStatus = "NOT_DOWNLOADED" | "DOWNLOADING" | "INSTALLED" | "FAILED";

export interface OfflinePackage {
  id: string;
  name: string;
  version: string;
  sizeBytes: number;
  checksum: string;
  required: boolean;
  downloadedAt?: string;
  status: OfflinePackageStatus;
}

export interface LocalPrayerLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  timezone: string;
  updatedAt: string;
  version: number;
}

export type FavoriteContentType = "ASMAUL_HUSNA" | "DAILY_DUA" | "HADITH" | "DHIKR_ITEM";

export interface LocalFavorite {
  /** `${contentType}:${contentId}` */
  id: string;
  contentType: FavoriteContentType;
  contentId: string;
  createdAt: string;
}

export interface AppSettingRow {
  key: string;
  value: unknown;
}

export interface SurahRow extends Surah {
  cachedAt: string;
}

/**
 * Database lokal `nur_local_db`.
 * Data referensi (Quran, konten) dan data personal dipisah per tabel sehingga sinkronisasi
 * data personal tidak pernah menimpa data referensi.
 * TIDAK ADA password, token, atau secret yang disimpan di sini.
 */
export class NurLocalDb extends Dexie {
  quran_surahs!: EntityTable<SurahRow, "number">;
  quran_verses!: EntityTable<CachedSurahDetail, "key">;
  translations!: EntityTable<TranslationEdition, "id">;
  tafsir!: EntityTable<CachedTafsir, "key">;
  bookmarks!: EntityTable<Bookmark, "id">;
  reading_progress!: EntityTable<ReadingProgress, "id">;
  reading_history!: EntityTable<ReadingHistoryEntry, "id">;
  qari!: EntityTable<Qari, "id">;
  audio_metadata!: EntityTable<AudioMetadataRow, "key">;
  offline_packages!: EntityTable<OfflinePackage, "id">;
  dhikr_sessions!: EntityTable<DhikrSessionRecord, "id">;
  zakat_history!: EntityTable<ZakatRecord, "id">;
  prayer_locations!: EntityTable<LocalPrayerLocation, "id">;
  pending_sync!: EntityTable<PendingSyncRow, "seq">;
  app_settings!: EntityTable<AppSettingRow, "key">;
  content_cache!: EntityTable<CachedContent, "key">;
  favorites!: EntityTable<LocalFavorite, "id">;

  constructor() {
    super("nur_local_db");
    this.version(1).stores({
      quran_surahs: "number",
      quran_verses: "key, surahNumber",
      translations: "id",
      tafsir: "key",
      bookmarks: "id, [surahNumber+verseNumber], updatedAt",
      reading_progress: "id, surahNumber, updatedAt",
      reading_history: "id, readAt",
      qari: "id",
      audio_metadata: "key, qariId, surahNumber",
      offline_packages: "id, status",
      dhikr_sessions: "id, startedAt",
      zakat_history: "id, calculatedAt",
      prayer_locations: "id",
      pending_sync: "++seq, status, idempotencyKey",
      app_settings: "key",
      content_cache: "key",
      favorites: "id, contentType",
    });
  }
}

export const db = new NurLocalDb();

/** Tabel data personal yang dihapus saat logout. */
export const PERSONAL_TABLES = [
  "bookmarks",
  "reading_progress",
  "reading_history",
  "dhikr_sessions",
  "zakat_history",
  "prayer_locations",
  "pending_sync",
  "favorites",
] as const;

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.app_settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.app_settings.put({ key, value });
}

export async function clearPersonalData(): Promise<void> {
  await db.transaction("rw", [...PERSONAL_TABLES.map((t) => db.table(t)), db.app_settings], async () => {
    await Promise.all(PERSONAL_TABLES.map((t) => db.table(t).clear()));
    await db.app_settings.bulkDelete(["session_profile", "sync_cursor", "hadith_read"]);
  });
}
