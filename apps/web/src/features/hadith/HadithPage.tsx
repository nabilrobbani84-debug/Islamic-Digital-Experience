import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ScrollText, Search } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/misc";
import { EmptyState, ErrorState, ListSkeleton, OfflineNotice, SourceNote } from "@/components/feedback/States";
import { getSetting } from "@/services/offline/db";
import { useHadithNawawi } from "@/features/knowledge/api";
import { FavoriteButton, useFavoriteIds } from "@/features/knowledge/FavoriteButton";

export const HADITH_READ_KEY = "hadith_read";

export default function HadithPage() {
  const query = useHadithNawawi();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [filter, setFilter] = useState<"all" | "favorite" | "unread">("all");
  const favorites = useFavoriteIds("HADITH");
  const read = useLiveQuery(async () => new Set((await getSetting<number[]>(HADITH_READ_KEY)) ?? []), []);
  const total = query.data?.data.length ?? 0;

  const list = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return (query.data?.data ?? []).filter((h) => {
      if (filter === "favorite" && !favorites.has(String(h.number))) return false;
      if (filter === "unread" && read?.has(h.number)) return false;
      if (!q) return true;
      return String(h.number) === q || (h.title ?? "").toLowerCase().includes(q) || h.translation.toLowerCase().includes(q) || (h.narrator ?? "").toLowerCase().includes(q);
    });
  }, [query.data, deferred, filter, favorites, read]);

  return (
    <div>
      <PageHeader eyebrow="Knowledge" title="Hadis Arba'in Nawawi" description="Kumpulan hadis pilihan Imam an-Nawawi beserta terjemahan, penjelasan, dan referensi." arabic="الأربعون النووية" />
      {query.data?.fromCache && <div className="mb-4"><OfflineNotice /></div>}
      {total > 0 && (
        <div className="nur-surface mb-6 rounded-3xl p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Progres membaca</span>
            <span className="text-muted tabular-nums">
              {read?.size ?? 0} / {total}
            </span>
          </div>
          <ProgressBar value={(read?.size ?? 0) / total} label="Progres membaca hadis" />
        </div>
      )}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Cari hadis" hideLabel type="search" placeholder="Cari nomor, judul, perawi, atau terjemahan…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search className="size-5" />} />
        </div>
        <Segmented
          label="Filter hadis"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua" },
            { value: "unread", label: "Belum dibaca" },
            { value: "favorite", label: "Bookmark" },
          ]}
        />
      </div>
      {query.isPending ? (
        <ListSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : total === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Dataset hadis belum tersedia" description="Backend belum memiliki dataset Arba'in Nawawi yang tervalidasi." />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="Tidak ada hadis yang cocok" />
      ) : (
        <ul className="space-y-3">
          {list.map((h) => (
            <li key={h.number}>
              <div className="nur-surface flex items-center gap-4 rounded-2xl px-4 py-4 transition-colors hover:border-gold/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-sm font-bold text-gold-text">{h.number}</span>
                <Link to={`/hadith/${h.number}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{h.title ?? `Hadis ke-${h.number}`}</span>
                    {read?.has(h.number) && <Badge tone="emerald">Dibaca</Badge>}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{h.translation}</span>
                </Link>
                <FavoriteButton contentType="HADITH" contentId={String(h.number)} label={`hadis ${h.number}`} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <SourceNote source={query.data?.meta.source} license={query.data?.meta.license} version={query.data?.meta.datasetVersion} />
    </div>
  );
}
