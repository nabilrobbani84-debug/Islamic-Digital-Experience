import type {
  AdminContentSource,
  AdminDataset,
  AdminOverview,
  AdminSyncStatus,
  AdminUser,
  AsmaulHusnaEntry,
  AudioTrack,
  AuditLogEntry,
  ContentRevision,
  DeviceSession,
  DhikrCategory,
  DhikrItem,
  Dua,
  Hadith,
  JuzInfo,
  Qari,
  QuranSearchResult,
  RevisionEntityType,
  Surah,
  SurahDetail,
  SyncChangeInput,
  SyncPullResult,
  SyncPushResultItem,
  TafsirEntry,
  TranslationEdition,
  User,
  UserRole,
  WithMeta,
} from "@/types/domain";

export interface LoginInput {
  email: string;
  password: string;
  deviceName?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface CreateRevisionInput {
  entityType: RevisionEntityType;
  entityId: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
}

/**
 * Antarmuka tunggal yang dipakai seluruh UI. Implementasi:
 * - http-api.ts : backend NUR (production)
 * - mock-api.ts : adapter in-memory khusus development/e2e
 */
export interface NurApi {
  readonly mode: "http" | "mock";
  onUnauthorized(listener: () => void): () => void;

  auth: {
    login(input: LoginInput): Promise<User>;
    register(input: RegisterInput): Promise<{ email: string }>;
    logout(): Promise<void>;
    me(): Promise<User>;
    verifyEmail(token: string): Promise<void>;
    resendVerification(email: string): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, password: string): Promise<void>;
  };

  users: {
    updateMe(input: { name: string }): Promise<User>;
    changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
    sessions(): Promise<DeviceSession[]>;
    revokeSession(id: string): Promise<void>;
  };

  quran: {
    surahs(): Promise<WithMeta<Surah[]>>;
    surah(number: number, options?: { editionId?: string }): Promise<WithMeta<SurahDetail>>;
    search(query: string): Promise<QuranSearchResult[]>;
    juz(number: number): Promise<JuzInfo>;
    editions(): Promise<TranslationEdition[]>;
    tafsir(surahNumber: number, verseNumber: number): Promise<TafsirEntry[]>;
  };

  audio: {
    qaris(): Promise<Qari[]>;
    surah(surahNumber: number, qariId: string): Promise<AudioTrack>;
  };

  content: {
    dhikr(): Promise<WithMeta<{ categories: DhikrCategory[]; items: DhikrItem[] }>>;
    duas(): Promise<WithMeta<Dua[]>>;
    hadithNawawi(): Promise<WithMeta<Hadith[]>>;
    asmaulHusna(): Promise<WithMeta<AsmaulHusnaEntry[]>>;
  };

  sync: {
    push(changes: SyncChangeInput[]): Promise<SyncPushResultItem[]>;
    pull(cursor: string | null): Promise<SyncPullResult>;
  };

  admin: {
    overview(): Promise<AdminOverview>;
    datasets(): Promise<AdminDataset[]>;
    approveDataset(id: string): Promise<AdminDataset>;
    contentSources(): Promise<AdminContentSource[]>;
    users(): Promise<AdminUser[]>;
    updateUserRole(id: string, role: UserRole): Promise<AdminUser>;
    setUserActive(id: string, isActive: boolean): Promise<AdminUser>;
    auditLogs(): Promise<AuditLogEntry[]>;
    revisions(): Promise<ContentRevision[]>;
    createRevision(input: CreateRevisionInput): Promise<ContentRevision>;
    reviewRevision(id: string, decision: "APPROVE" | "REJECT", note?: string): Promise<ContentRevision>;
    syncStatus(): Promise<AdminSyncStatus>;
  };
}
