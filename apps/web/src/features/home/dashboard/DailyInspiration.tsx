import { useState } from "react";
import { Link } from "react-router";
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/misc";
import { useDuas, useHadithNawawi } from "@/features/knowledge/api";
import { userMessage } from "@/services/api";

type Tab = "hadith" | "dua";

/** Pilihan harian deterministik: indeks berdasarkan tanggal, berganti setiap hari. */
function dailyIndex(length: number): number {
  const day = Math.floor(Date.now() / 86_400_000);
  return length > 0 ? day % length : 0;
}

/**
 * Inspirasi harian dari dataset backend (hadis & doa). Tidak ada konten yang ditulis
 * langsung di frontend. Ayat pilihan memerlukan endpoint kurasi dari backend (belum tersedia).
 */
export function DailyInspiration() {
  const [tab, setTab] = useState<Tab>("hadith");
  const hadith = useHadithNawawi();
  const duas = useDuas();
  const query = tab === "hadith" ? hadith : duas;
  const list = tab === "hadith" ? hadith.data?.data ?? [] : duas.data?.data ?? [];
  const index = dailyIndex(list.length);

  return (
    <Card tone="glass">
      <CardHeader title="Inspirasi harian" icon={<Sparkles className="size-5" />} />
      <Segmented
        label="Jenis inspirasi"
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "hadith", label: "Hadis pilihan" },
          { value: "dua", label: "Doa harian" },
        ]}
      />
      <div className="mt-5 min-h-40">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : query.isError ? (
          <p className="text-sm text-muted">{userMessage(query.error)}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted">Dataset belum tersedia dari backend.</p>
        ) : tab === "hadith" ? (
          (() => {
            const h = hadith.data!.data[index]!;
            return (
              <figure>
                <p lang="ar" className="text-right text-2xl text-fg">
                  {h.arabicText}
                </p>
                <blockquote className="mt-3 text-sm leading-relaxed text-muted">{h.translation}</blockquote>
                <figcaption className="mt-3 text-xs text-gold-text">
                  Hadis Arba'in no. {h.number}
                  {h.reference ? ` · ${h.reference}` : ""}
                </figcaption>
                <Link to={`/hadith/${h.number}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-gold-text hover:underline">
                  Baca penjelasan
                </Link>
              </figure>
            );
          })()
        ) : (
          (() => {
            const d = duas.data!.data[index]!;
            return (
              <figure>
                <p className="mb-2 text-sm font-semibold text-fg">{d.title}</p>
                <p lang="ar" className="text-right text-2xl text-fg">
                  {d.arabicText}
                </p>
                <blockquote className="mt-3 text-sm leading-relaxed text-muted">{d.translation}</blockquote>
                {d.source && <figcaption className="mt-3 text-xs text-gold-text">{d.source}</figcaption>}
              </figure>
            );
          })()
        )}
      </div>
    </Card>
  );
}
