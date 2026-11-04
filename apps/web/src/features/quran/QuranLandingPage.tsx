import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Bookmark, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, GridSkeleton, OfflineNotice, SourceNote } from "@/components/feedback/States";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { SceneLoadingHalo } from "@/three/components/Fallbacks2D";
import { LazyQuran3DExperience } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { api, userMessage } from "@/services/api";
import { db } from "@/services/offline/db";
import { useQuranSearch, useSurahs } from "./api";
import type { Surah } from "@/types/domain";

type Revelation = "ALL" | "MAKKIYAH" | "MADANIYAH";

function SurahCard({ surah, lastRead }: { surah: Surah; lastRead: boolean }) {
  return (
    <Link to={`/quran/${surah.number}`} className="group nur-surface relative flex items-center gap-4 rounded-2xl px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-gold/40">
      <span className="relative grid size-12 shrink-0 place-items-center text-sm font-bold text-gold-text">
        <svg viewBox="0 0 48 48" className="absolute inset-0 size-12 text-gold/50 transition-transform duration-500 group-hover:rotate-45" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
          <rect x="10" y="10" width="28" height="28" />
          <rect x="10" y="10" width="28" height="28" transform="rotate(45 24 24)" />
        </svg>
        <span className="relative">{surah.number}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold text-fg">{surah.nameLatin}</span>
          {lastRead && <Badge tone="gold">Terakhir</Badge>}
        </span>
        <span className="block truncate text-xs text-muted">
          {surah.meaning ? `${surah.meaning} · ` : ""}
          {surah.totalVerses} ayat
          {surah.revelationType ? ` · ${surah.revelationType === "MAKKIYAH" ? "Makkiyah" : "Madaniyah"}` : ""}
        </span>
      </span>
      <span lang="ar" className="shrink-0 text-xl text-fg/90">
        {surah.nameArabic}
      </span>
    </Link>
  );
}

function useJuzRange(juz: number | null) {
  return useQuery({
    queryKey: ["quran", "juz", juz],
    enabled: juz !== null,
    staleTime: Infinity,
    queryFn: () => api.quran.juz(juz ?? 1),
  });
}

