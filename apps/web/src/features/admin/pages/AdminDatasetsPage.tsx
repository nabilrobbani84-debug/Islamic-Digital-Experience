import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/misc";
import { api } from "@/services/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AdminTable } from "../components/AdminTable";
import { STATUS_TONE } from "./AdminContentPage";

export function AdminDatasetsPage() {
  const datasets = useQuery({ queryKey: ["admin", "datasets"], queryFn: () => api.admin.datasets() });
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Versi dataset</h2>
      <p className="mb-4 text-sm text-muted">Setiap import tercatat dengan checksum SHA-256. Dataset hanya dapat diterbitkan setelah disetujui.</p>
      <AdminTable
        query={datasets}
        caption="Versi dataset"
        empty="Belum ada dataset yang diimpor"
        rowKey={(d) => d.id}
        columns={[
          { header: "Dataset", cell: (d) => <><span className="font-medium">{d.datasetName}</span><span className="block text-xs text-muted">v{d.version}</span></> },
          { header: "Record", cell: (d) => (d.recordCount === null ? "—" : formatNumber(d.recordCount)) },
          { header: "Checksum", cell: (d) => <code className="text-xs break-all text-muted">{d.checksum.slice(0, 16)}…</code> },
          { header: "Status", cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge> },
          { header: "Diimpor", cell: (d) => <>{formatDateTime(d.importedAt)}{d.approvedAt && <span className="block text-xs text-muted">Disetujui {formatDateTime(d.approvedAt)}</span>}</> },
        ]}
      />
    </div>
  );
}
