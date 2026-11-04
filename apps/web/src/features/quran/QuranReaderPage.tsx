import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Download, Focus, Headphones, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, GeometricDivider } from "@/components/ui/misc";
import { EmptyState, ErrorState, ListSkeleton, OfflineNotice, SourceNote } from "@/components/feedback/States";
import { db } from "@/services/offline/db";
import { saveReadingProgress, toggleBookmark } from "@/services/offline/personal";
import { usePreferences } from "@/stores/preferences";
import { useAudio } from "@/stores/audio";
import { toast } from "@/stores/ui";
import { cn } from "@/lib/cn";
import type { Verse } from "@/types/domain";
import { useQaris, useSurahDetail } from "./api";
import { VerseItem } from "./components/VerseItem";
import { ReaderSettingsDialog } from "./components/ReaderSettingsDialog";
import { TafsirDialog } from "./components/TafsirDialog";
import { NotFoundPage } from "@/components/feedback/RouteFallbacks";

/** Ayat paling atas yang terlihat dicatat sebagai progres (debounce agar tidak menulis berlebihan). */
function useReadingTracker(surahNumber: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.verse);
          if (e.isIntersecting) visible.set(n, e.boundingClientRect.top);
          else visible.delete(n);
        }
        const top = [...visible.keys()].sort((a, b) => a - b)[0];
        if (top === undefined) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void saveReadingProgress(surahNumber, top), 1500);
      },
      { rootMargin: "-30% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-verse]").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [surahNumber, enabled]);
}

