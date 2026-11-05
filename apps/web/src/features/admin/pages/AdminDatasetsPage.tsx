import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/misc";
import { api, userMessage } from "@/services/api";
import { toast } from "@/stores/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AdminTable } from "../components/AdminTable";
import { STATUS_TONE } from "./AdminContentPage";

export function AdminDatasetsPage() {
  const client = useQueryClient();
  const datasets = useQuery({ queryKey: ["admin", "datasets"], queryFn: () => api.admin.datasets() });
  const approve = useMutation({
    mutationFn: (id: string) => api.admin.approveDataset(id),
    onSuccess: (d) => {
      toast.success("Dataset diterbitkan", `${d.datasetName} v${d.version} kini dilayani ke pengguna.`);
      void client.invalidateQueries({ queryKey: ["admin"] });
      void client.invalidateQueries({ queryKey: ["quran"] });
    },
    onError: (err) => toast.error("Gagal menerbitkan", userMessage(err)),
  });
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Versi dataset</h2>
      <p className="mb-4 text-sm text-muted">Setiap import tercatat dengan checksum SHA-256. Dataset hanya dilayani ke pengguna setelah disetujui; versi terbit sebelumnya diarsipkan.</p>
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
          {
            header: "",
            cell: (d) =>
              (d.status === "REVIEW" || d.status === "DRAFT") && (
                <Button size="sm" onClick={() => approve.mutate(d.id)} loading={approve.isPending && approve.variables === d.id}>
                  Setujui & terbitkan
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}
