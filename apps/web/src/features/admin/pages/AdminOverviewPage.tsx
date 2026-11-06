import { useQuery } from "@tanstack/react-query";
import { Activity, Database, FileText, TriangleAlert, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ErrorState, GridSkeleton } from "@/components/feedback/States";
import { api } from "@/services/api";

export function AdminOverviewPage() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.admin.overview() });
  if (overview.isPending) return <GridSkeleton items={5} />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;
  const stats = [
    { label: "Pengguna", value: overview.data.users, icon: Users },
    { label: "Sesi aktif", value: overview.data.activeSessions, icon: Activity },
    { label: "Dataset terbit", value: overview.data.publishedDatasets, icon: Database },
    { label: "Revisi menunggu review", value: overview.data.pendingRevisions, icon: FileText },
    { label: "Konflik sinkronisasi", value: overview.data.pendingSyncConflicts, icon: TriangleAlert },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((s) => (
        <Card key={s.label}>
          <s.icon className="size-5 text-gold-text" aria-hidden />
          <p className="mt-3 text-3xl font-bold tabular-nums">{s.value}</p>
          <p className="text-sm text-muted">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}
