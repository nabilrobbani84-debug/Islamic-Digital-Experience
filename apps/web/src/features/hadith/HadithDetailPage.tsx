import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { GeometricDivider } from "@/components/ui/misc";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/States";
import { getSetting, setSetting } from "@/services/offline/db";
import { useHadithNawawi } from "@/features/knowledge/api";
import { FavoriteButton } from "@/features/knowledge/FavoriteButton";
import { HADITH_READ_KEY } from "./HadithPage";

export default function HadithDetailPage() {
  const { number: param } = useParams();
  const number = Number(param);
  const query = useHadithNawawi();
  const list = query.data?.data ?? [];
  const index = list.findIndex((h) => h.number === number);
  const hadith = index >= 0 ? list[index] : undefined;
  const prev = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;

  useEffect(() => {
    if (!hadith) return;
    const timer = window.setTimeout(async () => {
      const read = new Set((await getSetting<number[]>(HADITH_READ_KEY)) ?? []);
      read.add(hadith.number);
      await setSetting(HADITH_READ_KEY, [...read]);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [hadith]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/hadith" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> Daftar hadis
      </Link>
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !hadith ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Hadis tidak ditemukan" description={`Hadis nomor ${param ?? ""} tidak ada pada dataset.`} />
      ) : (
        <article aria-labelledby="hadith-title">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-gold-text uppercase">Hadis ke-{hadith.number}</p>
              <h1 id="hadith-title" className="mt-2 text-3xl font-bold">
                {hadith.title ?? `Hadis Arba'in ke-${hadith.number}`}
              </h1>
              {hadith.narrator && <p className="mt-1 text-muted">Diriwayatkan oleh {hadith.narrator}</p>}
            </div>
            <FavoriteButton contentType="HADITH" contentId={String(hadith.number)} label={`hadis ${hadith.number}`} />
          </header>
          <p lang="ar" dir="rtl" className="nur-surface rounded-3xl p-6 text-right text-2xl leading-[2.2] sm:text-3xl">
            {hadith.arabicText}
          </p>
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-gold-text">Terjemahan</h2>
            <p className="text-lg leading-relaxed">{hadith.translation}</p>
          </section>
          {hadith.explanation && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-gold-text">Penjelasan</h2>
              <p className="leading-relaxed whitespace-pre-line text-fg/90">{hadith.explanation}</p>
            </section>
          )}
          {hadith.lessons && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-gold-text">Pelajaran</h2>
              <p className="leading-relaxed whitespace-pre-line text-fg/90">{hadith.lessons}</p>
            </section>
          )}
          <p className="mt-8 text-sm text-muted">Referensi: {hadith.reference ?? "belum dicantumkan pada dataset"}</p>
          <GeometricDivider className="my-10" />
          <nav aria-label="Navigasi hadis" className="flex justify-between gap-3">
            {prev ? (
              <Link to={`/hadith/${prev.number}`} className="inline-flex h-11 items-center gap-1 rounded-xl border border-line px-4 text-sm hover:border-gold/40">
                <ChevronLeft className="size-4" aria-hidden /> Hadis {prev.number}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/hadith/${next.number}`} className="inline-flex h-11 items-center gap-1 rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
                Hadis {next.number} <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        </article>
      )}
    </div>
  );
}
