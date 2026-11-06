import { BookText } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/States";
import { useTafsir } from "../api";

export function TafsirDialog({ surahNumber, surahName, verse, onClose }: { surahNumber: number; surahName: string; verse: number | null; onClose: () => void }) {
  const tafsir = useTafsir(surahNumber, verse);
  return (
    <Dialog open={verse !== null} onClose={onClose} title={`Tafsir QS. ${surahName} : ${verse ?? ""}`} size="lg">
      {tafsir.isPending ? (
        <ListSkeleton rows={3} />
      ) : tafsir.isError ? (
        <ErrorState error={tafsir.error} onRetry={() => void tafsir.refetch()} />
      ) : tafsir.data.length === 0 ? (
        <EmptyState icon={<BookText className="size-6" />} title="Tafsir belum tersedia" description="Belum ada sumber tafsir untuk ayat ini pada dataset backend." />
      ) : (
        <div className="space-y-8">
          {tafsir.data.map((t, i) => (
            <section key={`${t.sourceName}-${i}`}>
              <h3 className="text-sm font-semibold text-gold-text">
                {t.sourceName}
                {t.author ? ` — ${t.author}` : ""}
              </h3>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed whitespace-pre-line text-fg/90">{t.content}</div>
              {t.reference && <p className="mt-3 text-xs text-muted">Referensi: {t.reference}</p>}
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
