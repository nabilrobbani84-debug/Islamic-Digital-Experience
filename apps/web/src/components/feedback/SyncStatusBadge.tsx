import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router";
import { CircleAlert, CircleCheck, CloudOff, LoaderCircle, TriangleAlert, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { db } from "@/services/offline/db";
import { useSyncStatus } from "@/services/offline/sync-engine";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

type Kind = "offline" | "syncing" | "conflict" | "failed" | "pending" | "success" | "online";

/**
 * Indikator status koneksi dan sinkronisasi: Online, Offline, Syncing, Sync success, Sync failed, Conflict.
 * Menautkan ke Profil → Sinkronisasi ketika ada konflik atau kegagalan.
 */
export function SyncStatusBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  const online = useOnlineStatus();
  const { state, lastSyncAt } = useSyncStatus();
  const counts = useLiveQuery(async () => {
    const rows = await db.pending_sync.toArray();
    return { pending: rows.filter((r) => r.status === "PENDING").length, failed: rows.filter((r) => r.status === "FAILED").length, conflict: rows.filter((r) => r.status === "CONFLICT").length };
  }, []);

  const kind: Kind = !online || state === "offline" ? "offline" : state === "syncing" ? "syncing" : (counts?.conflict ?? 0) > 0 ? "conflict" : state === "error" || (counts?.failed ?? 0) > 0 ? "failed" : (counts?.pending ?? 0) > 0 ? "pending" : lastSyncAt ? "success" : "online";

  const pending = counts?.pending ?? 0;
  const view: Record<Kind, { label: string; detail: string; icon: typeof Wifi; tone: string }> = {
    offline: { label: "Offline", detail: pending > 0 ? `${pending} perubahan menunggu koneksi` : "Data tersimpan di perangkat", icon: CloudOff, tone: "text-amber-600 dark:text-amber-300 border-amber-500/30 bg-amber-500/10" },
    syncing: { label: "Menyinkronkan", detail: "Mengirim perubahan…", icon: LoaderCircle, tone: "text-gold-text border-gold/30 bg-gold/10" },
    conflict: { label: "Konflik", detail: `${counts?.conflict ?? 0} perubahan perlu ditinjau`, icon: TriangleAlert, tone: "text-amber-600 dark:text-amber-300 border-amber-500/40 bg-amber-500/10" },
    failed: { label: "Sinkron gagal", detail: "Akan dicoba lagi otomatis", icon: CircleAlert, tone: "text-red-600 dark:text-red-300 border-red-500/30 bg-red-500/10" },
    pending: { label: "Menunggu", detail: `${pending} perubahan belum terkirim`, icon: LoaderCircle, tone: "text-muted border-line bg-surface-2" },
    success: { label: "Tersinkron", detail: lastSyncAt ? `Terakhir ${formatRelative(lastSyncAt)}` : "", icon: CircleCheck, tone: "text-accent border-emerald-nur/30 bg-emerald-nur/10" },
    online: { label: "Online", detail: "Terhubung", icon: Wifi, tone: "text-accent border-emerald-nur/30 bg-emerald-nur/10" },
  };
  const v = view[kind];
  const Icon = v.icon;
  const needsAttention = kind === "conflict" || kind === "failed";

  const content = (
    <>
      <Icon className={cn("size-4 shrink-0", kind === "syncing" && "animate-spin")} aria-hidden />
      <span className={cn("text-xs font-semibold", compact && "sr-only xl:not-sr-only")}>{v.label}</span>
    </>
  );
  const base = cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 xl:px-3", v.tone, className);

  return needsAttention ? (
    <Link to="/profile?tab=sync" className={base} data-testid="sync-status" data-kind={kind} title={v.detail} aria-label={`${v.label}. ${v.detail}. Buka tinjauan sinkronisasi`}>
      {content}
    </Link>
  ) : (
    <span role="status" className={base} data-testid="sync-status" data-kind={kind} title={v.detail} aria-label={`${v.label}. ${v.detail}`}>
      {content}
    </span>
  );
}
