import { useDeferredValue, useMemo, useState } from "react";
import { Search, Star, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, GridSkeleton, OfflineNotice, SourceNote } from "@/components/feedback/States";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { SceneLoadingHalo } from "@/three/components/Fallbacks2D";
import { LazyGeometricHalo } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { toast } from "@/stores/ui";
import type { AsmaulHusnaEntry } from "@/types/domain";
import { useAsmaulHusna } from "@/features/knowledge/api";
import { FavoriteButton, useFavoriteIds } from "@/features/knowledge/FavoriteButton";

function playPronunciation(url: string): void {
  const audio = new Audio(url);
  audio.play().catch(() => toast.error("Audio tidak dapat diputar"));
}

export default function AsmaulHusnaPage() {
  const query = useAsmaulHusna();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [filter, setFilter] = useState<"all" | "favorite">("all");
  const [selected, setSelected] = useState<AsmaulHusnaEntry | null>(null);
  const favorites = useFavoriteIds("ASMAUL_HUSNA");
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();
  const reduced = useReducedMotion();

  const list = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return (query.data?.data ?? []).filter((n) => {
      if (filter === "favorite" && !favorites.has(String(n.number))) return false;
      if (!q) return true;
      return n.transliteration.toLowerCase().includes(q) || n.meaning.toLowerCase().includes(q) || n.arabicName.includes(deferred.trim()) || String(n.number) === q;
    });
  }, [query.data, deferred, filter, favorites]);

  return (
    <div>
      <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
        <PageHeader eyebrow="Knowledge" title="Asmaul Husna" description="Nama-nama Allah yang indah beserta makna dan penjelasan dari sumber yang tercantum." />
        <SceneBoundary tier={tier} className="hidden h-48 md:block" fallback={<SceneLoadingHalo />}>
          {(active) => tier !== "none" && <LazyGeometricHalo tier={tier} reducedMotion={reducedMotion} active={active} />}
        </SceneBoundary>
      </div>
      {query.data?.fromCache && <div className="mb-4"><OfflineNotice /></div>}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Cari Asmaul Husna" hideLabel type="search" placeholder="Cari nama, arti, atau nomor…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search className="size-5" />} />
        </div>
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua" },
            { value: "favorite", label: "Favorit" },
          ]}
        />
      </div>
      {query.isPending ? (
        <GridSkeleton items={12} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (query.data.data.length ?? 0) === 0 ? (
        <EmptyState icon={<Star className="size-6" />} title="Dataset belum tersedia" description="Backend belum memiliki data Asmaul Husna yang terverifikasi." />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="Tidak ditemukan" description={filter === "favorite" ? "Belum ada favorit." : "Coba kata kunci lain."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((n, i) => (
            <motion.li key={n.number} initial={reduced ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
              <div className="nur-surface group relative flex h-full flex-col rounded-3xl p-5 transition-colors hover:border-gold/40">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-gold-text">{n.number}</span>
                  <span className="flex">
                    {n.audioUrl && <IconButton size="sm" label={`Dengarkan ${n.transliteration}`} icon={<Volume2 className="size-4" />} onClick={() => playPronunciation(n.audioUrl!)} />}
                    <FavoriteButton contentType="ASMAUL_HUSNA" contentId={String(n.number)} label={n.transliteration} />
                  </span>
                </div>
                <button type="button" onClick={() => setSelected(n)} className="mt-2 flex flex-1 flex-col items-center rounded-2xl py-2 text-center" aria-label={`${n.transliteration}: ${n.meaning}. Buka detail`}>
                  <span lang="ar" className="text-4xl text-fg transition-colors group-hover:text-gold-text">
                    {n.arabicName}
                  </span>
                  <span className="mt-3 font-semibold">{n.transliteration}</span>
                  <span className="mt-1 text-sm text-muted">{n.meaning}</span>
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      <SourceNote source={query.data?.meta.source} license={query.data?.meta.license} version={query.data?.meta.datasetVersion} />
      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.number}. ${selected.transliteration}` : ""} description={selected?.meaning}>
        {selected && (
          <div className="space-y-4">
            <p lang="ar" className="text-center text-5xl text-gold-text">
              {selected.arabicName}
            </p>
            {selected.explanation ? <p className="leading-relaxed text-fg/90">{selected.explanation}</p> : <p className="text-sm text-muted">Penjelasan belum tersedia pada dataset.</p>}
            {selected.source && <p className="text-xs text-muted">Sumber: {selected.source}</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
