import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ErrorState, GridSkeleton } from "@/components/feedback/States";
import { api } from "@/services/api";
import { formatDateTime } from "@/lib/format";

export function AdminSyncPage() {
  const status = useQuery({ queryKey: ["admin", "sync"], queryFn: () => api.admin.syncStatus(), refetchInterval: 30_000 });
  if (status.isPending) return <GridSkeleton items={4} />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  const items = [
    { label: "Perubahan 24 jam", value: status.data.changesLast24h },
    { label: "Konflik 24 jam", value: status.data.conflictsLast24h },
    { label: "Ditolak 24 jam", value: status.data.rejectedLast24h },
  ];
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Status sinkronisasi</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <Card key={i.label}>
            <p className="text-3xl font-bold tabular-nums">{i.value}</p>
            <p className="text-sm text-muted">{i.label}</p>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Perubahan terakhir: {status.data.lastChangeAt ? formatDateTime(status.data.lastChangeAt) : "—"}</p>
    </div>
  );
}
