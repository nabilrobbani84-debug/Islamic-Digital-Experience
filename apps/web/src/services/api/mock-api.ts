/**
 * ADAPTER MOCK — KHUSUS DEVELOPMENT DAN E2E.
 *
 * Tidak dipakai di build production (lihat lib/env.ts). Adapter ini TIDAK berisi teks
 * Al-Qur'an, hadis, doa, dzikir, atau Asmaul Husna. Semua konten keagamaan diganti
 * placeholder berlabel jelas agar struktur UI bisa diuji tanpa memalsukan konten.
 */
import type { CreateRevisionInput, NurApi } from "./contract";
import { ApiError } from "./errors";
import type {
  AdminUser,
  AuditLogEntry,
  ContentRevision,
  Surah,
  SurahDetail,
  SyncPullChange,
  SyncPushResultItem,
  User,
  UserRole,
} from "@/types/domain";

const MOCK_META = { source: "MOCK — data contoh development, bukan konten keagamaan", datasetVersion: "mock-0" };
const SESSION_KEY = "nur-mock-session";

interface MockAccount {
  user: User;
  password: string;
  isActive: boolean;
}

interface ServerRecord {
  entityType: SyncPullChange["entityType"];
  entityId: string;
  payload: Record<string, unknown>;
  version: number;
  deleted: boolean;
  seq: number;
}

const delay = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

function placeholderSurah(number: number, totalVerses: number): Surah {
  return {
    id: number,
    number,
    nameArabic: "[nama Arab]",
    nameLatin: `Contoh Surah ${number}`,
    meaning: "Placeholder struktur data — bukan data Al-Qur'an",
    revelationType: number % 2 === 0 ? "MADANIYAH" : "MAKKIYAH",
    totalVerses,
  };
}

const SURAHS: Surah[] = [placeholderSurah(1, 5), placeholderSurah(2, 8)];

function surahDetail(number: number): SurahDetail {
  const surah = SURAHS.find((s) => s.number === number);
  if (!surah) throw new ApiError(404, "NOT_FOUND", "Surah tidak ditemukan");
  return {
    ...surah,
    editionId: "mock-edition",
    editionName: "Edisi contoh (mock)",
    verses: Array.from({ length: surah.totalVerses }, (_, i) => ({
      id: `${number}:${i + 1}`,
      number: i + 1,
      globalNumber: null,
      textUthmani: `[Teks Arab ayat ${i + 1} dari dataset tervalidasi]`,
      translation: `[Terjemahan ayat ${i + 1} dari dataset tervalidasi]`,
      pageNumber: null,
      juzNumber: 1,
    })),
  };
}

function now(): string {
  return new Date().toISOString();
}

