import { useDeferredValue, useMemo, useState } from "react";
import { Copy, Hand, Search, Share2 } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, ListSkeleton, OfflineNotice, SourceNote } from "@/components/feedback/States";
import { toast } from "@/stores/ui";
import type { Dua } from "@/types/domain";
import { useDuas } from "@/features/knowledge/api";
import { FavoriteButton, useFavoriteIds } from "@/features/knowledge/FavoriteButton";
import { cn } from "@/lib/cn";

function duaText(d: Dua): string {
  return `${d.title}\n\n${d.arabicText}\n\n${d.transliteration}\n\n${d.translation}${d.source ? `\n\n(${d.source})` : ""}`;
}

async function share(d: Dua): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: d.title, text: duaText(d) });
      return;
    } catch {
      return;
    }
  }
  await copy(d);
}

async function copy(d: Dua): Promise<void> {
  try {
    await navigator.clipboard.writeText(duaText(d));
    toast.success("Doa disalin");
  } catch {
    toast.error("Gagal menyalin");
  }
}

export default function DuasPage() {
  const query = useDuas();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [category, setCategory] = useState("__all");
  const favorites = useFavoriteIds("DAILY_DUA");
  const categories = useMemo(() => Array.from(new Set((query.data?.data ?? []).flatMap((d) => d.categories))).sort(), [query.data]);

  const list = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return (query.data?.data ?? []).filter((d) => {
      if (category === "__fav" && !favorites.has(d.id)) return false;
      if (category !== "__all" && category !== "__fav" && !d.categories.includes(category)) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.translation.toLowerCase().includes(q) || d.transliteration.toLowerCase().includes(q);
    });
  }, [query.data, deferred, category, favorites]);

  return (
    <div>
      <PageHeader eyebrow="Knowledge" title="Doa Harian" description="Doa sebelum dan sesudah aktivitas, lengkap dengan teks Arab, latin, terjemahan, dan sumber." arabic="الدعاء" />
      {query.data?.fromCache && <div className="mb-4"><OfflineNotice /></div>}
      <div className="mb-6 space-y-3">
        <Input label="Cari doa" hideLabel type="search" placeholder="Cari judul atau arti doa…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search className="size-5" />} />
        <Segmented
          label="Kategori doa"
          size="sm"
          value={category}
          onChange={setCategory}
          options={[{ value: "__all", label: "Semua" }, { value: "__fav", label: "Favorit" }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
      </div>
      {query.isPending ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState icon={<Hand className="size-6" />} title="Dataset doa belum tersedia" description="Backend belum memiliki doa harian yang telah diverifikasi sumbernya." />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="Tidak ada doa yang cocok" />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.map((d) => (
            <li key={d.id}>
              <article className="nur-surface flex h-full flex-col rounded-3xl p-6" aria-labelledby={`dua-${d.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id={`dua-${d.id}`} className="font-semibold text-fg">
                      {d.title}
                    </h2>
                    <p className="mt-1 text-xs text-gold-text">{d.categories.join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0">
                    <FavoriteButton contentType="DAILY_DUA" contentId={d.id} label={d.title} />
                    <IconButton size="sm" label={`Salin ${d.title}`} icon={<Copy className="size-4" />} onClick={() => void copy(d)} />
                    <IconButton size="sm" label={`Bagikan ${d.title}`} icon={<Share2 className="size-4" />} onClick={() => void share(d)} />
                  </div>
                </div>
                <p lang="ar" dir="rtl" className="mt-5 text-right text-2xl leading-[2.1] text-fg sm:text-3xl">
                  {d.arabicText}
                </p>
                <p className="mt-4 text-sm text-gold-text italic">{d.transliteration}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d.translation}</p>
                <p className={cn("mt-auto pt-4 text-xs", d.source ? "text-muted" : "text-amber-500")}>{d.source ? `Sumber: ${d.source}` : "Sumber belum dicantumkan pada dataset"}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
      <SourceNote source={query.data?.meta.source} license={query.data?.meta.license} version={query.data?.meta.datasetVersion} />
    </div>
  );
}
