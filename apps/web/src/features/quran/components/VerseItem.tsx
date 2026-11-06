import { memo } from "react";
import { BookmarkCheck, Bookmark, Copy, Play, Share2, BookText } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { toArabicDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Verse } from "@/types/domain";

export interface VerseItemProps {
  verse: Verse;
  surahNumber: number;
  bookmarked: boolean;
  playing: boolean;
  showTranslation: boolean;
  focusMode: boolean;
  canPlayVerse: boolean;
  onBookmark: (verse: number) => void;
  onCopy: (verse: Verse) => void;
  onShare: (verse: Verse) => void;
  onTafsir: (verse: number) => void;
  onPlay: (verse: number) => void;
}

/** Satu ayat. Teks Arab selalu ditampilkan penuh tanpa animasi yang mengganggu bacaan. */
export const VerseItem = memo(function VerseItem({ verse, surahNumber, bookmarked, playing, showTranslation, focusMode, canPlayVerse, onBookmark, onCopy, onShare, onTafsir, onPlay }: VerseItemProps) {
  return (
    <article
      id={`ayat-${verse.number}`}
      data-verse={verse.number}
      aria-labelledby={`ayat-label-${verse.number}`}
      className={cn(
        "group scroll-mt-40 border-b border-line py-7 transition-colors duration-500",
        playing && "rounded-3xl border-transparent bg-emerald-nur/10 px-4 ring-1 ring-emerald-nur/30 sm:px-6",
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <span id={`ayat-label-${verse.number}`} className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs font-semibold text-gold-text">
          {surahNumber}:{verse.number}
          {verse.juzNumber ? <span className="text-muted">· Juz {verse.juzNumber}</span> : null}
          {verse.pageNumber ? <span className="text-muted">· Hal. {verse.pageNumber}</span> : null}
        </span>
        <div className={cn("flex items-center gap-0.5", focusMode && "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100")}>
          {canPlayVerse && <IconButton size="sm" label={`Putar ayat ${verse.number}`} icon={<Play className="size-4" />} onClick={() => onPlay(verse.number)} />}
          <IconButton size="sm" label={bookmarked ? `Hapus bookmark ayat ${verse.number}` : `Bookmark ayat ${verse.number}`} active={bookmarked} aria-pressed={bookmarked} icon={bookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />} onClick={() => onBookmark(verse.number)} />
          <IconButton size="sm" label={`Tafsir ayat ${verse.number}`} icon={<BookText className="size-4" />} onClick={() => onTafsir(verse.number)} />
          <IconButton size="sm" label={`Salin ayat ${verse.number}`} icon={<Copy className="size-4" />} onClick={() => onCopy(verse)} />
          <IconButton size="sm" label={`Bagikan ayat ${verse.number}`} icon={<Share2 className="size-4" />} onClick={() => onShare(verse)} />
        </div>
      </div>
      <p lang="ar" dir="rtl" className="quran-arabic text-fg">
        {verse.textUthmani}
        <span className="mx-2 inline-block text-[0.7em] text-gold-text" aria-label={`ayat ${verse.number}`}>
          ﴿{toArabicDigits(verse.number)}﴾
        </span>
      </p>
      {showTranslation && verse.translation && <p className={cn("quran-translation mt-4 text-muted", focusMode && "text-muted/80")}>{verse.translation}</p>}
    </article>
  );
});
