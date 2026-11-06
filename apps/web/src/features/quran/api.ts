import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/services/api";
import { db } from "@/services/offline/db";
import { usePreferences } from "@/stores/preferences";
import type { ContentMeta, Surah, SurahDetail, WithMeta } from "@/types/domain";

export interface CachedResult<T> extends WithMeta<T> {
  /** true jika data berasal dari IndexedDB karena jaringan tidak tersedia. */
  fromCache: boolean;
}

/** Jalankan request; jika gagal karena jaringan, pakai salinan lokal bila ada. */
async function networkThenCache<T>(fetcher: () => Promise<WithMeta<T>>, readCache: () => Promise<WithMeta<T> | null>, writeCache: (value: WithMeta<T>) => Promise<void>): Promise<CachedResult<T>> {
  try {
    const result = await fetcher();
    await writeCache(result).catch(() => undefined);
    return { ...result, fromCache: false };
  } catch (error) {
    if (isApiError(error) && error.isNetwork) {
      const cached = await readCache();
      if (cached) return { ...cached, fromCache: true };
    }
    throw error;
  }
}

export const quranKeys = {
  surahs: ["quran", "surahs"] as const,
  surah: (n: number, edition: string | null) => ["quran", "surah", n, edition] as const,
  tafsir: (s: number, v: number) => ["quran", "tafsir", s, v] as const,
  editions: ["quran", "editions"] as const,
  qaris: ["audio", "qaris"] as const,
  search: (q: string) => ["quran", "search", q] as const,
};

export function useSurahs() {
  return useQuery({
    queryKey: quranKeys.surahs,
    staleTime: 24 * 60 * 60_000,
    queryFn: () =>
      networkThenCache<Surah[]>(
        () => api.quran.surahs(),
        async () => {
          const rows = await db.quran_surahs.orderBy("number").toArray();
          const meta = (await db.app_settings.get("quran_meta"))?.value as ContentMeta | undefined;
          return rows.length > 0 ? { data: rows as Surah[], meta: meta ?? {} } : null;
        },
        async ({ data, meta }) => {
          const cachedAt = new Date().toISOString();
          await db.transaction("rw", db.quran_surahs, db.app_settings, async () => {
            await db.quran_surahs.bulkPut(data.map((s) => ({ ...s, cachedAt })));
            await db.app_settings.put({ key: "quran_meta", value: meta });
          });
        },
      ),
  });
}

export async function fetchSurahDetail(number: number, editionId: string | null): Promise<CachedResult<SurahDetail>> {
  const key = `${number}:${editionId ?? "default"}`;
  return networkThenCache<SurahDetail>(
    () => api.quran.surah(number, { editionId: editionId ?? undefined }),
    async () => {
      const row = (await db.quran_verses.get(key)) ?? (await db.quran_verses.where("surahNumber").equals(number).first());
      return row ? { data: row.detail, meta: row.meta } : null;
    },
    async ({ data, meta }) => {
      await db.quran_verses.put({ key, surahNumber: number, editionId: editionId ?? "default", detail: data, meta, cachedAt: new Date().toISOString() });
    },
  );
}

export function useSurahDetail(number: number) {
  const editionId = usePreferences((s) => s.editionId);
  return useQuery({
    queryKey: quranKeys.surah(number, editionId),
    enabled: Number.isInteger(number) && number >= 1 && number <= 114,
    staleTime: 24 * 60 * 60_000,
    queryFn: () => fetchSurahDetail(number, editionId),
  });
}

export function useTafsir(surahNumber: number, verseNumber: number | null) {
  return useQuery({
    queryKey: quranKeys.tafsir(surahNumber, verseNumber ?? 0),
    enabled: verseNumber !== null,
    queryFn: async () => {
      const key = `${surahNumber}:${verseNumber}`;
      try {
        const entries = await api.quran.tafsir(surahNumber, verseNumber ?? 0);
        await db.tafsir.put({ key, entries, cachedAt: new Date().toISOString() });
        return entries;
      } catch (error) {
        const cached = await db.tafsir.get(key);
        if (cached && isApiError(error) && error.isNetwork) return cached.entries;
        throw error;
      }
    },
  });
}

export function useEditions() {
  return useQuery({
    queryKey: quranKeys.editions,
    staleTime: 24 * 60 * 60_000,
    queryFn: async () => {
      try {
        const editions = await api.quran.editions();
        await db.translations.bulkPut(editions);
        return editions;
      } catch (error) {
        const cached = await db.translations.toArray();
        if (cached.length > 0) return cached;
        throw error;
      }
    },
  });
}

export function useQaris() {
  return useQuery({
    queryKey: quranKeys.qaris,
    staleTime: 24 * 60 * 60_000,
    queryFn: async () => {
      try {
        const qaris = await api.audio.qaris();
        await db.qari.bulkPut(qaris);
        return qaris;
      } catch (error) {
        const cached = await db.qari.toArray();
        if (cached.length > 0) return cached;
        throw error;
      }
    },
  });
}

export function useQuranSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: quranKeys.search(q),
    enabled: q.length >= 2,
    staleTime: 10 * 60_000,
    queryFn: () => api.quran.search(q),
  });
}
