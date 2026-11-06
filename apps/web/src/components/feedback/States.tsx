import type { ReactNode } from "react";
import { CircleAlert, Lock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/misc";
import { isApiError, userMessage } from "@/services/api";
import { cn } from "@/lib/cn";

function StateShell({ icon, title, description, action, className, role }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; role?: "alert" | "status" }) {
  return (
    <div role={role} className={cn("nur-surface flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-gold-text">{icon}</span>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <StateShell icon={icon} title={title} description={description} action={action} className={className} role="status" />;
}

export function ErrorState({ error, onRetry, title, className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  const offline = isApiError(error) && error.isNetwork;
  const forbidden = isApiError(error) && error.status === 403;
  if (forbidden) return <PermissionDenied className={className} />;
  return (
    <StateShell
      role="alert"
      className={className}
      icon={offline ? <WifiOff className="size-6" /> : <CircleAlert className="size-6" />}
      title={title ?? (offline ? "Anda sedang offline" : "Gagal memuat data")}
      description={userMessage(error)}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="size-4" />}>
            Coba lagi
          </Button>
        )
      }
    />
  );
}

export function PermissionDenied({ className, description }: { className?: string; description?: string }) {
  return (
    <StateShell
      role="alert"
      className={className}
      icon={<Lock className="size-6" />}
      title="Akses ditolak"
      description={description ?? "Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi administrator jika menurut Anda ini keliru."}
    />
  );
}

export function OfflineNotice({ children }: { children?: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children ?? "Anda sedang offline. Data yang ditampilkan berasal dari penyimpanan perangkat."}</span>
    </div>
  );
}

export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function GridSkeleton({ items = 6, className }: { items?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-busy="true" aria-label="Memuat">
      {Array.from({ length: items }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-3xl" />
      ))}
    </div>
  );
}

/** Hanya tautan https yang dirender; nilai lain (javascript:, http:, tidak valid) diabaikan. */
export function safeHttpsUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function SourceLink({ label, url }: { label: string; url?: string | null }) {
  const href = safeHttpsUrl(url);
  if (!href) return <>{label}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
      {label}
    </a>
  );
}

export function SourceNote({
  source,
  license,
  version,
  url,
  translation,
}: {
  source?: string;
  license?: string;
  version?: string;
  url?: string | null;
  translation?: { name: string; url?: string | null; license?: string | null } | null;
}) {
  if (!source && !license && !version && !translation) return null;
  return (
    <p className="mt-8 text-xs text-muted" data-testid="source-note">
      {source && (
        <>
          Sumber: <SourceLink label={source} url={url} />.{" "}
        </>
      )}
      {license && <>Lisensi: {license}. </>}
      {translation && (
        <>
          Terjemahan: <SourceLink label={translation.name} url={translation.url} />.{" "}
          {translation.license && <>Lisensi terjemahan: {translation.license}. </>}
        </>
      )}
      {version && <>Versi dataset: {version}.</>}
    </p>
  );
}
