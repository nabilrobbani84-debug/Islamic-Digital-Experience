/**
 * Tipe kontrak data antara frontend dan backend NUR (/api/v1).
 * Lihat docs/FRONTEND_API_CONTRACT.md untuk daftar endpoint.
 */

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface DeviceSession {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  current: boolean;
}

export interface ContentMeta {
  datasetVersion?: string;
  source?: string;
  license?: string;
}

export interface WithMeta<T> {
  data: T;
  meta: ContentMeta;
}

// ---------------- Quran ----------------

export type RevelationType = "MAKKIYAH" | "MADANIYAH";

export interface Surah {
  id: number;
  number: number;
  nameArabic: string;
  nameLatin: string;
  meaning?: string | null;
  revelationType?: RevelationType | null;
  totalVerses: number;
}

export interface Verse {
  id: string;
  number: number;
  globalNumber?: number | null;
  textUthmani: string;
  translation?: string | null;
  pageNumber?: number | null;
  juzNumber?: number | null;
}

export interface SurahDetail extends Surah {
  verses: Verse[];
  editionId?: string | null;
  editionName?: string | null;
  /** Teks basmalah yang mengawali ayat 1 pada sumber tertentu; ditampilkan terpisah sebagai kepala surah. */
  bismillahPrefix?: string | null;
}

export interface TranslationEdition {
  id: string;
  name: string;
  language: string;
}

export interface TafsirEntry {
  sourceName: string;
  author?: string | null;
  content: string;
  reference?: string | null;
}

export interface QuranSearchResult {
  surahNumber: number;
  surahName: string;
  verseNumber: number;
  textUthmani: string;
  translation?: string | null;
}

export interface JuzInfo {
  number: number;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
}

export interface Qari {
  id: string;
  name: string;
  country?: string | null;
}

export interface AudioSegment {
  verseNumber: number;
  startMs: number;
  endMs: number;
}

export interface AudioTrack {
  qariId: string;
  surahNumber: number;
  url: string;
  durationMs?: number | null;
  /** SHA-256 hex untuk verifikasi integritas unduhan offline. */
  checksum?: string | null;
  /** Segmen per ayat; null jika provider tidak menyediakan sinkronisasi ayat. */
  segments?: AudioSegment[] | null;
}

// ---------------- Personal (disinkronkan) ----------------

export interface Bookmark {
  id: string;
  surahNumber: number;
  verseNumber: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt?: string | null;
}

export interface ReadingProgress {
  id: string;
  surahNumber: number;
  verseNumber: number;
  updatedAt: string;
  version: number;
}

export interface ReadingHistoryEntry {
  id: string;
  surahNumber: number;
  verseNumber: number;
  readAt: string;
}

export interface DhikrSessionRecord {
  id: string;
  dhikrItemId: string | null;
  label: string;
  count: number;
  targetCount: number;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
  version: number;
}

export type ZakatTypeCode = "INCOME" | "GOLD" | "SILVER" | "SAVINGS" | "TRADE" | "MAAL" | "FITRAH";

export interface ZakatRecord {
  id: string;
  type: ZakatTypeCode;
  totalAssets: string;
  deductibleDebt: string;
  netAssets: string;
  nisabValue: string;
  payableAmount: string;
  eligible: boolean;
  currency: "IDR";
  ruleVersion: string;
  calculatedAt: string;
  updatedAt: string;
  version: number;
}

export type SyncEntityType =
  | "BOOKMARK"
  | "READING_PROGRESS"
  | "READING_HISTORY"
  | "DHIKR_SESSION"
  | "ZAKAT_CALCULATION"
  | "PRAYER_LOCATION"
  | "USER_SETTING"
  | "USER_FAVORITE";

export interface SyncChangeInput {
  entityType: SyncEntityType;
  entityId: string;
  operation: "UPSERT" | "DELETE";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  baseVersion: number | null;
  clientCreatedAt: string;
}

export interface SyncPushResultItem {
  idempotencyKey: string;
  status: "APPLIED" | "CONFLICT" | "REJECTED";
  resultVersion?: number | null;
  /** Versi server terbaru ketika CONFLICT, agar klien bisa menyelesaikan konflik. */
  serverRecord?: Record<string, unknown> | null;
  reason?: string | null;
}

export interface SyncPullChange {
  entityType: SyncEntityType;
  entityId: string;
  operation: "UPSERT" | "DELETE";
  payload: Record<string, unknown>;
  version: number;
}

export interface SyncPullResult {
  cursor: string;
  changes: SyncPullChange[];
  hasMore: boolean;
}

// ---------------- Konten ibadah ----------------

export interface DhikrCategory {
  id: number;
  name: string;
  description?: string | null;
}

export interface DhikrItem {
  id: string;
  categoryId: number;
  arabicText: string;
  transliteration: string;
  translation: string;
  recommendedCount: number;
  source?: string | null;
}

export interface Dua {
  id: string;
  title: string;
  arabicText: string;
  transliteration: string;
  translation: string;
  source?: string | null;
  categories: string[];
}

export interface Hadith {
  number: number;
  title?: string | null;
  arabicText: string;
  translation: string;
  narrator?: string | null;
  reference?: string | null;
  explanation?: string | null;
  lessons?: string | null;
}

export interface AsmaulHusnaEntry {
  number: number;
  arabicName: string;
  transliteration: string;
  meaning: string;
  explanation?: string | null;
  source?: string | null;
  audioUrl?: string | null;
}

// ---------------- Admin ----------------

export type ContentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface AdminOverview {
  users: number;
  activeSessions: number;
  publishedDatasets: number;
  pendingRevisions: number;
  pendingSyncConflicts: number;
}

export interface AdminDataset {
  id: string;
  datasetName: string;
  version: string;
  checksum: string;
  recordCount: number | null;
  status: ContentStatus;
  source: string | null;
  importedAt: string;
  approvedAt: string | null;
}

export interface AdminContentSource {
  id: string;
  name: string;
  publisher: string | null;
  license: string | null;
  attribution: string | null;
  licenseVerifiedAt: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export type RevisionEntityType =
  | "VERSE_TRANSLATION"
  | "TAFSIR_CONTENT"
  | "DAILY_DUA"
  | "HADITH"
  | "ASMAUL_HUSNA"
  | "DHIKR_ITEM"
  | "AUDIO_ASSET"
  | "CONTENT_SOURCE";

export interface ContentRevision {
  id: string;
  entityType: RevisionEntityType;
  entityId: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  status: ContentStatus;
  payload: Record<string, unknown>;
  authorName: string;
  reviewerName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AdminSyncStatus {
  changesLast24h: number;
  conflictsLast24h: number;
  rejectedLast24h: number;
  lastChangeAt: string | null;
}
