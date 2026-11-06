import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/services/api";
import { db, type CachedContent } from "@/services/offline/db";
import type { AsmaulHusnaEntry, DhikrCategory, DhikrItem, Dua, Hadith, WithMeta } from "@/types/domain";

/**
 * Konten ibadah (dzikir, doa, hadis, Asmaul Husna) selalu berasal dari dataset backend
 * dan disalin ke IndexedDB untuk offline. Frontend tidak menulis konten keagamaan sendiri.
 */
function useContent<T>(key: CachedContent["key"], fetcher: () => Promise<WithMeta<T>>) {
  return useQuery({
    queryKey: ["content", key],
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<WithMeta<T> & { fromCache: boolean }> => {
      try {
        const result = await fetcher();
        await db.content_cache.put({ key, data: result.data, meta: result.meta, cachedAt: new Date().toISOString() });
        return { ...result, fromCache: false };
      } catch (error) {
        if (isApiError(error) && error.isNetwork) {
          const cached = await db.content_cache.get(key);
          if (cached) return { data: cached.data as T, meta: cached.meta, fromCache: true };
        }
        throw error;
      }
    },
  });
}

export const useDhikrContent = () => useContent<{ categories: DhikrCategory[]; items: DhikrItem[] }>("dhikr", () => api.content.dhikr());
export const useDuas = () => useContent<Dua[]>("duas", () => api.content.duas());
export const useHadithNawawi = () => useContent<Hadith[]>("hadith-nawawi", () => api.content.hadithNawawi());
export const useAsmaulHusna = () => useContent<AsmaulHusnaEntry[]>("asmaul-husna", () => api.content.asmaulHusna());