export default function QuranLandingPage() {
  const surahs = useSurahs();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [revelation, setRevelation] = useState<Revelation>("ALL");
  const [juz, setJuz] = useState<number | null>(null);
  const juzRange = useJuzRange(juz);
  const verseSearch = useQuranSearch(/^\d+$/.test(deferred.trim()) ? "" : deferred);
  const progress = useLiveQuery(() => db.reading_progress.get("last-read"), []);
  const bookmarkCount = useLiveQuery(() => db.bookmarks.filter((b) => !b.deletedAt).count(), []);
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();

  const filtered = useMemo(() => {
    const list = surahs.data?.data ?? [];
    const q = deferred.trim().toLowerCase().replace(/[-'\s]/g, "");
    return list.filter((s) => {
      if (revelation !== "ALL" && s.revelationType !== revelation) return false;
      if (juz !== null && juzRange.data && (s.number < juzRange.data.startSurah || s.number > juzRange.data.endSurah)) return false;
      if (!q) return true;
      return String(s.number) === q || s.nameLatin.toLowerCase().replace(/[-'\s]/g, "").includes(q) || (s.meaning ?? "").toLowerCase().includes(q) || s.nameArabic.includes(deferred.trim());
    });
  }, [surahs.data, deferred, revelation, juz, juzRange.data]);

  const lastReadSurah = surahs.data?.data.find((s) => s.number === progress?.surahNumber);

  return (
    <div>
      <div className="relative mb-4 grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
        <PageHeader eyebrow="Al-Qur'an" title="Al-Qur'an Al-Karim" description="Baca dengan teks Utsmani, terjemahan, tafsir, dan murottal. Unduh untuk dibaca offline." />
        <SceneBoundary tier={tier} className="hidden h-56 md:block" fallback={<SceneLoadingHalo />}>
          {(active) => tier !== "none" && <LazyQuran3DExperience tier={tier} reducedMotion={reducedMotion} active={active} />}
        </SceneBoundary>
      </div>

      {surahs.data?.fromCache && <div className="mb-4"><OfflineNotice /></div>}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {progress && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="nur-surface flex items-center justify-between gap-4 rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-nur/15 text-gold-text">
                <BookOpen className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-muted">Lanjutkan membaca</p>
                <p className="font-semibold">
                  {lastReadSurah?.nameLatin ?? `Surah ${progress.surahNumber}`} · Ayat {progress.verseNumber}
                </p>
              </div>
            </div>
            <Link to={`/quran/${progress.surahNumber}?ayat=${progress.verseNumber}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
              Lanjut <ArrowRight className="size-4" aria-hidden />
            </Link>
          </motion.div>
        )}
        <Link to="/profile?tab=bookmarks" className="nur-surface flex items-center gap-4 rounded-3xl p-5 hover:border-gold/40">
          <span className="grid size-12 place-items-center rounded-2xl bg-gold/10 text-gold-text">
            <Bookmark className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs text-muted">Bookmark ayat</p>
            <p className="font-semibold">{bookmarkCount ?? 0} tersimpan</p>
          </div>
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Input label="Cari surah atau ayat" hideLabel placeholder="Cari nama surah, nomor, atau teks terjemahan…" value={query} onChange={(e) => setQuery(e.target.value)} leading={<Search className="size-5" />} type="search" />
        </div>
        <Segmented
          label="Tempat turun"
          value={revelation}
          onChange={setRevelation}
          options={[
            { value: "ALL", label: "Semua" },
            { value: "MAKKIYAH", label: "Makkiyah" },
            { value: "MADANIYAH", label: "Madaniyah" },
          ]}
        />
        <div className="w-full lg:w-44">
          <Select label="Filter juz" hideLabel value={juz ?? ""} onChange={(e) => setJuz(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Semua juz</option>
            {Array.from({ length: 30 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Juz {i + 1}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {juz !== null && juzRange.isError && <p className="mb-4 text-sm text-amber-500" role="status">{userMessage(juzRange.error)}</p>}

      {verseSearch.data && verseSearch.data.length > 0 && (
        <section aria-labelledby="verse-results" className="mb-8">
          <h2 id="verse-results" className="mb-3 text-sm font-semibold text-muted">
            Hasil pencarian ayat
          </h2>
          <ul className="space-y-2">
            {verseSearch.data.slice(0, 8).map((r) => (
              <li key={`${r.surahNumber}:${r.verseNumber}`}>
                <Link to={`/quran/${r.surahNumber}?ayat=${r.verseNumber}`} className="nur-surface block rounded-2xl px-4 py-3 hover:border-gold/40">
                  <span className="text-xs text-gold-text">
                    QS. {r.surahName} : {r.verseNumber}
                  </span>
                  {r.translation && <span className="mt-1 line-clamp-2 block text-sm text-muted">{r.translation}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {surahs.isPending ? (
        <GridSkeleton items={9} />
      ) : surahs.isError ? (
        <ErrorState error={surahs.error} onRetry={() => void surahs.refetch()} />
      ) : (surahs.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={<BookOpen className="size-6" />} title="Dataset Al-Qur'an belum tersedia" description="Backend NUR belum memiliki data surah. Admin perlu mengimpor dataset Al-Qur'an yang telah diverifikasi." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="Tidak ada surah yang cocok" description="Coba kata kunci lain atau hapus filter." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Daftar surah">
          {filtered.map((s) => (
            <li key={s.number}>
              <SurahCard surah={s} lastRead={s.number === progress?.surahNumber} />
            </li>
          ))}
        </ul>
      )}
      <SourceNote source={surahs.data?.meta.source} license={surahs.data?.meta.license} version={surahs.data?.meta.datasetVersion} />
    </div>
  );
}