export default function QuranReaderPage() {
  const { surahNumber: param } = useParams();
  const surahNumber = Number(param);
  const valid = Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= 114;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const detail = useSurahDetail(surahNumber);
  const qaris = useQaris();
  const prefs = usePreferences();
  // Selektor sempit agar pembaruan waktu audio (beberapa kali per detik) tidak me-render ulang seluruh surah.
  const audioTrack = useAudio((s) => s.track);
  const audioStatus = useAudio((s) => s.status);
  const audioVerse = useAudio((s) => s.currentVerse);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirVerse, setTafsirVerse] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const scrolledTo = useRef(false);

  const bookmarks = useLiveQuery(() => db.bookmarks.where("[surahNumber+verseNumber]").between([surahNumber, 0], [surahNumber, 9999]).toArray(), [surahNumber]);
  const bookmarked = useMemo(() => new Set((bookmarks ?? []).filter((b) => !b.deletedAt).map((b) => b.verseNumber)), [bookmarks]);
  const surah = detail.data?.data;

  useReadingTracker(surahNumber, !!surah);

  useEffect(() => {
    scrolledTo.current = false;
  }, [surahNumber]);

  useEffect(() => {
    const target = Number(searchParams.get("ayat"));
    if (!surah || scrolledTo.current || !target) return;
    scrolledTo.current = true;
    requestAnimationFrame(() => document.getElementById(`ayat-${target}`)?.scrollIntoView({ block: "start" }));
  }, [surah, searchParams]);

  const qariId = prefs.qariId ?? qaris.data?.[0]?.id ?? null;
  const qari = qaris.data?.find((q) => q.id === qariId) ?? null;
  const isThisSurahLoaded = audioTrack?.surahNumber === surahNumber;

  const playSurah = useCallback(
    (startVerse?: number) => {
      const player = useAudio.getState();
      if (!surah || !qari) {
        toast.info("Audio belum tersedia", "Backend belum menyediakan qari untuk murottal.");
        return;
      }
      if (player.track?.surahNumber === surahNumber && player.track.qariId === qari.id) {
        if (startVerse) player.seekVerse(startVerse);
        player.play();
        return;
      }
      void player.load({ surahNumber, surahName: surah.nameLatin, totalVerses: surah.totalVerses, qariId: qari.id, qariName: qari.name, startVerse });
    },
    [qari, surah, surahNumber],
  );

  const onBookmark = useCallback(
    async (verse: number) => {
      const added = await toggleBookmark(surahNumber, verse);
      toast.success(added ? "Bookmark disimpan" : "Bookmark dihapus", `QS. ${surah?.nameLatin ?? surahNumber}:${verse}`);
    },
    [surah?.nameLatin, surahNumber],
  );

  const shareText = useCallback((v: Verse) => `${v.textUthmani}\n\n${v.translation ?? ""}\n\n— QS. ${surah?.nameLatin ?? ""} ${surahNumber}:${v.number}`.trim(), [surah?.nameLatin, surahNumber]);

  const onCopy = useCallback(
    async (v: Verse) => {
      try {
        await navigator.clipboard.writeText(shareText(v));
        toast.success("Ayat disalin");
      } catch {
        toast.error("Gagal menyalin", "Browser tidak mengizinkan akses clipboard.");
      }
    },
    [shareText],
  );

  const onShare = useCallback(
    async (v: Verse) => {
      const url = `${window.location.origin}/quran/${surahNumber}?ayat=${v.number}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `QS. ${surah?.nameLatin ?? ""} ${surahNumber}:${v.number}`, text: shareText(v), url });
        } catch {
          /* dibatalkan pengguna */
        }
      } else {
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        toast.success("Tautan ayat disalin");
      }
    },
    [shareText, surah?.nameLatin, surahNumber],
  );

  if (!valid) return <NotFoundPage />;

  return (
    <div className={cn("mx-auto", focusMode ? "max-w-3xl" : "max-w-4xl")}>
      <nav aria-label="Navigasi surah" className="mb-6 flex items-center justify-between gap-2">
        <Link to="/quran" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft className="size-4" aria-hidden /> Daftar surah
        </Link>
        <div className="flex items-center gap-1">
          <IconButton label="Surah sebelumnya" icon={<ChevronLeft className="size-5" />} disabled={surahNumber <= 1} onClick={() => navigate(`/quran/${surahNumber - 1}`)} />
          <IconButton label="Surah berikutnya" icon={<ChevronRight className="size-5" />} disabled={surahNumber >= 114} onClick={() => navigate(`/quran/${surahNumber + 1}`)} />
        </div>
      </nav>

      {detail.isPending ? (
        <ListSkeleton rows={5} />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Surah gagal dimuat" />
      ) : !surah || surah.verses.length === 0 ? (
        <EmptyState icon={<Headphones className="size-6" />} title="Data surah belum tersedia" description="Backend belum menyediakan ayat untuk surah ini." />
      ) : (
        <>
          {detail.data.fromCache && <div className="mb-4"><OfflineNotice /></div>}
          <header className="nur-surface relative mb-6 overflow-hidden rounded-3xl px-6 py-8 text-center sm:py-10">
            <div className="nur-pattern absolute inset-0 opacity-80" aria-hidden />
            <div className="relative">
              <p lang="ar" className="text-4xl text-gold-text sm:text-5xl">
                {surah.nameArabic}
              </p>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{surah.nameLatin}</h1>
              {surah.meaning && <p className="mt-1 text-muted">{surah.meaning}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge tone="gold">Surah ke-{surah.number}</Badge>
                <Badge>{surah.totalVerses} ayat</Badge>
                {surah.revelationType && <Badge tone="emerald">{surah.revelationType === "MAKKIYAH" ? "Makkiyah" : "Madaniyah"}</Badge>}
                {surah.editionName && <Badge>{surah.editionName}</Badge>}
              </div>
            </div>
          </header>

          <div className="nur-glass sticky top-[68px] z-30 mb-2 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 lg:top-[80px]">
            <Button size="sm" variant="primary" leftIcon={<Headphones className="size-4" />} onClick={() => playSurah()} disabled={qaris.isPending}>
              {isThisSurahLoaded && audioStatus === "playing" ? "Sedang diputar" : "Putar murottal"}
            </Button>
            {qaris.data && qaris.data.length > 0 && (
              <div className="w-40">
                <Select label="Qari" hideLabel value={qariId ?? ""} onChange={(e) => prefs.set({ qariId: e.target.value })} className="h-9 text-sm">
                  {qaris.data.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {qaris.data?.length === 0 && <span className="text-xs text-muted">Audio belum tersedia</span>}
            <div className="ml-auto flex items-center gap-1">
              <div className="w-28">
                <Select
                  label="Lompat ke ayat"
                  hideLabel
                  className="h-9 text-sm"
                  value=""
                  onChange={(e) => document.getElementById(`ayat-${e.target.value}`)?.scrollIntoView({ behavior: prefs.reducedMotion ? "auto" : "smooth", block: "start" })}
                >
                  <option value="">Ayat…</option>
                  {surah.verses.map((v) => (
                    <option key={v.number} value={v.number}>
                      Ayat {v.number}
                    </option>
                  ))}
                </Select>
              </div>
              <IconButton label={focusMode ? "Keluar mode fokus" : "Mode fokus"} active={focusMode} aria-pressed={focusMode} icon={<Focus className="size-5" />} onClick={() => setFocusMode((f) => !f)} />
              <IconButton label="Pengaturan bacaan" icon={<Settings2 className="size-5" />} onClick={() => setSettingsOpen(true)} />
              <Link to="/settings/offline-data" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2" aria-label="Unduh untuk offline" title="Unduh untuk offline">
                <Download className="size-5" aria-hidden />
              </Link>
            </div>
          </div>

          <div className={cn(focusMode && "px-1 sm:px-6")}>
            {surah.verses.map((v) => (
              <VerseItem
                key={v.id}
                verse={v}
                surahNumber={surahNumber}
                bookmarked={bookmarked.has(v.number)}
                playing={isThisSurahLoaded && audioVerse === v.number && audioStatus === "playing"}
                showTranslation={prefs.translationEnabled}
                focusMode={focusMode}
                canPlayVerse={!!qari && (!isThisSurahLoaded || !!audioTrack?.segments)}
                onBookmark={onBookmark}
                onCopy={onCopy}
                onShare={onShare}
                onTafsir={setTafsirVerse}
                onPlay={playSurah}
              />
            ))}
          </div>

          <GeometricDivider className="my-10" />
          <div className="flex justify-between gap-3">
            {surahNumber > 1 ? (
              <Link to={`/quran/${surahNumber - 1}`} className="inline-flex h-11 items-center gap-1 rounded-xl border border-line px-4 text-sm hover:border-gold/40">
                <ChevronLeft className="size-4" aria-hidden /> Surah sebelumnya
              </Link>
            ) : (
              <span />
            )}
            {surahNumber < 114 && (
              <Link to={`/quran/${surahNumber + 1}`} className="inline-flex h-11 items-center gap-1 rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
                Surah berikutnya <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          <SourceNote source={detail.data.meta.source} license={detail.data.meta.license} version={detail.data.meta.datasetVersion} />
          <TafsirDialog surahNumber={surahNumber} surahName={surah.nameLatin} verse={tafsirVerse} onClose={() => setTafsirVerse(null)} />
        </>
      )}
      <ReaderSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