export function createMockApi(): NurApi {
  const listeners = new Set<() => void>();
  const accounts = new Map<string, MockAccount>();
  const records = new Map<string, ServerRecord>();
  const appliedKeys = new Map<string, SyncPushResultItem>();
  const audit: AuditLogEntry[] = [];
  const revisions: ContentRevision[] = [];
  let seq = 0;

  const seed = (name: string, email: string, password: string, role: UserRole): void => {
    accounts.set(email, {
      password,
      isActive: true,
      user: { id: crypto.randomUUID(), name, email, role, emailVerified: true, avatarUrl: null, createdAt: now() },
    });
  };
  seed("Pengguna Demo", "demo@nur.local", "demo12345", "USER");
  seed("Admin Demo", "admin@nur.local", "admin12345", "SUPER_ADMIN");

  const storage = typeof sessionStorage !== "undefined" ? sessionStorage : null;
  const currentAccount = (): MockAccount => {
    const email = storage?.getItem(SESSION_KEY);
    const account = email ? accounts.get(email) : undefined;
    if (!account || !account.isActive) throw new ApiError(401, "UNAUTHORIZED", "Belum masuk");
    return account;
  };
  const requireAdmin = (): MockAccount => {
    const account = currentAccount();
    if (account.user.role === "USER") throw new ApiError(403, "FORBIDDEN", "Akses admin diperlukan");
    return account;
  };
  const log = (action: string, entityType: string, entityId: string | null): void => {
    const actor = currentAccount();
    audit.unshift({ id: crypto.randomUUID(), actorName: actor.user.name, action, entityType, entityId, createdAt: now() });
  };
  const toAdminUser = (a: MockAccount): AdminUser => ({
    id: a.user.id,
    name: a.user.name,
    email: a.user.email,
    role: a.user.role,
    isActive: a.isActive,
    emailVerified: a.user.emailVerified,
    createdAt: a.user.createdAt,
  });
  const findAccountById = (id: string): MockAccount => {
    const account = [...accounts.values()].find((a) => a.user.id === id);
    if (!account) throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan");
    return account;
  };

  return {
    mode: "mock",
    onUnauthorized(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    auth: {
      async login({ email, password }) {
        await delay();
        const account = accounts.get(email.trim().toLowerCase());
        if (!account || account.password !== password) {
          throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah");
        }
        if (!account.isActive) throw new ApiError(403, "ACCOUNT_DISABLED", "Akun dinonaktifkan");
        storage?.setItem(SESSION_KEY, account.user.email);
        return account.user;
      },
      async register({ name, email, password }) {
        await delay();
        const key = email.trim().toLowerCase();
        if (accounts.has(key)) throw new ApiError(409, "CONFLICT", "Email sudah terdaftar");
        accounts.set(key, {
          password,
          isActive: true,
          user: { id: crypto.randomUUID(), name, email: key, role: "USER", emailVerified: false, avatarUrl: null, createdAt: now() },
        });
        return { email: key };
      },
      async logout() {
        await delay(60);
        storage?.removeItem(SESSION_KEY);
      },
      async me() {
        await delay(80);
        return currentAccount().user;
      },
      async verifyEmail(token) {
        await delay();
        if (!token || token.length < 6) throw new ApiError(400, "VALIDATION_ERROR", "Token verifikasi tidak valid atau kedaluwarsa");
        for (const a of accounts.values()) a.user = { ...a.user, emailVerified: true };
      },
      async resendVerification() {
        await delay();
      },
      async forgotPassword() {
        await delay();
      },
      async resetPassword(token, password) {
        await delay();
        if (!token || token.length < 6) throw new ApiError(400, "VALIDATION_ERROR", "Token reset tidak valid atau kedaluwarsa");
        if (password.length < 8) throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi terlalu pendek");
      },
    },

    users: {
      async updateMe({ name }) {
        await delay();
        const account = currentAccount();
        account.user = { ...account.user, name };
        return account.user;
      },
      async changePassword({ currentPassword, newPassword }) {
        await delay();
        const account = currentAccount();
        if (account.password !== currentPassword) throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi saat ini salah");
        account.password = newPassword;
      },
      async sessions() {
        await delay();
        currentAccount();
        return [
          { id: "current", deviceName: "Perangkat ini", userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null, lastUsedAt: now(), current: true },
        ];
      },
      async revokeSession(id) {
        await delay();
        if (id === "current") storage?.removeItem(SESSION_KEY);
      },
    },

    quran: {
      async surahs() {
        await delay();
        currentAccount();
        return { data: SURAHS, meta: MOCK_META };
      },
      async surah(number) {
        await delay();
        currentAccount();
        return { data: surahDetail(number), meta: MOCK_META };
      },
      async search(query) {
        await delay();
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return SURAHS.filter((s) => s.nameLatin.toLowerCase().includes(q) || String(s.number) === q).map((s) => ({
          surahNumber: s.number,
          surahName: s.nameLatin,
          verseNumber: 1,
          textUthmani: "[Teks Arab dari dataset]",
          translation: "[Terjemahan dari dataset]",
        }));
      },
      async juz() {
        await delay();
        throw new ApiError(501, "NOT_SUPPORTED", "Data juz belum tersedia pada adapter mock");
      },
      async editions() {
        await delay();
        return [{ id: "mock-edition", name: "Edisi contoh (mock)", language: "id" }];
      },
      async tafsir() {
        await delay();
        return [];
      },
    },

    audio: {
      async qaris() {
        await delay();
        return [];
      },
      async surah() {
        await delay();
        throw new ApiError(501, "NOT_SUPPORTED", "Audio murottal belum tersedia dari backend.");
      },
    },

    content: {
      async dhikr() {
        await delay();
        return {
          data: {
            categories: [{ id: 1, name: "Contoh kategori (mock)", description: null }],
            items: [
              {
                id: "mock-dhikr-1",
                categoryId: 1,
                arabicText: "[Teks dzikir dari dataset tervalidasi]",
                transliteration: "[Transliterasi]",
                translation: "[Terjemahan]",
                recommendedCount: 33,
                source: null,
              },
            ],
          },
          meta: MOCK_META,
        };
      },
      async duas() {
        await delay();
        return {
          data: [
            {
              id: "mock-dua-1",
              title: "Contoh struktur doa (mock)",
              arabicText: "[Teks doa dari dataset tervalidasi]",
              transliteration: "[Transliterasi]",
              translation: "[Terjemahan]",
              source: null,
              categories: ["Contoh kategori"],
            },
          ],
          meta: MOCK_META,
        };
      },
      async hadithNawawi() {
        await delay();
        return {
          data: [
            {
              number: 1,
              title: "Contoh struktur hadis (mock)",
              arabicText: "[Teks Arab hadis dari dataset tervalidasi]",
              translation: "[Terjemahan hadis]",
              narrator: null,
              reference: null,
              explanation: null,
              lessons: null,
            },
          ],
          meta: MOCK_META,
        };
      },
      async asmaulHusna() {
        await delay();
        return {
          data: [
            {
              number: 1,
              arabicName: "[nama]",
              transliteration: "Contoh entri (mock)",
              meaning: "Placeholder — data dari dataset tervalidasi",
              explanation: null,
              source: null,
              audioUrl: null,
            },
          ],
          meta: MOCK_META,
        };
      },
    },

    sync: {
      async push(changes) {
        await delay(80);
        const userId = currentAccount().user.id;
        return changes.map((change): SyncPushResultItem => {
          const idemKey = `${userId}:${change.idempotencyKey}`;
          const previous = appliedKeys.get(idemKey);
          if (previous) return previous;
          const key = `${userId}:${change.entityType}:${change.entityId}`;
          const existing = records.get(key);
          let result: SyncPushResultItem;
          if (existing && change.baseVersion !== null && change.baseVersion !== existing.version && change.entityType !== "READING_PROGRESS") {
            result = { idempotencyKey: change.idempotencyKey, status: "CONFLICT", serverRecord: existing.payload, resultVersion: existing.version, reason: "VERSION_MISMATCH" };
          } else {
            const version = (existing?.version ?? 0) + 1;
            records.set(key, {
              entityType: change.entityType,
              entityId: change.entityId,
              payload: { ...change.payload, version },
              version,
              deleted: change.operation === "DELETE",
              seq: ++seq,
            });
            result = { idempotencyKey: change.idempotencyKey, status: "APPLIED", resultVersion: version };
          }
          appliedKeys.set(idemKey, result);
          return result;
        });
      },
      async pull(cursor) {
        await delay(80);
        const userId = currentAccount().user.id;
        const from = cursor ? Number(cursor) : 0;
        const changes = [...records.entries()]
          .filter(([key, r]) => key.startsWith(`${userId}:`) && r.seq > from)
          .sort((a, b) => a[1].seq - b[1].seq)
          .map(([, r]): SyncPullChange => ({
            entityType: r.entityType,
            entityId: r.entityId,
            operation: r.deleted ? "DELETE" : "UPSERT",
            payload: r.payload,
            version: r.version,
          }));
        return { cursor: String(seq), changes, hasMore: false };
      },
    },

    admin: {
      async overview() {
        await delay();
        requireAdmin();
        return {
          users: accounts.size,
          activeSessions: 1,
          publishedDatasets: 0,
          pendingRevisions: revisions.filter((r) => r.status === "REVIEW").length,
          pendingSyncConflicts: 0,
        };
      },
      async datasets() {
        await delay();
        requireAdmin();
        return [];
      },
      async approveDataset() {
        await delay();
        requireAdmin();
        throw new ApiError(404, "NOT_FOUND", "Tidak ada dataset pada adapter mock");
      },
      async contentSources() {
        await delay();
        requireAdmin();
        return [];
      },
      async users() {
        await delay();
        requireAdmin();
        return [...accounts.values()].map(toAdminUser);
      },
      async updateUserRole(id, role) {
        await delay();
        const actor = requireAdmin();
        if (actor.user.role !== "SUPER_ADMIN") throw new ApiError(403, "FORBIDDEN", "Hanya Super Admin yang dapat mengubah peran");
        if (actor.user.id === id) throw new ApiError(400, "VALIDATION_ERROR", "Tidak dapat mengubah peran sendiri");
        const account = findAccountById(id);
        account.user = { ...account.user, role };
        log("USER_ROLE_CHANGED", "User", id);
        return toAdminUser(account);
      },
      async setUserActive(id, isActive) {
        await delay();
        const actor = requireAdmin();
        if (actor.user.id === id) throw new ApiError(400, "VALIDATION_ERROR", "Tidak dapat menonaktifkan akun sendiri");
        const account = findAccountById(id);
        account.isActive = isActive;
        log(isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "User", id);
        return toAdminUser(account);
      },
      async auditLogs() {
        await delay();
        requireAdmin();
        return audit;
      },
      async revisions() {
        await delay();
        requireAdmin();
        return revisions;
      },
      async createRevision(input: CreateRevisionInput) {
        await delay();
        const actor = requireAdmin();
        const revision: ContentRevision = {
          id: crypto.randomUUID(),
          ...input,
          status: "REVIEW",
          authorName: actor.user.name,
          reviewerName: null,
          reviewNote: null,
          createdAt: now(),
        };
        revisions.unshift(revision);
        log("REVISION_SUBMITTED", input.entityType, input.entityId);
        return revision;
      },
      async reviewRevision(id, decision, note) {
        await delay();
        const actor = requireAdmin();
        const revision = revisions.find((r) => r.id === id);
        if (!revision) throw new ApiError(404, "NOT_FOUND", "Revisi tidak ditemukan");
        if (revision.authorName === actor.user.name) {
          throw new ApiError(400, "VALIDATION_ERROR", "Reviewer harus berbeda dari penulis revisi");
        }
        revision.status = decision === "APPROVE" ? "PUBLISHED" : "DRAFT";
        revision.reviewerName = actor.user.name;
        revision.reviewNote = note ?? null;
        log(decision === "APPROVE" ? "REVISION_PUBLISHED" : "REVISION_REJECTED", revision.entityType, revision.entityId);
        return revision;
      },
      async syncStatus() {
        await delay();
        requireAdmin();
        return { changesLast24h: seq, conflictsLast24h: 0, rejectedLast24h: 0, lastChangeAt: seq > 0 ? now() : null };
      },
    },
  };
}
