import type { NurApi } from "./contract";
import { createHttpClient } from "./http-client";
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
  Surah,
  SurahDetail,
  SyncPullResult,
  SyncPushResultItem,
  TafsirEntry,
  TranslationEdition,
  User,
} from "@/types/domain";

/**
 * Adapter backend NUR. Seluruh konten (termasuk data dari provider Quran pihak ketiga, bila
 * dipakai) diambil oleh backend; browser hanya berbicara dengan backend NUR.
 */
export function createHttpApi(baseUrl: string): NurApi {
  const http = createHttpClient(baseUrl);
  const get = async <T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> =>
    (await http.request<T>(path, { query })).data;
  const withMeta = async <T>(path: string, query?: Record<string, string | number | undefined>) => {
    const { data, meta } = await http.request<T>(path, { query });
    return { data, meta };
  };
  const send = async <T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, skipRefresh = false): Promise<T> =>
    (await http.request<T>(path, { method, body, skipRefresh })).data;

  return {
    mode: "http",
    onUnauthorized: http.onUnauthorized,

    auth: {
      login: (input) => send<User>("POST", "/auth/login", input, true),
      register: (input) => send<{ email: string }>("POST", "/auth/register", input, true),
      logout: () => send<void>("POST", "/auth/logout", undefined, true),
      me: () => get<User>("/users/me"),
      verifyEmail: (token) => send<void>("POST", "/auth/verify-email", { token }, true),
      resendVerification: (email) => send<void>("POST", "/auth/verify-email/resend", { email }, true),
      forgotPassword: (email) => send<void>("POST", "/auth/forgot-password", { email }, true),
      resetPassword: (token, password) => send<void>("POST", "/auth/reset-password", { token, password }, true),
    },

    users: {
      updateMe: (input) => send<User>("PATCH", "/users/me", input),
      changePassword: (input) => send<void>("POST", "/users/me/password", input),
      sessions: () => get<DeviceSession[]>("/users/me/sessions"),
      revokeSession: (id) => send<void>("DELETE", `/users/me/sessions/${encodeURIComponent(id)}`),
    },

    quran: {
      surahs: () => withMeta<Surah[]>("/quran/surahs"),
      surah: (number, options) => withMeta<SurahDetail>(`/quran/surahs/${number}`, { editionId: options?.editionId }),
      search: (query) => get<QuranSearchResult[]>("/quran/search", { q: query }),
      juz: (number) => get<JuzInfo>(`/quran/juz/${number}`),
      editions: () => get<TranslationEdition[]>("/quran/editions"),
      tafsir: (surahNumber, verseNumber) => get<TafsirEntry[]>(`/tafsir/verses/${surahNumber}:${verseNumber}`),
    },

    audio: {
      qaris: () => get<Qari[]>("/audio/qaris"),
      surah: (surahNumber, qariId) => get<AudioTrack>(`/audio/surah/${surahNumber}`, { qariId }),
    },

    content: {
      dhikr: () => withMeta<{ categories: DhikrCategory[]; items: DhikrItem[] }>("/dhikr"),
      duas: () => withMeta<Dua[]>("/duas"),
      hadithNawawi: () => withMeta<Hadith[]>("/hadith/nawawi"),
      asmaulHusna: () => withMeta<AsmaulHusnaEntry[]>("/asmaul-husna"),
    },

    sync: {
      push: (changes) => send<SyncPushResultItem[]>("POST", "/sync/push", { changes }),
      pull: (cursor) => get<SyncPullResult>("/sync/pull", { cursor: cursor ?? undefined }),
    },

    admin: {
      overview: () => get<AdminOverview>("/admin/overview"),
      datasets: () => get<AdminDataset[]>("/admin/datasets"),
      approveDataset: (id) => send<AdminDataset>("POST", `/admin/datasets/${encodeURIComponent(id)}/approve`),
      contentSources: () => get<AdminContentSource[]>("/admin/content-sources"),
      users: () => get<AdminUser[]>("/admin/users"),
      updateUserRole: (id, role) => send<AdminUser>("PATCH", `/admin/users/${encodeURIComponent(id)}`, { role }),
      setUserActive: (id, isActive) => send<AdminUser>("PATCH", `/admin/users/${encodeURIComponent(id)}`, { isActive }),
      auditLogs: () => get<AuditLogEntry[]>("/admin/audit-logs"),
      revisions: () => get<ContentRevision[]>("/admin/revisions"),
      createRevision: (input) => send<ContentRevision>("POST", "/admin/revisions", input),
      reviewRevision: (id, decision, note) =>
        send<ContentRevision>("POST", `/admin/revisions/${encodeURIComponent(id)}/review`, { decision, note }),
      syncStatus: () => get<AdminSyncStatus>("/admin/sync-status"),
    },
  };
}
