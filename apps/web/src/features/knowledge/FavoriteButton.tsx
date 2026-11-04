import { useLiveQuery } from "dexie-react-hooks";
import { Heart } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { db, type FavoriteContentType } from "@/services/offline/db";
import { toggleFavorite } from "@/services/offline/personal";
import { cn } from "@/lib/cn";

export function FavoriteButton({ contentType, contentId, label }: { contentType: FavoriteContentType; contentId: string; label: string }) {
  const favorite = useLiveQuery(() => db.favorites.get(`${contentType}:${contentId}`), [contentType, contentId]);
  const active = !!favorite;
  return (
    <IconButton
      size="sm"
      label={active ? `Hapus ${label} dari favorit` : `Tambahkan ${label} ke favorit`}
      aria-pressed={active}
      active={active}
      icon={<Heart className={cn("size-4", active && "fill-current")} />}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavorite(contentType, contentId);
      }}
    />
  );
}

export function useFavoriteIds(contentType: FavoriteContentType): Set<string> {
  const rows = useLiveQuery(() => db.favorites.where("contentType").equals(contentType).toArray(), [contentType]);
  return new Set((rows ?? []).map((r) => r.contentId));
}
